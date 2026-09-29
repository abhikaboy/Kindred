package mcpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TokenMetadata struct {
	ID         string     `json:"id" example:"507f1f77bcf86cd799439011"`
	Name       string     `json:"name" example:"Claude Desktop"`
	Prefix     string     `json:"prefix" example:"kdr_AbCdEfGh"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
}

type CreateTokenParams struct {
	Name string `json:"name" minLength:"1" maxLength:"64" example:"Claude Desktop"`
}

type CreateTokenInput struct {
	Authorization string            `header:"Authorization" required:"true"`
	Body          CreateTokenParams `json:"body"`
}

type CreateTokenOutput struct {
	Body struct {
		Token string        `json:"token" doc:"Raw token. Shown only once; store it securely."`
		Meta  TokenMetadata `json:"metadata"`
	}
}

type ListTokensInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type ListTokensOutput struct {
	Body []TokenMetadata `json:"body"`
}

type RevokeTokenInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type RevokeTokenOutput struct {
	Body struct {
		Message string `json:"message" example:"Token revoked"`
	}
}

type tokenHandler struct {
	service *TokenService
}

func RegisterTokenRoutes(api huma.API, s *TokenService) {
	h := &tokenHandler{service: s}

	huma.Register(api, huma.Operation{
		OperationID: "create-mcp-token",
		Method:      http.MethodPost,
		Path:        "/v1/user/mcp-tokens",
		Summary:     "Create MCP access token",
		Description: "Mint a personal access token for the MCP server. The raw token is returned only once.",
		Tags:        []string{"mcp"},
	}, h.Create)

	huma.Register(api, huma.Operation{
		OperationID: "list-mcp-tokens",
		Method:      http.MethodGet,
		Path:        "/v1/user/mcp-tokens",
		Summary:     "List MCP access tokens",
		Tags:        []string{"mcp"},
	}, h.List)

	huma.Register(api, huma.Operation{
		OperationID: "revoke-mcp-token",
		Method:      http.MethodDelete,
		Path:        "/v1/user/mcp-tokens/{id}",
		Summary:     "Revoke MCP access token",
		Tags:        []string{"mcp"},
	}, h.Revoke)
}

func tokenCallerID(ctx context.Context) (primitive.ObjectID, error) {
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return primitive.NilObjectID, huma.Error401Unauthorized("Authentication required", err)
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return primitive.NilObjectID, huma.Error400BadRequest("Invalid user ID", err)
	}
	return userID, nil
}

func toTokenMetadata(d *TokenDocument) TokenMetadata {
	return TokenMetadata{
		ID:         d.ID.Hex(),
		Name:       d.Name,
		Prefix:     d.Prefix,
		CreatedAt:  d.CreatedAt,
		LastUsedAt: d.LastUsedAt,
	}
}

func (h *tokenHandler) Create(ctx context.Context, input *CreateTokenInput) (*CreateTokenOutput, error) {
	userID, err := tokenCallerID(ctx)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Body.Name)
	if name == "" || len(name) > maxTokenNameLen {
		return nil, huma.Error400BadRequest("Token name must be 1 to 64 characters")
	}

	raw, doc, err := h.service.Create(ctx, userID, name)
	if errors.Is(err, ErrTokenLimit) {
		return nil, huma.Error409Conflict("You can have at most 10 MCP tokens. Revoke one to create another.")
	}
	if err != nil {
		slog.Error("unable to create mcp token", "userId", userID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to create token. Please try again.", err)
	}

	resp := &CreateTokenOutput{}
	resp.Body.Token = raw
	resp.Body.Meta = toTokenMetadata(doc)
	return resp, nil
}

func (h *tokenHandler) List(ctx context.Context, _ *ListTokensInput) (*ListTokensOutput, error) {
	userID, err := tokenCallerID(ctx)
	if err != nil {
		return nil, err
	}
	docs, err := h.service.List(ctx, userID)
	if err != nil {
		slog.Error("unable to list mcp tokens", "userId", userID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load tokens. Please try again.", err)
	}

	out := make([]TokenMetadata, 0, len(docs))
	for i := range docs {
		out = append(out, toTokenMetadata(&docs[i]))
	}
	return &ListTokensOutput{Body: out}, nil
}

func (h *tokenHandler) Revoke(ctx context.Context, input *RevokeTokenInput) (*RevokeTokenOutput, error) {
	userID, err := tokenCallerID(ctx)
	if err != nil {
		return nil, err
	}
	tokenID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid token ID", err)
	}

	err = h.service.Revoke(ctx, userID, tokenID)
	if errors.Is(err, ErrTokenNotFound) {
		return nil, huma.Error404NotFound("Token not found")
	}
	if err != nil {
		slog.Error("unable to revoke mcp token", "userId", userID.Hex(), "tokenId", input.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to revoke token. Please try again.", err)
	}

	resp := &RevokeTokenOutput{}
	resp.Body.Message = "Token revoked"
	return resp, nil
}
