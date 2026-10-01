package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	registrationCIMD = "cimd"
	registrationDCR  = "dcr"

	maxRedirectURIs      = 20
	maxURILength         = 2048
	maxClientNameRunes   = 80
	clientCacheMaxSize   = 1000
	negativeClientTTL    = time.Minute
	maxClientIDURLLength = 2048
)

// Client is a resolved OAuth client, whatever its registration method.
type Client struct {
	ID           string   `bson:"id" json:"id"`
	Name         string   `bson:"name" json:"name"`
	URI          string   `bson:"uri,omitempty" json:"uri,omitempty"`
	LogoURI      string   `bson:"logo_uri,omitempty" json:"logo_uri,omitempty"`
	RedirectURIs []string `bson:"redirect_uris" json:"redirect_uris"`
	Registration string   `bson:"registration" json:"registration"`
	Verified     bool     `bson:"verified" json:"verified"`
}

// clientError carries a message that is safe to show on the error page.
type clientError struct{ msg string }

func (e *clientError) Error() string { return e.msg }

func clientErrorf(format string, args ...any) error {
	return &clientError{msg: fmt.Sprintf(format, args...)}
}

// clientMetadata is the subset of RFC 7591 / CIMD fields Kindred reads.
type clientMetadata struct {
	ClientID                string   `json:"client_id"`
	ClientName              string   `json:"client_name"`
	ClientURI               string   `json:"client_uri"`
	LogoURI                 string   `json:"logo_uri"`
	RedirectURIs            []string `json:"redirect_uris"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	ClientSecret            string   `json:"client_secret"`
}

// validateMetadata checks the rules shared by CIMD and DCR and returns a cleaned client.
func validateMetadata(m *clientMetadata) (*Client, error) {
	if m.ClientSecret != "" {
		return nil, clientErrorf("client metadata must not include a client_secret")
	}
	if m.TokenEndpointAuthMethod != "" && m.TokenEndpointAuthMethod != "none" {
		return nil, clientErrorf("only public clients are supported (token_endpoint_auth_method must be none)")
	}
	if len(m.GrantTypes) > 0 && !slices.Contains(m.GrantTypes, "authorization_code") {
		return nil, clientErrorf("grant_types must include authorization_code")
	}
	if len(m.ResponseTypes) > 0 && !slices.Contains(m.ResponseTypes, "code") {
		return nil, clientErrorf("response_types must include code")
	}
	if len(m.RedirectURIs) == 0 {
		return nil, clientErrorf("redirect_uris must not be empty")
	}
	if len(m.RedirectURIs) > maxRedirectURIs {
		return nil, clientErrorf("too many redirect_uris")
	}
	for _, r := range m.RedirectURIs {
		if !validRedirectURI(r) {
			return nil, clientErrorf("redirect_uri %q must be https or an http loopback address", truncate(r, 200))
		}
	}
	return &Client{
		Name:         cleanName(m.ClientName),
		URI:          httpsURLOrEmpty(m.ClientURI),
		LogoURI:      httpsURLOrEmpty(m.LogoURI),
		RedirectURIs: slices.Clone(m.RedirectURIs),
	}, nil
}

func cleanName(raw string) string {
	fields := strings.FieldsFunc(raw, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) })
	name := []rune(strings.Join(fields, " "))
	if len(name) > maxClientNameRunes {
		name = name[:maxClientNameRunes]
	}
	return string(name)
}

func httpsURLOrEmpty(raw string) string {
	if raw == "" || len(raw) > maxURILength {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
		return ""
	}
	return u.String()
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func validRedirectURI(raw string) bool {
	if raw == "" || len(raw) > maxURILength {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Fragment != "" || strings.Contains(raw, "#") || u.User != nil || u.Host == "" || u.Opaque != "" {
		return false
	}
	switch u.Scheme {
	case "https":
		return true
	case "http":
		return isLoopbackHost(u.Hostname())
	}
	return false
}

// redirectMatches is exact, except loopback redirects match on any port (RFC 8252 7.3).
func redirectMatches(registered []string, requested string) bool {
	if slices.Contains(registered, requested) {
		return true
	}
	req, err := url.Parse(requested)
	if err != nil || req.Scheme != "http" || !isLoopbackHost(req.Hostname()) || req.User != nil || req.Fragment != "" {
		return false
	}
	for _, r := range registered {
		reg, err := url.Parse(r)
		if err != nil || reg.Scheme != "http" || !isLoopbackHost(reg.Hostname()) {
			continue
		}
		if strings.EqualFold(reg.Hostname(), req.Hostname()) && reg.EscapedPath() == req.EscapedPath() && reg.RawQuery == req.RawQuery {
			return true
		}
	}
	return false
}

// isCIMDClientID reports whether client_id is an https URL with a path (a CIMD client).
func isCIMDClientID(id string) bool {
	if len(id) > maxClientIDURLLength || !strings.HasPrefix(id, "https://") {
		return false
	}
	u, err := url.Parse(id)
	if err != nil || u.Host == "" || u.User != nil || u.Fragment != "" || strings.Contains(id, "#") {
		return false
	}
	if u.Path == "" || u.Path == "/" {
		return false
	}
	for _, seg := range strings.Split(u.Path, "/") {
		if seg == "." || seg == ".." {
			return false
		}
	}
	return true
}

func hostVerified(host string, verified []string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	for _, v := range verified {
		if host == v || strings.HasSuffix(host, "."+v) {
			return true
		}
	}
	return false
}

// clientHost is the host shown to the user: the client_id host for CIMD, the redirect host for DCR.
func clientHost(c *Client, redirectURI string) string {
	source := c.ID
	if c.Registration != registrationCIMD {
		source = redirectURI
		if source == "" && len(c.RedirectURIs) > 0 {
			source = c.RedirectURIs[0]
		}
	}
	u, err := url.Parse(source)
	if err != nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

type cachedClient struct {
	client  *Client
	err     error
	expires time.Time
}

type clientResolver struct {
	fetcher       *metadataFetcher
	dcr           *mongo.Collection
	allowDCR      bool
	verifiedHosts []string
	now           func() time.Time

	mu    sync.Mutex
	cache map[string]cachedClient
}

func newClientResolver(p FetchPolicy, dcr *mongo.Collection, allowDCR bool, verifiedHosts []string) *clientResolver {
	return &clientResolver{
		fetcher:       newMetadataFetcher(p),
		dcr:           dcr,
		allowDCR:      allowDCR,
		verifiedHosts: verifiedHosts,
		now:           time.Now,
		cache:         map[string]cachedClient{},
	}
}

// Resolve returns the client for client_id. Errors of type *clientError are user-presentable.
func (r *clientResolver) Resolve(ctx context.Context, clientID string) (*Client, error) {
	switch {
	case isCIMDClientID(clientID):
		return r.resolveCIMD(ctx, clientID)
	case strings.HasPrefix(clientID, dcrClientPrefix):
		return r.resolveDCR(ctx, clientID)
	}
	return nil, clientErrorf("This app is not registered with Kindred.")
}

func (r *clientResolver) resolveCIMD(ctx context.Context, clientID string) (*Client, error) {
	now := r.now()
	r.mu.Lock()
	entry, ok := r.cache[clientID]
	r.mu.Unlock()
	if ok && now.Before(entry.expires) {
		return entry.client, entry.err
	}

	client, ttl, err := r.fetchCIMD(ctx, clientID)
	if err != nil {
		var ce *clientError
		if !errors.As(err, &ce) {
			slog.Warn("mcp oauth: client metadata fetch failed", "clientId", clientID, "error", err)
			err = clientErrorf("Kindred could not load this app's details. Try again in a minute.")
		}
		ttl = negativeClientTTL
	}
	r.store(strings.Clone(clientID), cachedClient{client: client, err: err, expires: now.Add(ttl)})
	return client, err
}

func (r *clientResolver) fetchCIMD(ctx context.Context, clientID string) (*Client, time.Duration, error) {
	body, ttl, err := r.fetcher.fetch(ctx, clientID)
	if err != nil {
		return nil, 0, err
	}
	client, err := parseCIMD(body, clientID, r.verifiedHosts)
	return client, ttl, err
}

// parseCIMD validates a fetched client metadata document against its URL.
func parseCIMD(body []byte, clientID string, verifiedHosts []string) (*Client, error) {
	var m clientMetadata
	if err := json.Unmarshal(body, &m); err != nil {
		return nil, clientErrorf("This app's client metadata is not valid JSON.")
	}
	if m.ClientID != clientID {
		return nil, clientErrorf("This app's client metadata does not match its client_id.")
	}
	client, err := validateMetadata(&m)
	if err != nil {
		return nil, err
	}
	u, _ := url.Parse(clientID)
	client.ID = clientID
	client.Registration = registrationCIMD
	client.Verified = hostVerified(u.Hostname(), verifiedHosts)
	if client.Name == "" {
		client.Name = strings.ToLower(u.Hostname())
	}
	return client, nil
}

func (r *clientResolver) store(key string, entry cachedClient) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.cache) >= clientCacheMaxSize {
		now := r.now()
		for k, e := range r.cache {
			if now.After(e.expires) {
				delete(r.cache, k)
			}
		}
		if len(r.cache) >= clientCacheMaxSize {
			r.cache = map[string]cachedClient{}
		}
	}
	r.cache[key] = entry
}

type dcrClientDoc struct {
	ID        string    `bson:"_id"`
	Client    Client    `bson:"client"`
	CreatedAt time.Time `bson:"created_at"`
	CreatedIP string    `bson:"created_ip"`
}

func (r *clientResolver) resolveDCR(ctx context.Context, clientID string) (*Client, error) {
	if !r.allowDCR || r.dcr == nil {
		return nil, clientErrorf("This app is not registered with Kindred.")
	}
	var doc dcrClientDoc
	err := r.dcr.FindOne(ctx, bson.M{"_id": clientID}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, clientErrorf("This app is not registered with Kindred.")
	}
	if err != nil {
		return nil, fmt.Errorf("lookup client: %w", err)
	}
	c := doc.Client
	c.Verified = false
	return &c, nil
}
