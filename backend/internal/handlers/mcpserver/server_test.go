package mcpserver

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/oauth"
	mcpauth "github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func patPrincipal(scopes ...string) *oauth.Principal {
	if len(scopes) == 0 {
		scopes = oauth.AllScopes()
	}
	return &oauth.Principal{
		UserID:       primitive.NewObjectID(),
		ConnectionID: primitive.NewObjectID(),
		Kind:         "pat",
		ClientName:   "Test",
		Scopes:       scopes,
	}
}

type fakeAuth struct {
	principal *oauth.Principal
	err       error
	got       string
}

func (f *fakeAuth) AuthenticatePrincipal(_ context.Context, raw string) (*oauth.Principal, error) {
	f.got = raw
	return f.principal, f.err
}

type fakeOAuth struct {
	enabled   bool
	principal *oauth.Principal
	err       error
	got       string
}

const testMetadataURL = "https://api.example.com/.well-known/oauth-protected-resource/v1/mcp"

func (f *fakeOAuth) Enabled() bool               { return f.enabled }
func (f *fakeOAuth) ResourceMetadataURL() string { return testMetadataURL }
func (f *fakeOAuth) VerifyAccessToken(_ context.Context, raw string) (*oauth.Principal, error) {
	f.got = raw
	return f.principal, f.err
}

func testHandler(authn Authenticator, o OAuthVerifier) http.Handler {
	return newHandler(&tools{}, authn, o, nil, defaultLimits)
}

// bearerTransport adds a fixed Authorization header to every request.
type bearerTransport struct{ token string }

func (b bearerTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("Authorization", "Bearer "+b.token)
	return http.DefaultTransport.RoundTrip(r)
}

func connectClient(t *testing.T, url, token string) *mcp.ClientSession {
	t.Helper()
	client := mcp.NewClient(&mcp.Implementation{Name: "test-client", Version: "1.0.0"}, nil)
	transport := &mcp.StreamableClientTransport{
		Endpoint:             url,
		HTTPClient:           &http.Client{Transport: bearerTransport{token: token}, Timeout: 30 * time.Second},
		DisableStandaloneSSE: true,
	}
	session, err := client.Connect(context.Background(), transport, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = session.Close() })
	return session
}

func toolNames(t *testing.T, session *mcp.ClientSession) []string {
	t.Helper()
	res, err := session.ListTools(context.Background(), nil)
	require.NoError(t, err)
	names := []string{}
	for _, tool := range res.Tools {
		names = append(names, tool.Name)
	}
	sort.Strings(names)
	return names
}

