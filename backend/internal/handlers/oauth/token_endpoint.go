package oauth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// oauthError is an RFC 6749 section 5.2 error response.
type oauthError struct {
	Code        string `json:"error"`
	Description string `json:"error_description,omitempty"`
	status      int
}

func newOAuthError(status int, code, desc string) *oauthError {
	return &oauthError{Code: code, Description: desc, status: status}
}

func invalidGrant(desc string) *oauthError {
	return newOAuthError(http.StatusBadRequest, "invalid_grant", desc)
}

func invalidRequest(desc string) *oauthError {
	return newOAuthError(http.StatusBadRequest, "invalid_request", desc)
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Scope        string `json:"scope"`
}

func noStore(c *fiber.Ctx) {
	c.Set("Cache-Control", "no-store")
	c.Set("Pragma", "no-cache")
}

func writeOAuthError(c *fiber.Ctx, e *oauthError) error {
	if e.status == http.StatusUnauthorized {
		c.Set("WWW-Authenticate", `Basic realm="kindred"`)
	}
	return c.Status(e.status).JSON(e)
}

func (s *Service) requestIP(c *fiber.Ctx) string {
	return clientIP(func(k string) string { return c.Get(k) }, c.Context().RemoteAddr().String())
}

// tokenClientID reads client_id from the form or a Basic header with an empty secret.
func tokenClientID(c *fiber.Ctx) (string, *oauthError) {
	formID := c.FormValue("client_id")
	authz := c.Get(fiber.HeaderAuthorization)
	if authz == "" {
		if formID == "" {
			return "", invalidRequest("client_id is required")
		}
		return formID, nil
	}
	scheme, payload, _ := strings.Cut(authz, " ")
	if !strings.EqualFold(scheme, "basic") {
		return "", newOAuthError(http.StatusUnauthorized, "invalid_client", "unsupported client authentication")
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(payload))
	if err != nil {
		return "", newOAuthError(http.StatusUnauthorized, "invalid_client", "malformed client credentials")
	}
	user, pass, _ := strings.Cut(string(decoded), ":")
	id, err := url.QueryUnescape(user)
	if err != nil || id == "" || pass != "" {
		return "", newOAuthError(http.StatusUnauthorized, "invalid_client", "only public clients are supported")
	}
	if formID != "" && formID != id {
		return "", newOAuthError(http.StatusUnauthorized, "invalid_client", "client_id mismatch")
	}
	return id, nil
}

func (s *Service) handleToken(c *fiber.Ctx) error {
	noStore(c)
	c.Set("Access-Control-Allow-Origin", "*")
	if !s.tokenLimiter.Allow(s.requestIP(c)) {
		return writeOAuthError(c, newOAuthError(http.StatusTooManyRequests, "invalid_request", "too many requests"))
	}
	clientID, oerr := tokenClientID(c)
	if oerr != nil {
		return writeOAuthError(c, oerr)
	}
	ctx := c.UserContext()
	var resp *tokenResponse
	switch c.FormValue("grant_type") {
	case "authorization_code":
		resp, oerr = s.exchangeCode(ctx, clientID, c.FormValue("code"), c.FormValue("redirect_uri"), c.FormValue("code_verifier"), c.FormValue("resource"))
	case "refresh_token":
		resp, oerr = s.refresh(ctx, clientID, c.FormValue("refresh_token"), c.FormValue("scope"), c.FormValue("resource"))
	case "":
		oerr = invalidRequest("grant_type is required")
	default:
		oerr = newOAuthError(http.StatusBadRequest, "unsupported_grant_type", "")
	}
	if oerr != nil {
		return writeOAuthError(c, oerr)
	}
	return c.JSON(resp)
}

func codeVerifierWellFormed(v string) bool {
	if len(v) < 43 || len(v) > 128 {
		return false
	}
	for _, r := range v {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || strings.ContainsRune("-._~", r)) {
			return false
		}
	}
	return true
}

// codeChallengeWellFormed accepts only S256 output: 43 base64url characters.
func codeChallengeWellFormed(ch string) bool {
	if len(ch) != 43 {
		return false
	}
	_, err := base64.RawURLEncoding.DecodeString(ch)
	return err == nil
}

