package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	mcpauth "github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Path is where the MCP endpoint is mounted. It sits outside /v1/user so the JWT middleware skips it.
const Path = "/v1/mcp"

const timezoneExtraKey = "timezone"

const instructions = `Kindred is a task manager. Data is organized as workspace -> category -> task.
A workspace is a named group (for example "Personal" or "School"). Each workspace holds categories, and every task lives in exactly one category.
Call list_workspaces or list_categories first to learn the category ids, then create_task with a category_id.
If no category fits, create_category inside an existing workspace; create_workspace only when the user wants a new top-level area.
complete_task marks a task done the same way the app does, which updates the user's streak, points and rings. Only complete tasks the user says are finished.
Dates are interpreted in the user's timezone unless they include an explicit offset.`

// Authenticator resolves a raw personal access token to its owner.
type Authenticator interface {
	Authenticate(ctx context.Context, raw string) (primitive.ObjectID, error)
}

// Mount registers the MCP endpoint on the Fiber app.
func Mount(app *fiber.App, collections map[string]*mongo.Collection, ringService *rings.RingService, authn Authenticator) {
	app.All(Path, adaptor.HTTPHandler(NewHandler(collections, ringService, authn)))
}

// NewHandler builds the authenticated, stateless streamable HTTP handler.
func NewHandler(collections map[string]*mongo.Collection, ringService *rings.RingService, authn Authenticator) http.Handler {
	server := newMCPServer(newTools(collections, ringService))
	return serve(server, tokenVerifier(authn, collections["users"]))
}

func serve(server *mcp.Server, verifier mcpauth.TokenVerifier) http.Handler {
	streamable := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return server }, &mcp.StreamableHTTPOptions{
		Stateless:    true,
		JSONResponse: true,
	})
	bearer := mcpauth.RequireBearerToken(verifier, &mcpauth.RequireBearerTokenOptions{AllowMissingExpiration: true})
	return withAuthChallenge(bearer(streamable))
}

func newMCPServer(t *tools) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{Name: "kindred", Title: "Kindred", Version: "1.0.0"}, &mcp.ServerOptions{
		Instructions: instructions,
		Capabilities: &mcp.ServerCapabilities{},
	})
	t.register(server)
	return server
}

// tokenVerifier authenticates the PAT and attaches the owner and their timezone for tool handlers.
func tokenVerifier(authn Authenticator, users *mongo.Collection) mcpauth.TokenVerifier {
	return func(ctx context.Context, token string, _ *http.Request) (*mcpauth.TokenInfo, error) {
		userID, err := authn.Authenticate(ctx, token)
		if errors.Is(err, ErrInvalidToken) {
			return nil, fmt.Errorf("%w: unknown or revoked token", mcpauth.ErrInvalidToken)
		}
		if err != nil {
			slog.ErrorContext(ctx, "MCP token authentication failed", "error", err)
			return nil, errors.New("authentication unavailable")
		}
		return &mcpauth.TokenInfo{
			UserID: userID.Hex(),
			Extra:  map[string]any{timezoneExtraKey: lookupTimezone(ctx, users, userID)},
		}, nil
	}
}

func lookupTimezone(ctx context.Context, users *mongo.Collection, userID primitive.ObjectID) string {
	if users == nil {
		return "UTC"
	}
	var doc struct {
		Timezone string `bson:"timezone"`
	}
	err := users.FindOne(ctx, bson.M{"_id": userID}, options.FindOne().SetProjection(bson.M{"timezone": 1})).Decode(&doc)
	if err != nil || doc.Timezone == "" {
		return "UTC"
	}
	if _, err := time.LoadLocation(doc.Timezone); err != nil {
		return "UTC"
	}
	return doc.Timezone
}

// withAuthChallenge adds a WWW-Authenticate header to every 401 so clients know to send a bearer token.
func withAuthChallenge(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(&challengeWriter{ResponseWriter: w}, r)
	})
}

type challengeWriter struct {
	http.ResponseWriter
}

func (c *challengeWriter) WriteHeader(code int) {
	if code == http.StatusUnauthorized && c.Header().Get("WWW-Authenticate") == "" {
		c.Header().Set("WWW-Authenticate", `Bearer realm="kindred", error="invalid_token"`)
	}
	c.ResponseWriter.WriteHeader(code)
}

func (c *challengeWriter) Unwrap() http.ResponseWriter { return c.ResponseWriter }

// caller is the authenticated user a tool call acts on behalf of.
type caller struct {
	userID   primitive.ObjectID
	timezone string
	loc      *time.Location
}

func callerFrom(req *mcp.CallToolRequest) (caller, error) {
	if req == nil || req.Extra == nil || req.Extra.TokenInfo == nil {
		return caller{}, errors.New("not authenticated")
	}
	info := req.Extra.TokenInfo
	userID, err := primitive.ObjectIDFromHex(info.UserID)
	if err != nil {
		return caller{}, errors.New("not authenticated")
	}
	tz, _ := info.Extra[timezoneExtraKey].(string)
	loc, err := time.LoadLocation(tz)
	if tz == "" || err != nil {
		tz, loc = "UTC", time.UTC
	}
	return caller{userID: userID, timezone: tz, loc: loc}, nil
}
