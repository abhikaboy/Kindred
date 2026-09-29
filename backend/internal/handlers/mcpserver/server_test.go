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

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type fakeAuth struct {
	user primitive.ObjectID
	err  error
	got  string
}

func (f *fakeAuth) Authenticate(_ context.Context, raw string) (primitive.ObjectID, error) {
	f.got = raw
	return f.user, f.err
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
	authn := &fakeAuth{user: primitive.NewObjectID()}
	h := serve(newMCPServer(&tools{}), tokenVerifier(authn, nil))

	rec := postMCP(t, h, "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Header().Get("WWW-Authenticate"), "Bearer")
	assert.Empty(t, authn.got, "authenticator must not run without a bearer token")
}

func TestHandler_RejectsInvalidToken(t *testing.T) {
	authn := &fakeAuth{err: ErrInvalidToken}
	h := serve(newMCPServer(&tools{}), tokenVerifier(authn, nil))

	rec := postMCP(t, h, "Bearer kdr_nope")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Header().Get("WWW-Authenticate"), "Bearer")
	assert.Equal(t, "kdr_nope", authn.got, "authenticator receives the bare token")
}

func TestHandler_AuthBackendFailureIsNot401(t *testing.T) {
	authn := &fakeAuth{err: errors.New("mongo down")}
	h := serve(newMCPServer(&tools{}), tokenVerifier(authn, nil))

	rec := postMCP(t, h, "Bearer kdr_whatever")
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.NotContains(t, rec.Body.String(), "mongo down")
}

func TestHandler_AuthenticatedClientListsTools(t *testing.T) {
	authn := &fakeAuth{user: primitive.NewObjectID()}
	srv := httptest.NewServer(serve(newMCPServer(&tools{}), tokenVerifier(authn, nil)))
	defer srv.Close()

	session := connectClient(t, srv.URL, "kdr_test")
	assert.Contains(t, session.InitializeResult().Instructions, "workspace -> category -> task")

	res, err := session.ListTools(context.Background(), nil)
	require.NoError(t, err)
	var names []string
	for _, tool := range res.Tools {
		names = append(names, tool.Name)
		assert.NotEmpty(t, tool.Description)
		assert.NotNil(t, tool.InputSchema)
	}
	sort.Strings(names)
	assert.Equal(t, []string{
		"complete_task", "create_category", "create_task", "create_workspace",
		"list_categories", "list_tasks", "list_workspaces",
	}, names)
	assert.Equal(t, "kdr_test", authn.got)
}

func TestCallerFrom(t *testing.T) {
	_, err := callerFrom(&mcp.CallToolRequest{})
	assert.Error(t, err)
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