func verifyPKCE(verifier, challenge string) bool {
	if !codeVerifierWellFormed(verifier) {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	return constantTimeEqual(base64.RawURLEncoding.EncodeToString(sum[:]), challenge)
}

func (s *Service) exchangeCode(ctx context.Context, clientID, code, redirectURI, verifier, resource string) (*tokenResponse, *oauthError) {
	if code == "" || verifier == "" || redirectURI == "" {
		return nil, invalidRequest("code, redirect_uri and code_verifier are required")
	}
	if !secretWellFormed(code, codePrefix) {
		return nil, invalidGrant("invalid authorization code")
	}
	hash := hashSecret(code)
	now := s.now()
	var doc codeDoc
	err := s.codes.FindOneAndUpdate(ctx,
		bson.M{"code_hash": hash, "used_at": nil},
		bson.M{"$set": bson.M{"used_at": now}},
	).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		var used codeDoc
		if s.codes.FindOne(ctx, bson.M{"code_hash": hash}).Decode(&used) == nil {
			slog.Warn("mcp oauth: authorization code reused; revoking grant tokens", "grantId", used.GrantID.Hex(), "clientId", used.ClientID)
			if err := s.deleteGrantTokens(ctx, used.GrantID); err != nil {
				slog.Error("mcp oauth: unable to revoke tokens after code reuse", "error", err)
			}
		}
		return nil, invalidGrant("invalid authorization code")
	}
	if err != nil {
		slog.Error("mcp oauth: redeem code failed", "error", err)
		return nil, newOAuthError(http.StatusInternalServerError, "server_error", "")
	}
	switch {
	case !now.Before(doc.ExpiresAt):
		return nil, invalidGrant("authorization code expired")
	case doc.ClientID != clientID:
		return nil, invalidGrant("authorization code was issued to another client")
	case doc.RedirectURI != redirectURI:
		return nil, invalidGrant("redirect_uri does not match the authorization request")
	case resource != "" && resource != doc.Resource:
		return nil, newOAuthError(http.StatusBadRequest, "invalid_target", "resource does not match the authorization request")
	case !verifyPKCE(verifier, doc.CodeChallenge):
		return nil, invalidGrant("code_verifier does not match")
	}
	grant, err := s.activeGrant(ctx, doc.GrantID)
	if err != nil {
		return nil, invalidGrant("this connection has been revoked")
	}
	scopes := intersectScopes(doc.Scopes, grant.Scopes)
	if len(scopes) == 0 {
		return nil, invalidGrant("no scopes remain on this connection")
	}
	issued, err := s.issueTokens(ctx, grant.ID, grant.UserID, primitive.NewObjectID(), clientID, doc.Resource, scopes)
	if err != nil {
		slog.Error("mcp oauth: issue tokens failed", "error", err)
		return nil, newOAuthError(http.StatusInternalServerError, "server_error", "")
	}
	return toTokenResponse(issued), nil
}

func (s *Service) refresh(ctx context.Context, clientID, raw, scope, resource string) (*tokenResponse, *oauthError) {
	if raw == "" {
		return nil, invalidRequest("refresh_token is required")
	}
	if !secretWellFormed(raw, refreshTokenPrefix) {
		return nil, invalidGrant("invalid refresh token")
	}
	now := s.now()
	var tok tokenDoc
	err := s.tokens.FindOne(ctx, bson.M{"token_hash": hashSecret(raw), "kind": kindRefresh}).Decode(&tok)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, invalidGrant("invalid refresh token")
	}
	if err != nil {
		slog.Error("mcp oauth: lookup refresh token failed", "error", err)
		return nil, newOAuthError(http.StatusInternalServerError, "server_error", "")
	}
	if tok.RotatedAt != nil {
		return nil, s.refreshReused(ctx, &tok)
	}
	switch {
	case tok.ClientID != clientID:
		return nil, invalidGrant("refresh token was issued to another client")
	case !now.Before(tok.ExpiresAt):
		return nil, invalidGrant("refresh token expired")
	case resource != "" && resource != tok.Audience:
		return nil, newOAuthError(http.StatusBadRequest, "invalid_target", "resource does not match")
	}
	grant, err := s.activeGrant(ctx, tok.GrantID)
	if err != nil {
		return nil, invalidGrant("this connection has been revoked")
	}
	allowed := intersectScopes(tok.Scopes, grant.Scopes)
	scopes := allowed
	if requested := strings.Fields(scope); len(requested) > 0 {
		for _, r := range requested {
			if !slices.Contains(allowed, r) {
				return nil, newOAuthError(http.StatusBadRequest, "invalid_scope", "scope may only narrow the original grant")
			}
		}
		scopes = intersectScopes(allowed, requested)
	}
	if len(scopes) == 0 {
		return nil, invalidGrant("no scopes remain on this connection")
	}
	// Validation passed; claim the token atomically so a concurrent use counts as reuse.
	res, err := s.tokens.UpdateOne(ctx, bson.M{"_id": tok.ID, "rotated_at": nil}, bson.M{"$set": bson.M{"rotated_at": now}})
	if err != nil {
		slog.Error("mcp oauth: rotate refresh token failed", "error", err)
		return nil, newOAuthError(http.StatusInternalServerError, "server_error", "")
	}
	if res.MatchedCount == 0 {
		return nil, s.refreshReused(ctx, &tok)
	}
	issued, err := s.issueTokens(ctx, grant.ID, grant.UserID, tok.FamilyID, clientID, tok.Audience, scopes)
	if err != nil {
		slog.Error("mcp oauth: issue tokens failed", "error", err)
		return nil, newOAuthError(http.StatusInternalServerError, "server_error", "")
	}
	return toTokenResponse(issued), nil
}

