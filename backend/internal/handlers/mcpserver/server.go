package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/oauth"
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

const (
	timezoneExtraKey  = "timezone"
	principalExtraKey = "principal"
	oauthTokenPrefix  = "kdr_at_"
)

const instructions = `Kindred is a task manager. Data is organized as workspace -> category -> task.
A workspace is a named group (for example "Personal" or "School"). Each workspace holds categories, and every task lives in exactly one category.
Call list_workspaces or list_categories first to learn the category ids, then create_task with a category_id.
If no category fits, create_category inside an existing workspace; create_workspace only when the user wants a new top-level area.
complete_task marks a task done the same way the app does, which updates the user's streak, points and rings. Only complete a task when the user explicitly says that task is done; never infer completion from context.
Tasks you create are private. Only make a task public when the user explicitly asks to share it with friends.
Only the tools this connection was granted are listed. Dates are interpreted in the user's timezone unless they include an explicit offset.`

// Authenticator resolves a raw personal access token to the principal it acts as.
type Authenticator interface {
	AuthenticatePrincipal(ctx context.Context, raw string) (*oauth.Principal, error)
}

// OAuthVerifier is the part of oauth.Service the resource server needs.
type OAuthVerifier interface {
	Enabled() bool
	ResourceMetadataURL() string
	VerifyAccessToken(ctx context.Context, raw string) (*oauth.Principal, error)
}

// Mount registers the MCP endpoint on the Fiber app.
func Mount(app *fiber.App, collections map[string]*mongo.Collection, ringService *rings.RingService, authn Authenticator, oauthService *oauth.Service) {
	var verifier OAuthVerifier
	if oauthService != nil {
		verifier = oauthService
	}
	h := NewHandler(collections, ringService, authn, verifier)
	app.All(Path, func(c *fiber.Ctx) error {
		// fasthttp's RequestCtx reports itself canceled outside a running server, so use Fiber's user context.
		ctx := c.UserContext()
		return adaptor.HTTPHandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h.ServeHTTP(w, r.WithContext(ctx))
		})(c)
	})
}

// NewHandler builds the authenticated, stateless streamable HTTP handler.
func NewHandler(collections map[string]*mongo.Collection, ringService *rings.RingService, authn Authenticator, oauthService OAuthVerifier) http.Handler {
	return newHandler(newTools(collections, ringService, defaultLimits), authn, oauthService, collections["users"], defaultLimits)
}

func newHandler(t *tools, authn Authenticator, oauthService OAuthVerifier, users *mongo.Collection, l limits) http.Handler {
	servers := newServerCache(t)
	streamable := mcp.NewStreamableHTTPHandler(servers.forRequest, &mcp.StreamableHTTPOptions{
		Stateless:    true,
		JSONResponse: true,
	})
	limited := withRateLimit(newRequestLimiter(l.requestsPerMinute, time.Minute), streamable)
	bearer := mcpauth.RequireBearerToken(tokenVerifier(authn, oauthService, users), &mcpauth.RequireBearerTokenOptions{AllowMissingExpiration: true})
	return withAuthChallenge(oauthService, bearer(limited))
}

// serverCache holds one MCP server per granted scope combination, so each agent only sees tools it may call.
type serverCache struct {
	tools   *tools
	mu      sync.Mutex
	servers map[string]*mcp.Server
}

func newServerCache(t *tools) *serverCache {
	return &serverCache{tools: t, servers: map[string]*mcp.Server{}}
}

func (c *serverCache) forRequest(r *http.Request) *mcp.Server {
	var scopes []string
	if p := principalFromInfo(mcpauth.TokenInfoFromContext(r.Context())); p != nil {
		scopes = p.Scopes
	}
	return c.forScopes(scopes)
}

func (c *serverCache) forScopes(scopes []string) *mcp.Server {
	var granted []string
	for _, s := range oauth.AllScopes() {
		if slices.Contains(scopes, s) {
			granted = append(granted, s)
		}
	}
	key := strings.Join(granted, " ")
	c.mu.Lock()
	defer c.mu.Unlock()
	if s, ok := c.servers[key]; ok {
		return s
	}
	s := newMCPServer(c.tools, granted)
	c.servers[key] = s
	return s
}

func newMCPServer(t *tools, scopes []string) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{Name: "kindred", Title: "Kindred", Version: "1.0.0"}, &mcp.ServerOptions{
		Instructions: instructions,
		Capabilities: &mcp.ServerCapabilities{Tools: &mcp.ToolCapabilities{}},
	})
	t.register(server, scopes)
	return server
}

