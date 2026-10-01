package oauth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ScopeView struct {
	ID          string `json:"id" example:"kindred:read"`
	Title       string `json:"title" example:"View your tasks"`
	Description string `json:"description" example:"See your workspaces, categories and tasks."`
}

type ClientView struct {
	ID           string `json:"id" example:"https://claude.ai/oauth/mcp-oauth-client-metadata"`
	Name         string `json:"name" example:"Claude"`
	Host         string `json:"host" example:"claude.ai"`
	LogoURI      string `json:"logo_uri,omitempty"`
	Verified     bool   `json:"verified"`
	Registration string `json:"registration" enum:"cimd,dcr"`
}

type BrowserView struct {
	UserAgent string `json:"user_agent"`
	IP        string `json:"ip"`
}

type RequestView struct {
	ID          string      `json:"id"`
	Status      string      `json:"status" enum:"pending,approved,denied,expired"`
	Client      ClientView  `json:"client"`
	Scopes      []ScopeView `json:"scopes"`
	RequestedAt time.Time   `json:"requested_at"`
	ExpiresAt   time.Time   `json:"expires_at"`
	Browser     BrowserView `json:"browser"`
}

type GrantView struct {
	ID         string      `json:"id"`
	Client     ClientView  `json:"client"`
	Scopes     []ScopeView `json:"scopes"`
	CreatedAt  time.Time   `json:"created_at"`
	LastUsedAt *time.Time  `json:"last_used_at"`
}

type StatusBody struct {
	Status string `json:"status" enum:"pending,approved,denied,expired"`
}

type GetRequestInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id"`
}

type GetRequestByCodeInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Code          string `path:"code" example:"K7QX-2MPA" doc:"User code shown in the browser; case-insensitive, dash optional"`
}

type RequestOutput struct {
	Body RequestView
}

type ApproveRequestInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id"`
	Body          struct {
		Scopes []string `json:"scopes" minItems:"1" doc:"Scopes to grant; a non-empty subset of the requested scopes"`
	}
}

type DenyRequestInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id"`
}

type StatusOutput struct {
	Body StatusBody
}

type ListGrantsInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type ListGrantsOutput struct {
	Body []GrantView
}

type RevokeGrantInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id"`
}

type RevokeGrantOutput struct {
	Body struct {
		Message string `json:"message" example:"Connection revoked"`
	}
}

func registerAppOperations(api huma.API, s *Service) {
	tags := []string{"oauth"}
	huma.Register(api, huma.Operation{
		OperationID: "get-oauth-request", Method: http.MethodGet, Path: "/v1/user/oauth/requests/{id}",
		Summary: "Get a pending MCP connection request", Tags: tags,
	}, s.getRequest)
	huma.Register(api, huma.Operation{
		OperationID: "get-oauth-request-by-code", Method: http.MethodGet, Path: "/v1/user/oauth/requests/by-code/{code}",
		Summary: "Find a pending MCP connection request by its user code", Tags: tags,
	}, s.getRequestByCode)
	huma.Register(api, huma.Operation{
		OperationID: "approve-oauth-request", Method: http.MethodPost, Path: "/v1/user/oauth/requests/{id}/approve",
		Summary: "Approve an MCP connection request", Tags: tags,
	}, s.approve)
	huma.Register(api, huma.Operation{
		OperationID: "deny-oauth-request", Method: http.MethodPost, Path: "/v1/user/oauth/requests/{id}/deny",
		Summary: "Deny an MCP connection request", Tags: tags,
	}, s.deny)
	huma.Register(api, huma.Operation{
		OperationID: "list-oauth-grants", Method: http.MethodGet, Path: "/v1/user/oauth/grants",
		Summary: "List connected MCP apps", Tags: tags,
	}, s.listGrantsOp)
	huma.Register(api, huma.Operation{
		OperationID: "revoke-oauth-grant", Method: http.MethodDelete, Path: "/v1/user/oauth/grants/{id}",
		Summary: "Disconnect an MCP app and revoke its tokens", Tags: tags,
	}, s.revokeGrantOp)
}