// refreshReused revokes the whole grant when a rotated refresh token is presented again.
func (s *Service) refreshReused(ctx context.Context, tok *tokenDoc) *oauthError {
	slog.Warn("mcp oauth: refresh token reused; revoking grant", "grantId", tok.GrantID.Hex(), "clientId", tok.ClientID)
	if err := s.revokeGrant(ctx, bson.M{"_id": tok.GrantID}, "refresh_token_reuse"); err != nil && !errors.Is(err, errNotFound) {
		slog.Error("mcp oauth: unable to revoke grant after refresh reuse", "error", err)
	}
	return invalidGrant("invalid refresh token")
}

func toTokenResponse(t *issuedTokens) *tokenResponse {
	return &tokenResponse{
		AccessToken:  t.Access,
		TokenType:    "Bearer",
		ExpiresIn:    t.ExpiresIn,
		RefreshToken: t.Refresh,
		Scope:        strings.Join(t.Scopes, " "),
	}
}

// handleRevoke implements RFC 7009; unknown tokens still return 200.
func (s *Service) handleRevoke(c *fiber.Ctx) error {
	noStore(c)
	c.Set("Access-Control-Allow-Origin", "*")
	if !s.tokenLimiter.Allow(s.requestIP(c)) {
		return writeOAuthError(c, newOAuthError(http.StatusTooManyRequests, "invalid_request", "too many requests"))
	}
	clientID, oerr := tokenClientID(c)
	if oerr != nil {
		return writeOAuthError(c, oerr)
	}
	raw := c.FormValue("token")
	if raw == "" {
		return writeOAuthError(c, invalidRequest("token is required"))
	}
	if !secretWellFormed(raw, accessTokenPrefix) && !secretWellFormed(raw, refreshTokenPrefix) {
		return c.SendStatus(http.StatusOK)
	}
	ctx := c.UserContext()
	var tok tokenDoc
	err := s.tokens.FindOne(ctx, bson.M{"token_hash": hashSecret(raw)}).Decode(&tok)
	if err != nil || tok.ClientID != clientID {
		return c.SendStatus(http.StatusOK)
	}
	filter := bson.M{"_id": tok.ID}
	if tok.Kind == kindRefresh {
		filter = bson.M{"family_id": tok.FamilyID}
	}
	if _, err := s.tokens.DeleteMany(ctx, filter); err != nil {
		slog.Error("mcp oauth: revoke token failed", "error", err)
		return writeOAuthError(c, newOAuthError(http.StatusServiceUnavailable, "server_error", ""))
	}
	return c.SendStatus(http.StatusOK)
}

type registrationResponse struct {
	ClientID                string   `json:"client_id"`
	ClientIDIssuedAt        int64    `json:"client_id_issued_at"`
	ClientName              string   `json:"client_name,omitempty"`
	ClientURI               string   `json:"client_uri,omitempty"`
	LogoURI                 string   `json:"logo_uri,omitempty"`
	RedirectURIs            []string `json:"redirect_uris"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
}

// handleRegister implements RFC 7591 for public clients. DCR clients are never verified.
func (s *Service) handleRegister(c *fiber.Ctx) error {
	noStore(c)
	c.Set("Access-Control-Allow-Origin", "*")
	ip := s.requestIP(c)
	if !s.registerLimiter.Allow(ip) {
		return writeOAuthError(c, newOAuthError(http.StatusTooManyRequests, "invalid_request", "too many registrations from this network"))
	}
	var m clientMetadata
	if err := json.Unmarshal(c.Body(), &m); err != nil {
		return writeOAuthError(c, newOAuthError(http.StatusBadRequest, "invalid_client_metadata", "body must be a JSON object"))
	}
	client, err := validateMetadata(&m)
	if err != nil {
		code := "invalid_client_metadata"
		if strings.Contains(err.Error(), "redirect_uri") {
			code = "invalid_redirect_uri"
		}
		return writeOAuthError(c, newOAuthError(http.StatusBadRequest, code, err.Error()))
	}
	id, err := randomString(16)
	if err != nil {
		return writeOAuthError(c, newOAuthError(http.StatusInternalServerError, "server_error", ""))
	}
	client.ID = dcrClientPrefix + id
	client.Registration = registrationDCR
	client.Verified = false
	if client.Name == "" {
		client.Name = clientHost(client, "")
	}
	now := s.now()
	doc := dcrClientDoc{ID: client.ID, Client: *client, CreatedAt: now, CreatedIP: strings.Clone(ip)}
	if _, err := s.clients.InsertOne(c.UserContext(), doc, options.InsertOne()); err != nil {
		slog.Error("mcp oauth: register client failed", "error", err)
		return writeOAuthError(c, newOAuthError(http.StatusInternalServerError, "server_error", ""))
	}
	return c.Status(http.StatusCreated).JSON(registrationResponse{
		ClientID:                client.ID,
		ClientIDIssuedAt:        now.Unix(),
		ClientName:              client.Name,
		ClientURI:               client.URI,
		LogoURI:                 client.LogoURI,
		RedirectURIs:            client.RedirectURIs,
		GrantTypes:              []string{"authorization_code", "refresh_token"},
		ResponseTypes:           []string{"code"},
		TokenEndpointAuthMethod: "none",
	})
}
