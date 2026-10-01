// Package oauth is the OAuth 2.1 authorization server for the MCP endpoint.
// Users approve connections in the Kindred app; clients register via CIMD or DCR.
package oauth

import (
	"errors"
	"log/slog"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	ScopeRead     = "kindred:read"     // View workspaces, categories and tasks
	ScopeWrite    = "kindred:write"    // Create workspaces, categories and tasks
	ScopeComplete = "kindred:complete" // Mark tasks complete
)

const (
	clientsCollection  = "oauth_clients"
	requestsCollection = "oauth_requests"
	codesCollection    = "oauth_codes"
	tokensCollection   = "oauth_tokens" //nolint:gosec // collection name, not a credential
	grantsCollection   = "oauth_grants"

	accessTokenPrefix  = "kdr_at_"
	refreshTokenPrefix = "kdr_rt_"
	codePrefix         = "kdr_ac_"
	dcrClientPrefix    = "kdr_client_"
	secretBytes        = 32

	accessTokenTTL      = time.Hour
	refreshTokenIdleTTL = 30 * 24 * time.Hour
	codeTTL             = 60 * time.Second
	requestTTL          = 10 * time.Minute
	lastUsedThrottle    = time.Minute
)

var ErrInvalidToken = errors.New("invalid oauth access token")

// Principal is the authenticated agent connection behind an MCP request.
type Principal struct {
	UserID       primitive.ObjectID
	ConnectionID primitive.ObjectID // grant id for OAuth; agent B sets token id for PATs
	Kind         string             // "oauth" or "pat"
	ClientID     string
	ClientName   string
	Scopes       []string
	ExpiresAt    time.Time // zero means no expiry
}

type scopeInfo struct {
	ID          string
	Title       string
	Description string
}

var scopeCatalog = []scopeInfo{
	{ScopeRead, "View your tasks", "See your workspaces, categories and tasks."},
	{ScopeWrite, "Add to Kindred", "Create workspaces, categories and tasks."},
	{ScopeComplete, "Complete tasks", "Mark tasks done. This counts toward your streak and points."},
}

func AllScopes() []string {
	out := make([]string, 0, len(scopeCatalog))
	for _, s := range scopeCatalog {
		out = append(out, s.ID)
	}
	return out
}

func describeScopes(ids []string) []scopeInfo {
	out := []scopeInfo{}
	for _, s := range scopeCatalog {
		if slices.Contains(ids, s.ID) {
			out = append(out, s)
		}
	}
	return out
}

// intersectScopes keeps catalog order so stored and displayed scopes are stable.
func intersectScopes(a, b []string) []string {
	out := []string{}
	for _, s := range AllScopes() {
		if slices.Contains(a, s) && slices.Contains(b, s) {
			out = append(out, s)
		}
	}
	return out
}

type Service struct {
	issuer        string
	issuerPath    string
	secureCookies bool
	allowDCR      bool

	clients  *mongo.Collection
	requests *mongo.Collection
	codes    *mongo.Collection
	tokens   *mongo.Collection
	grants   *mongo.Collection

	resolver *clientResolver
	now      func() time.Time

	authorizeLimiter *rateLimiter
	statusLimiter    *rateLimiter
	tokenLimiter     *rateLimiter
	registerLimiter  *rateLimiter
	byCodeLimiter    *rateLimiter

	touchMu sync.Mutex
	touched map[primitive.ObjectID]time.Time
}

func NewService(collections map[string]*mongo.Collection, cfg config.Config) *Service {
	s := &Service{
		allowDCR:         cfg.MCPOAuth.DCRAllowed(),
		clients:          collection(collections, clientsCollection),
		requests:         collection(collections, requestsCollection),
		codes:            collection(collections, codesCollection),
		tokens:           collection(collections, tokensCollection),
		grants:           collection(collections, grantsCollection),
		now:              time.Now,
		authorizeLimiter: newRateLimiter(60, 10*time.Minute),
		statusLimiter:    newRateLimiter(900, 10*time.Minute),
		tokenLimiter:     newRateLimiter(120, time.Minute),
		registerLimiter:  newRateLimiter(20, time.Hour),
		byCodeLimiter:    newRateLimiter(10, 10*time.Minute),
		touched:          map[primitive.ObjectID]time.Time{},
	}
	if issuer, err := validateIssuer(cfg.MCPOAuth.ResolvedIssuer(cfg.App.Port)); err != nil {
		slog.Error("mcp oauth disabled: invalid MCP_OAUTH_ISSUER", "error", err)
	} else if issuer != nil {
		s.issuer = strings.TrimRight(issuer.String(), "/")
		s.issuerPath = strings.TrimRight(issuer.Path, "/")
		s.secureCookies = issuer.Scheme == "https"
	}
	s.resolver = newClientResolver(DefaultFetchPolicy(), s.clients, s.allowDCR, cfg.MCPOAuth.VerifiedHosts())
	return s
}

func validateIssuer(raw string) (*url.URL, error) {
	if raw == "" {
		return nil, nil
	}
	u, err := url.Parse(raw)
	if err != nil {
		return nil, err
	}
	if (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return nil, errors.New("issuer must be an http(s) URL without query, fragment or userinfo")
	}
	return u, nil
}

func collection(collections map[string]*mongo.Collection, name string) *mongo.Collection {
	if c := collections[name]; c != nil {
		return c
	}
	if users := collections["users"]; users != nil {
		return users.Database().Collection(name)
	}
	return nil
}

// Enabled reports whether an issuer is configured and storage is available.
func (s *Service) Enabled() bool {
	return s != nil && s.issuer != "" && s.tokens != nil && s.grants != nil && s.requests != nil && s.codes != nil
}

func (s *Service) Issuer() string { return s.issuer }

func (s *Service) ResourceURL() string {
	if s.issuer == "" {
		return ""
	}
	return s.issuer + "/v1/mcp"
}

// ResourceMetadataURL is reachable through the /api proxy without extra nginx rules.
func (s *Service) ResourceMetadataURL() string {
	if s.issuer == "" {
		return ""
	}
	return s.issuer + "/.well-known/oauth-protected-resource/v1/mcp"
}

func (s *Service) endpoint(path string) string { return s.issuer + path }