func (s *Service) caller(ctx context.Context) (primitive.ObjectID, error) {
	if !s.Enabled() {
		return primitive.NilObjectID, huma.Error404NotFound("Connecting apps is not available")
	}
	idStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return primitive.NilObjectID, huma.Error401Unauthorized("Authentication required", err)
	}
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return primitive.NilObjectID, huma.Error400BadRequest("Invalid user ID", err)
	}
	return id, nil
}

func toScopeViews(ids []string) []ScopeView {
	out := []ScopeView{}
	for _, sc := range describeScopes(ids) {
		out = append(out, ScopeView(sc))
	}
	return out
}

func toClientView(c *Client, host string) ClientView {
	return ClientView{ID: c.ID, Name: c.Name, Host: host, LogoURI: c.LogoURI, Verified: c.Verified, Registration: c.Registration}
}

func (s *Service) toRequestView(doc *requestDoc) RequestView {
	return RequestView{
		ID:          doc.ID,
		Status:      doc.effectiveStatus(s.now()),
		Client:      toClientView(&doc.Client, doc.ClientHost),
		Scopes:      toScopeViews(doc.Scopes),
		RequestedAt: doc.CreatedAt,
		ExpiresAt:   doc.ExpiresAt,
		Browser:     BrowserView{UserAgent: doc.BrowserUserAgent, IP: doc.BrowserIP},
	}
}

// visibleRequest hides requests another user has already decided.
func (s *Service) visibleRequest(ctx context.Context, id string, userID primitive.ObjectID) (*requestDoc, error) {
	doc, err := s.findRequest(ctx, id)
	if errors.Is(err, errNotFound) || (err == nil && doc.UserID != nil && *doc.UserID != userID) {
		return nil, huma.Error404NotFound("Request not found")
	}
	if err != nil {
		slog.Error("mcp oauth: load request failed", "error", err)
		return nil, huma.Error500InternalServerError("Unable to load the request. Please try again.")
	}
	return doc, nil
}

func (s *Service) getRequest(ctx context.Context, in *GetRequestInput) (*RequestOutput, error) {
	userID, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	doc, err := s.visibleRequest(ctx, in.ID, userID)
	if err != nil {
		return nil, err
	}
	if doc.effectiveStatus(s.now()) == statusExpired {
		return nil, huma.Error410Gone("This request has expired")
	}
	return &RequestOutput{Body: s.toRequestView(doc)}, nil
}

// decidable maps a request that can no longer be approved or denied to the UI's status codes.
func (s *Service) decidable(doc *requestDoc) error {
	switch doc.effectiveStatus(s.now()) {
	case statusPending:
		return nil
	case statusExpired:
		return huma.Error410Gone("This request has expired")
	default:
		return huma.Error409Conflict("This request was already " + doc.Status)
	}
}

func (s *Service) getRequestByCode(ctx context.Context, in *GetRequestByCodeInput) (*RequestOutput, error) {
	userID, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	if !s.byCodeLimiter.Allow(userID.Hex()) {
		return nil, huma.Error429TooManyRequests("Too many codes tried. Wait a few minutes and try again.")
	}
	code := normalizeUserCode(in.Code)
	if code == "" {
		return nil, huma.Error404NotFound("No pending request matches that code")
	}
	doc, err := s.findPendingByCode(ctx, code)
	if errors.Is(err, errNotFound) {
		return nil, huma.Error404NotFound("No pending request matches that code")
	}
	if err != nil {
		slog.Error("mcp oauth: lookup by code failed", "error", err)
		return nil, huma.Error500InternalServerError("Unable to look up that code. Please try again.")
	}
	if doc.effectiveStatus(s.now()) == statusExpired {
		return nil, huma.Error410Gone("This code has expired")
	}
	return &RequestOutput{Body: s.toRequestView(doc)}, nil
}