const initializeBody = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}`

func postMCP(t *testing.T, h http.Handler, authHeader string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(initializeBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHandler_RejectsMissingToken(t *testing.T) {
	authn := &fakeAuth{principal: patPrincipal()}
	rec := postMCP(t, testHandler(authn, nil), "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, `Bearer realm="kindred", error="invalid_token"`, rec.Header().Get("WWW-Authenticate"))
	assert.Empty(t, authn.got, "authenticator must not run without a bearer token")
}

func TestHandler_RejectsInvalidToken(t *testing.T) {
	authn := &fakeAuth{err: ErrInvalidToken}
	rec := postMCP(t, testHandler(authn, nil), "Bearer kdr_nope")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Header().Get("WWW-Authenticate"), "Bearer")
	assert.Equal(t, "kdr_nope", authn.got, "authenticator receives the bare token")
}

func TestHandler_OAuthChallenge(t *testing.T) {
	o := &fakeOAuth{enabled: true, err: oauth.ErrInvalidToken}
	h := testHandler(&fakeAuth{err: ErrInvalidToken}, o)
	scope := `scope="kindred:read kindred:write kindred:complete"`

	rec := postMCP(t, h, "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, `Bearer resource_metadata="`+testMetadataURL+`", `+scope, rec.Header().Get("WWW-Authenticate"))

	rec = postMCP(t, h, "Bearer kdr_at_bogus")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, `Bearer resource_metadata="`+testMetadataURL+`", `+scope+`, error="invalid_token"`, rec.Header().Get("WWW-Authenticate"))
	assert.Len(t, rec.Header().Values("WWW-Authenticate"), 1)
	assert.Equal(t, "kdr_at_bogus", o.got)
}

func TestHandler_RoutesByPrefix(t *testing.T) {
	authn := &fakeAuth{principal: patPrincipal()}
	o := &fakeOAuth{enabled: true, principal: &oauth.Principal{
		UserID: primitive.NewObjectID(), ConnectionID: primitive.NewObjectID(), Kind: "oauth",
		ClientID: "c1", Scopes: []string{oauth.ScopeRead}, ExpiresAt: time.Now().Add(time.Hour),
	}}
	srv := httptest.NewServer(testHandler(authn, o))
	defer srv.Close()

	session := connectClient(t, srv.URL, "kdr_at_abc")
	assert.Equal(t, []string{"list_categories", "list_tasks", "list_workspaces"}, toolNames(t, session))
	assert.Equal(t, "kdr_at_abc", o.got)
	assert.Empty(t, authn.got, "OAuth tokens never reach the PAT service")

	rec := postMCP(t, testHandler(authn, &fakeOAuth{enabled: false}), "Bearer kdr_at_abc")
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "OAuth tokens are refused when OAuth is off")
}

func TestHandler_ExpiredPrincipalRejected(t *testing.T) {
	p := patPrincipal()
	p.ExpiresAt = time.Now().Add(-time.Minute)
	rec := postMCP(t, testHandler(&fakeAuth{principal: p}, nil), "Bearer kdr_x")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestHandler_AuthBackendFailureIsNot401(t *testing.T) {
	authn := &fakeAuth{err: errors.New("mongo down")}
	rec := postMCP(t, testHandler(authn, nil), "Bearer kdr_whatever")
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.NotContains(t, rec.Body.String(), "mongo down")
}

func TestHandler_ToolsListPerScope(t *testing.T) {
	all := []string{
		"complete_task", "create_category", "create_task", "create_workspace",
		"list_categories", "list_tasks", "list_workspaces",
	}
	cases := []struct {
		scopes []string
		want   []string
	}{
		{oauth.AllScopes(), all},
		{[]string{oauth.ScopeRead}, []string{"list_categories", "list_tasks", "list_workspaces"}},
		{[]string{oauth.ScopeWrite}, []string{"create_category", "create_task", "create_workspace"}},
		{[]string{oauth.ScopeComplete}, []string{"complete_task"}},
		{[]string{oauth.ScopeComplete, oauth.ScopeRead}, []string{"complete_task", "list_categories", "list_tasks", "list_workspaces"}},
		{[]string{"unknown:scope"}, []string{}},
	}
	for _, tc := range cases {
		authn := &fakeAuth{principal: patPrincipal(tc.scopes...)}
		srv := httptest.NewServer(testHandler(authn, nil))
		session := connectClient(t, srv.URL, "kdr_test")
		assert.Equal(t, tc.want, toolNames(t, session), "scopes %v", tc.scopes)
		if len(tc.want) == len(all) {
			assert.Contains(t, session.InitializeResult().Instructions, "workspace -> category -> task")
			assert.Contains(t, session.InitializeResult().Instructions, "explicitly says that task is done")
		}
		srv.Close()
	}
}

func TestServerCache_OnePerScopeSet(t *testing.T) {
	c := newServerCache(&tools{})
	a := c.forScopes([]string{oauth.ScopeWrite, oauth.ScopeRead})
	b := c.forScopes([]string{oauth.ScopeRead, oauth.ScopeWrite, oauth.ScopeRead})
	assert.Same(t, a, b)
	assert.NotSame(t, a, c.forScopes([]string{oauth.ScopeRead}))
	assert.Len(t, c.servers, 2)
}

func toolRequest(p *oauth.Principal) *mcp.CallToolRequest {
	return &mcp.CallToolRequest{Extra: &mcp.RequestExtra{TokenInfo: &mcpauth.TokenInfo{
		UserID: p.UserID.Hex(),
		Scopes: p.Scopes,
		Extra:  map[string]any{principalExtraKey: p},
	}}}
}

func TestToolHandlersEnforceScope(t *testing.T) {
	tl := &tools{limits: defaultLimits}
	writeOnly := toolRequest(patPrincipal(oauth.ScopeWrite))

	_, _, err := readTool(tl.listWorkspaces)(context.Background(), writeOnly, listWorkspacesInput{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), oauth.ScopeRead)

	complete := auditedTool(tl, "complete_task", "complete task", oauth.ScopeComplete, tl.completeTask)
	_, _, err = complete(context.Background(), writeOnly, completeTaskInput{TaskID: primitive.NewObjectID().Hex()})
	require.Error(t, err)
	assert.Contains(t, err.Error(), oauth.ScopeComplete)

	readOnly := toolRequest(patPrincipal(oauth.ScopeRead))
	create := auditedTool(tl, "create_task", "create task", oauth.ScopeWrite, tl.createTask)
	_, _, err = create(context.Background(), readOnly, createTaskInput{Content: "x"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), oauth.ScopeWrite)
}

func TestHandler_RateLimitsPerConnection(t *testing.T) {
	p := patPrincipal()
	authn := &fakeAuth{principal: p}
	h := newHandler(&tools{}, authn, nil, nil, limits{requestsPerMinute: 2})

	assert.Equal(t, http.StatusOK, postMCP(t, h, "Bearer kdr_a").Code)
	assert.Equal(t, http.StatusOK, postMCP(t, h, "Bearer kdr_a").Code)
	rec := postMCP(t, h, "Bearer kdr_a")
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.NotEmpty(t, rec.Header().Get("Retry-After"))

	authn.principal = patPrincipal()
	assert.Equal(t, http.StatusOK, postMCP(t, h, "Bearer kdr_b").Code, "other connections have their own budget")
}

func TestRequestLimiter_Window(t *testing.T) {
	now := time.Date(2026, 9, 30, 12, 0, 0, 0, time.UTC)
	rl := newRequestLimiter(2, time.Minute)
	rl.now = func() time.Time { return now }

	ok, _ := rl.Allow("k")
	assert.True(t, ok)
	ok, _ = rl.Allow("k")
	assert.True(t, ok)
	ok, wait := rl.Allow("k")
	assert.False(t, ok)
	assert.Equal(t, time.Minute, wait)

	now = now.Add(61 * time.Second)
	ok, _ = rl.Allow("k")
	assert.True(t, ok, "a new window resets the count")
}

func TestCallerFrom(t *testing.T) {
	_, err := callerFrom(&mcp.CallToolRequest{})
	assert.Error(t, err)

	p := patPrincipal()
	c, err := callerFrom(toolRequest(p))
	require.NoError(t, err)
	assert.Equal(t, p.UserID, c.userID)
	assert.Same(t, p, c.principal)
	assert.Equal(t, "UTC", c.timezone)

	req := toolRequest(p)
	req.Extra.TokenInfo.UserID = primitive.NewObjectID().Hex()
	_, err = callerFrom(req)
	assert.Error(t, err, "principal and token user must agree")
}

func TestParseWhen(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)

	got, hasTime, err := parseWhen("2026-10-05", ny)
	require.NoError(t, err)
	assert.False(t, hasTime)
	assert.Equal(t, time.Date(2026, 10, 5, 0, 0, 0, 0, ny), *got)

	got, hasTime, err = parseWhen("2026-10-05T14:30", ny)
	require.NoError(t, err)
	assert.True(t, hasTime)
	assert.Equal(t, time.Date(2026, 10, 5, 14, 30, 0, 0, ny).Unix(), got.Unix())

	got, _, err = parseWhen("2026-10-05T14:30:00Z", ny)
	require.NoError(t, err)
	assert.Equal(t, time.Date(2026, 10, 5, 14, 30, 0, 0, time.UTC).Unix(), got.Unix())

	got, _, err = parseWhen("", ny)
	assert.NoError(t, err)
	assert.Nil(t, got)

	_, _, err = parseWhen("next tuesday", ny)
	assert.Error(t, err)

	end, err := parseBound("2026-10-05", ny, true)
	require.NoError(t, err)
	assert.Equal(t, time.Date(2026, 10, 5, 23, 59, 59, 999999999, ny), *end)
}

func TestSortByDeadline(t *testing.T) {
	ts := []taskSummary{
		{ID: "none"},
		{ID: "late", Deadline: "2026-10-09T10:00:00Z"},
		{ID: "soon", Deadline: "2026-10-01T10:00:00-04:00"},
	}
	sortByDeadline(ts)
	assert.Equal(t, []string{"soon", "late", "none"}, []string{ts[0].ID, ts[1].ID, ts[2].ID})
}