// tokenVerifier routes OAuth access tokens and PATs to their verifiers and attaches the principal and timezone.
func tokenVerifier(authn Authenticator, oauthService OAuthVerifier, users *mongo.Collection) mcpauth.TokenVerifier {
	return func(ctx context.Context, token string, _ *http.Request) (*mcpauth.TokenInfo, error) {
		var (
			p   *oauth.Principal
			err error
		)
		if strings.HasPrefix(token, oauthTokenPrefix) {
			if oauthService == nil || !oauthService.Enabled() {
				return nil, fmt.Errorf("%w: oauth is not enabled", mcpauth.ErrInvalidToken)
			}
			p, err = oauthService.VerifyAccessToken(ctx, token)
		} else {
			p, err = authn.AuthenticatePrincipal(ctx, token)
		}
		if errors.Is(err, ErrInvalidToken) || errors.Is(err, oauth.ErrInvalidToken) {
			return nil, fmt.Errorf("%w: unknown, expired or revoked token", mcpauth.ErrInvalidToken)
		}
		if err != nil {
			slog.ErrorContext(ctx, "MCP token authentication failed", "error", err)
			return nil, errors.New("authentication unavailable")
		}
		if p == nil || p.UserID.IsZero() {
			return nil, fmt.Errorf("%w: token has no owner", mcpauth.ErrInvalidToken)
		}
		return &mcpauth.TokenInfo{
			Scopes:     p.Scopes,
			Expiration: p.ExpiresAt,
			UserID:     p.UserID.Hex(),
			Extra: map[string]any{
				principalExtraKey: p,
				timezoneExtraKey:  lookupTimezone(ctx, users, p.UserID),
			},
		}, nil
	}
}

func principalFromInfo(info *mcpauth.TokenInfo) *oauth.Principal {
	if info == nil {
		return nil
	}
	p, _ := info.Extra[principalExtraKey].(*oauth.Principal)
	return p
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

// withAuthChallenge sets the WWW-Authenticate header on every 401: RFC 9728 metadata when OAuth is on, a realm otherwise.
func withAuthChallenge(oauthService OAuthVerifier, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(&challengeWriter{ResponseWriter: w, challenge: challengeFor(oauthService, r)}, r)
	})
}

func challengeFor(oauthService OAuthVerifier, r *http.Request) string {
	if oauthService == nil || !oauthService.Enabled() {
		return `Bearer realm="kindred", error="invalid_token"`
	}
	params := []string{
		fmt.Sprintf("resource_metadata=%q", oauthService.ResourceMetadataURL()),
		fmt.Sprintf("scope=%q", strings.Join(oauth.AllScopes(), " ")),
	}
	if strings.TrimSpace(r.Header.Get("Authorization")) != "" {
		params = append(params, `error="invalid_token"`)
	}
	return "Bearer " + strings.Join(params, ", ")
}

type challengeWriter struct {
	http.ResponseWriter
	challenge string
}

func (c *challengeWriter) WriteHeader(code int) {
	if code == http.StatusUnauthorized {
		c.Header().Set("WWW-Authenticate", c.challenge)
	}
	c.ResponseWriter.WriteHeader(code)
}

func (c *challengeWriter) Unwrap() http.ResponseWriter { return c.ResponseWriter }

// caller is the authenticated principal a tool call acts on behalf of.
type caller struct {
	userID    primitive.ObjectID
	principal *oauth.Principal
	timezone  string
	loc       *time.Location
}

func callerFrom(req *mcp.CallToolRequest) (caller, error) {
	if req == nil || req.Extra == nil || req.Extra.TokenInfo == nil {
		return caller{}, errors.New("not authenticated")
	}
	info := req.Extra.TokenInfo
	p := principalFromInfo(info)
	if p == nil || p.UserID.IsZero() || p.UserID.Hex() != info.UserID {
		return caller{}, errors.New("not authenticated")
	}
	tz, _ := info.Extra[timezoneExtraKey].(string)
	loc, err := time.LoadLocation(tz)
	if tz == "" || err != nil {
		tz, loc = "UTC", time.UTC
	}
	return caller{userID: p.UserID, principal: p, timezone: tz, loc: loc}, nil
}

func (c caller) can(scope string) bool {
	return c.principal != nil && slices.Contains(c.principal.Scopes, scope)
}