func (s *Service) approve(ctx context.Context, in *ApproveRequestInput) (*StatusOutput, error) {
	userID, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	doc, err := s.visibleRequest(ctx, in.ID, userID)
	if err != nil {
		return nil, err
	}
	if err := s.decidable(doc); err != nil {
		return nil, err
	}
	if len(in.Body.Scopes) == 0 {
		return nil, huma.Error400BadRequest("Choose at least one permission")
	}
	for _, sc := range in.Body.Scopes {
		if !slices.Contains(doc.Scopes, sc) {
			return nil, huma.Error400BadRequest("Scope " + sc + " was not requested")
		}
	}
	scopes := intersectScopes(doc.Scopes, in.Body.Scopes)
	err = s.approveRequest(ctx, doc, userID, scopes)
	if errors.Is(err, errNotPending) {
		return nil, s.decidedConflict(ctx, doc.ID)
	}
	if err != nil {
		slog.Error("mcp oauth: approve failed", "requestId", doc.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to approve. Please try again.")
	}
	return &StatusOutput{Body: StatusBody{Status: statusApproved}}, nil
}

func (s *Service) deny(ctx context.Context, in *DenyRequestInput) (*StatusOutput, error) {
	userID, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	doc, err := s.visibleRequest(ctx, in.ID, userID)
	if err != nil {
		return nil, err
	}
	if err := s.decidable(doc); err != nil {
		return nil, err
	}
	err = s.denyRequest(ctx, doc.ID, &userID)
	if errors.Is(err, errNotPending) {
		return nil, s.decidedConflict(ctx, doc.ID)
	}
	if err != nil {
		slog.Error("mcp oauth: deny failed", "requestId", doc.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to deny. Please try again.")
	}
	return &StatusOutput{Body: StatusBody{Status: statusDenied}}, nil
}

// decidedConflict re-reads a request that changed underneath a decision.
func (s *Service) decidedConflict(ctx context.Context, id string) error {
	if doc, err := s.findRequest(ctx, id); err == nil {
		if err := s.decidable(doc); err != nil {
			return err
		}
	}
	return huma.Error409Conflict("This request is no longer pending")
}

func (s *Service) listGrantsOp(ctx context.Context, _ *ListGrantsInput) (*ListGrantsOutput, error) {
	userID, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	grants, err := s.listGrants(ctx, userID)
	if err != nil {
		slog.Error("mcp oauth: list grants failed", "error", err)
		return nil, huma.Error500InternalServerError("Unable to load connected apps. Please try again.")
	}
	out := make([]GrantView, 0, len(grants))
	for i := range grants {
		g := &grants[i]
		out = append(out, GrantView{
			ID:         g.ID.Hex(),
			Client:     toClientView(&g.Client, g.ClientHost),
			Scopes:     toScopeViews(g.Scopes),
			CreatedAt:  g.CreatedAt,
			LastUsedAt: g.LastUsedAt,
		})
	}
	return &ListGrantsOutput{Body: out}, nil
}

func (s *Service) revokeGrantOp(ctx context.Context, in *RevokeGrantInput) (*RevokeGrantOutput, error) {
	userID, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	grantID, err := primitive.ObjectIDFromHex(in.ID)
	if err != nil {
		return nil, huma.Error404NotFound("Connection not found")
	}
	err = s.revokeGrant(ctx, bson.M{"_id": grantID, "user_id": userID, "revoked_at": nil}, "user_revoked")
	if errors.Is(err, errNotFound) {
		return nil, huma.Error404NotFound("Connection not found")
	}
	if err != nil {
		slog.Error("mcp oauth: revoke grant failed", "grantId", in.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to disconnect. Please try again.")
	}
	out := &RevokeGrantOutput{}
	out.Body.Message = "Connection revoked"
	return out, nil
}
