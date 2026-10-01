package oauth

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humafiber"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const testRedirect = "http://127.0.0.1:43123/callback"

var (
	requestIDPattern = regexp.MustCompile(`request=([A-Za-z0-9_-]{22})`)
	userCodePattern  = regexp.MustCompile(`class="code">([0-9A-Z]{4}-[0-9A-Z]{4})<`)
)

type FlowSuite struct {
	testpkg.BaseSuite
	svc      *Service
	app      *fiber.App
	cimd     *httptest.Server
	clientID string
	issuer   string
	base     string
	http     *http.Client
}

func TestFlow(t *testing.T) {
	suite.Run(t, new(FlowSuite))
}

// newTestApp builds a Fiber app with the OAuth routes and a header-based stand-in for app auth.
func newTestApp(svc *Service) *fiber.App {
	app := fiber.New()
	app.Use("/v1/user", func(c *fiber.Ctx) error {
		uid := c.Get("X-Test-User")
		if uid == "" {
			return c.SendStatus(http.StatusUnauthorized)
		}
		c.Locals(auth.UserIDContextKey, uid)
		return c.Next()
	})
	api := humafiber.New(app, huma.DefaultConfig("test", "1"))
	Routes(app, api, svc)
	return app
}

func (s *FlowSuite) newService(issuer string) *Service {
	cfg := config.Config{}
	cfg.MCPOAuth.Issuer = issuer
	cfg.MCPOAuth.AllowDCR = "true"
	svc := NewService(s.Collections, cfg)
	rootCAs := s.cimd.Client().Transport.(*http.Transport).TLSClientConfig.RootCAs
	svc.resolver = newClientResolver(FetchPolicy{AllowPrivateNetworks: true, RootCAs: rootCAs}, svc.clients, true, []string{"127.0.0.1"})
	return svc
}

func (s *FlowSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.cimd = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"client_id":     s.cimd.URL + r.URL.Path,
			"client_name":   "Test Agent",
			"redirect_uris": []string{"http://127.0.0.1/callback"},
			"grant_types":   []string{"authorization_code", "refresh_token"},
		})
	}))
	s.clientID = s.cimd.URL + "/client.json"
	s.issuer = "http://localhost:8080"
	s.svc = s.newService(s.issuer)
	s.app = newTestApp(s.svc)
	s.base = s.serve(s.app)
	s.http = &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}

// serve runs the app on a real listener; fasthttp contexts outside a running server report canceled.
func (s *FlowSuite) serve(app *fiber.App) string {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	s.Require().NoError(err)
	go func() { _ = app.Listener(ln) }()
	return "http://" + ln.Addr().String()
}

func (s *FlowSuite) TearDownTest() {
	_ = s.app.Shutdown()
	s.cimd.Close()
	s.BaseSuite.TearDownTest()
}

func (s *FlowSuite) do(method, target string, body io.Reader, headers map[string]string) *http.Response {
	req, err := http.NewRequest(method, s.base+target, body)
	s.Require().NoError(err)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := s.http.Do(req)
	s.Require().NoError(err)
	return resp
}

func readBody(resp *http.Response) string {
	b, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	return string(b)
}

func pkcePair() (string, string) {
	verifier := strings.Repeat("v3rifier-", 6)
	sum := sha256.Sum256([]byte(verifier))
	return verifier, base64.RawURLEncoding.EncodeToString(sum[:])
}

func (s *FlowSuite) authorizeQuery(overrides map[string]string) string {
	_, challenge := pkcePair()
	q := url.Values{
		"response_type":         {"code"},
		"client_id":             {s.clientID},
		"redirect_uri":          {testRedirect},
		"state":                 {"st-123"},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
		"resource":              {s.svc.ResourceURL()},
	}
	for k, v := range overrides {
		if v == "" {
			q.Del(k)
		} else {
			q.Set(k, v)
		}
	}
	return "/oauth/authorize?" + q.Encode()
}

type started struct {
	id     string
	code   string
	cookie string
	page   string
}

func (s *FlowSuite) startAuthorize(overrides map[string]string) started {
	resp := s.do(http.MethodGet, s.authorizeQuery(overrides), nil, map[string]string{"User-Agent": "TestBrowser/1.0"})
	page := readBody(resp)
	s.Require().Equal(http.StatusOK, resp.StatusCode, page)
	s.Contains(resp.Header.Get("Content-Security-Policy"), "frame-ancestors 'none'")
	s.Equal("DENY", resp.Header.Get("X-Frame-Options"))
	s.Equal("no-store", resp.Header.Get("Cache-Control"))
	id := requestIDPattern.FindStringSubmatch(page)
	code := userCodePattern.FindStringSubmatch(page)
	s.Require().Len(id, 2)
	s.Require().Len(code, 2)
	var cookie string
	for _, c := range resp.Cookies() {
		if c.Name == bindingCookiePrefix+id[1] {
			s.True(c.HttpOnly)
			s.Equal(http.SameSiteLaxMode, c.SameSite)
			cookie = c.Name + "=" + c.Value
		}
	}
	s.Require().NotEmpty(cookie)
	return started{id: id[1], code: code[1], cookie: cookie, page: page}
}

func (s *FlowSuite) appCall(method, path string, user primitive.ObjectID, body any) (int, string) {
	var r io.Reader
	headers := map[string]string{"X-Test-User": user.Hex(), "Authorization": "Bearer test"}
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
		headers["Content-Type"] = "application/json"
	}
	resp := s.do(method, path, r, headers)
	return resp.StatusCode, readBody(resp)
}

func (s *FlowSuite) approve(st started, user primitive.ObjectID, scopes ...string) {
	status, body := s.appCall(http.MethodPost, "/v1/user/oauth/requests/"+st.id+"/approve", user, map[string]any{"scopes": scopes})
	s.Require().Equal(http.StatusOK, status, body)
}

// complete follows the browser through /complete and returns the redirect query.
func (s *FlowSuite) complete(st started) url.Values {
	resp := s.do(http.MethodGet, "/oauth/authorize/complete?request="+st.id, nil, map[string]string{"Cookie": st.cookie})
	body := readBody(resp)
	s.Require().Equal(http.StatusFound, resp.StatusCode, body)
	loc, err := url.Parse(resp.Header.Get("Location"))
	s.Require().NoError(err)
	s.Equal("127.0.0.1:43123", loc.Host)
	s.Equal("st-123", loc.Query().Get("state"))
	s.Equal(s.issuer, loc.Query().Get("iss"))
	return loc.Query()
}

func (s *FlowSuite) token(form url.Values) (int, map[string]any) {
	resp := s.do(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()),
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"})
	s.Equal("no-store", resp.Header.Get("Cache-Control"))
	out := map[string]any{}
	_ = json.Unmarshal([]byte(readBody(resp)), &out)
	return resp.StatusCode, out
}

func (s *FlowSuite) exchange(code string) (int, map[string]any) {
	verifier, _ := pkcePair()
	return s.token(url.Values{
		"grant_type": {"authorization_code"}, "code": {code}, "client_id": {s.clientID},
		"redirect_uri": {testRedirect}, "code_verifier": {verifier}, "resource": {s.svc.ResourceURL()},
	})
}

func (s *FlowSuite) refreshWith(rt string, scope string) (int, map[string]any) {
	form := url.Values{"grant_type": {"refresh_token"}, "refresh_token": {rt}, "client_id": {s.clientID}}
	if scope != "" {
		form.Set("scope", scope)
	}
	return s.token(form)
}

// connect runs the whole happy path and returns the token response.
func (s *FlowSuite) connect(user primitive.ObjectID, scopes ...string) map[string]any {
	st := s.startAuthorize(nil)
	s.approve(st, user, scopes...)
	status, tok := s.exchange(s.complete(st).Get("code"))
	s.Require().Equal(http.StatusOK, status, tok)
	return tok
}

func (s *FlowSuite) TestFullFlow() {
	user := s.GetUser(0).ID
	st := s.startAuthorize(nil)
	s.Contains(st.page, "Connect Test Agent to Kindred")
	s.Contains(st.page, "Verified")
	s.Contains(st.page, "kindred://oauth/approve?request="+st.id)

	// The app looks the request up by the dashed, lowercased code.
	status, body := s.appCall(http.MethodGet, "/v1/user/oauth/requests/by-code/"+strings.ToLower(st.code), user, nil)
	s.Require().Equal(http.StatusOK, status, body)
	var view RequestView
	s.Require().NoError(json.Unmarshal([]byte(body), &view))
	s.Equal(st.id, view.ID)
	s.Equal(statusPending, view.Status)
	s.Equal("127.0.0.1", view.Client.Host)
	s.True(view.Client.Verified)
	s.Equal(registrationCIMD, view.Client.Registration)
	s.Len(view.Scopes, 3)
	s.Equal("TestBrowser/1.0", view.Browser.UserAgent)

	statusResp := s.do(http.MethodGet, "/oauth/authorize/status?request="+st.id, nil, map[string]string{"Cookie": st.cookie})
	s.Contains(readBody(statusResp), statusPending)

	s.approve(st, user, ScopeRead, ScopeWrite)
	statusResp = s.do(http.MethodGet, "/oauth/authorize/status?request="+st.id, nil, map[string]string{"Cookie": st.cookie})
	s.Contains(readBody(statusResp), statusApproved)

	code := s.complete(st).Get("code")
	s.True(strings.HasPrefix(code, codePrefix))
	again := s.do(http.MethodGet, "/oauth/authorize/complete?request="+st.id, nil, map[string]string{"Cookie": st.cookie})
	s.Equal(http.StatusBadRequest, again.StatusCode, "complete is single use")

	status, tok := s.exchange(code)
	s.Require().Equal(http.StatusOK, status, tok)
	s.Equal("Bearer", tok["token_type"])
	s.EqualValues(3600, tok["expires_in"])
	s.Equal("kindred:read kindred:write", tok["scope"])
	access, refresh := tok["access_token"].(string), tok["refresh_token"].(string)
	s.True(strings.HasPrefix(access, accessTokenPrefix))
	s.True(strings.HasPrefix(refresh, refreshTokenPrefix))

	var stored bson.M
	s.FindOne(tokensCollection, bson.M{"token_hash": hashSecret(access)}, &stored)
	for _, v := range stored {
		s.NotEqual(access, v, "raw tokens are never stored")
	}

	p, err := s.svc.VerifyAccessToken(s.Ctx, access)
	s.Require().NoError(err)
	s.Equal(user, p.UserID)
	s.Equal("oauth", p.Kind)
	s.Equal(s.clientID, p.ClientID)
	s.Equal("Test Agent", p.ClientName)
	s.Equal([]string{ScopeRead, ScopeWrite}, p.Scopes)
	s.WithinDuration(time.Now().Add(time.Hour), p.ExpiresAt, time.Minute)

	s.Eventually(func() bool {
		var g grantDoc
		s.FindOne(grantsCollection, bson.M{"_id": p.ConnectionID}, &g)
		return g.LastUsedAt != nil
	}, 3*time.Second, 50*time.Millisecond)

	status, body = s.appCall(http.MethodGet, "/v1/user/oauth/grants", user, nil)
	s.Require().Equal(http.StatusOK, status)
	var grants []GrantView
	s.Require().NoError(json.Unmarshal([]byte(body), &grants))
	s.Require().Len(grants, 1)
	s.Equal(p.ConnectionID.Hex(), grants[0].ID)
	s.Len(grants[0].Scopes, 2)
	s.NotNil(grants[0].LastUsedAt)

	// Refresh rotates both tokens; reusing the old refresh token revokes the grant.
	status, rotated := s.refreshWith(refresh, "")
	s.Require().Equal(http.StatusOK, status, rotated)
	s.NotEqual(refresh, rotated["refresh_token"])
	newAccess := rotated["access_token"].(string)
	_, err = s.svc.VerifyAccessToken(s.Ctx, newAccess)
	s.Require().NoError(err)

	status, reuse := s.refreshWith(refresh, "")
	s.Equal(http.StatusBadRequest, status)
	s.Equal("invalid_grant", reuse["error"])
	_, err = s.svc.VerifyAccessToken(s.Ctx, newAccess)
	s.ErrorIs(err, ErrInvalidToken)
	status, _ = s.refreshWith(rotated["refresh_token"].(string), "")
	s.Equal(http.StatusBadRequest, status)

	status, body = s.appCall(http.MethodGet, "/v1/user/oauth/grants", user, nil)
	s.Equal(http.StatusOK, status)
	s.JSONEq(`[]`, body)
}

func (s *FlowSuite) TestCodeReuseRevokesTokens() {
	user := s.GetUser(0).ID
	st := s.startAuthorize(nil)
	s.approve(st, user, ScopeRead)
	code := s.complete(st).Get("code")
	status, tok := s.exchange(code)
	s.Require().Equal(http.StatusOK, status)
	status, second := s.exchange(code)
	s.Equal(http.StatusBadRequest, status)
	s.Equal("invalid_grant", second["error"])
	_, err := s.svc.VerifyAccessToken(s.Ctx, tok["access_token"].(string))
	s.ErrorIs(err, ErrInvalidToken)
}

func (s *FlowSuite) TestTokenEndpointChecks() {
	user := s.GetUser(0).ID
	st := s.startAuthorize(nil)
	s.approve(st, user, ScopeRead)
	code := s.complete(st).Get("code")
	status, resp := s.token(url.Values{
		"grant_type": {"authorization_code"}, "code": {code}, "client_id": {s.clientID},
		"redirect_uri": {testRedirect}, "code_verifier": {strings.Repeat("x", 50)},
	})
	s.Equal(http.StatusBadRequest, status)
	s.Equal("invalid_grant", resp["error"], "wrong PKCE verifier")

	status, resp = s.token(url.Values{"grant_type": {"password"}, "client_id": {s.clientID}})
	s.Equal(http.StatusBadRequest, status)
	s.Equal("unsupported_grant_type", resp["error"])

	status, resp = s.token(url.Values{"grant_type": {"authorization_code"}, "code": {code}})
	s.Equal(http.StatusBadRequest, status)
	s.Equal("invalid_request", resp["error"])

	st = s.startAuthorize(nil)
	s.approve(st, user, ScopeRead)
	code = s.complete(st).Get("code")
	verifier, _ := pkcePair()
	status, resp = s.token(url.Values{
		"grant_type": {"authorization_code"}, "code": {code}, "client_id": {"https://other.example/client"},
		"redirect_uri": {testRedirect}, "code_verifier": {verifier},
	})
	s.Equal(http.StatusBadRequest, status)
	s.Equal("invalid_grant", resp["error"], "code bound to client")

	// Public client id via Basic auth with an empty secret, as golang.org/x/oauth2 sends it.
	st = s.startAuthorize(nil)
	s.approve(st, user, ScopeRead)
	code = s.complete(st).Get("code")
	form := url.Values{"grant_type": {"authorization_code"}, "code": {code}, "redirect_uri": {testRedirect}, "code_verifier": {verifier}}
	basic := base64.StdEncoding.EncodeToString([]byte(url.QueryEscape(s.clientID) + ":"))
	r := s.do(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()), map[string]string{
		"Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + basic,
	})
	s.Equal(http.StatusOK, r.StatusCode, readBody(r))
}

func (s *FlowSuite) TestRefreshScopeNarrowing() {
	tok := s.connect(s.GetUser(0).ID, ScopeRead, ScopeComplete)
	status, wider := s.refreshWith(tok["refresh_token"].(string), "kindred:read kindred:write")
	s.Equal(http.StatusBadRequest, status)
	s.Equal("invalid_scope", wider["error"])

	// A rejected scope does not burn the refresh token.
	status, narrow := s.refreshWith(tok["refresh_token"].(string), ScopeRead)
	s.Require().Equal(http.StatusOK, status, narrow)
	s.Equal(ScopeRead, narrow["scope"])
	p, err := s.svc.VerifyAccessToken(s.Ctx, narrow["access_token"].(string))
	s.Require().NoError(err)
	s.Equal([]string{ScopeRead}, p.Scopes)
}

func (s *FlowSuite) TestVerifyAccessTokenRules() {
	user := s.GetUser(0).ID
	tok := s.connect(user, ScopeRead)
	access := tok["access_token"].(string)
	hash := hashSecret(access)

	_, err := s.svc.VerifyAccessToken(s.Ctx, "kdr_notatoken")
	s.ErrorIs(err, ErrInvalidToken)

	_, err = s.Collections[tokensCollection].UpdateOne(s.Ctx, bson.M{"token_hash": hash}, bson.M{"$set": bson.M{"audience": "https://other.example/mcp"}})
	s.Require().NoError(err)
	_, err = s.svc.VerifyAccessToken(s.Ctx, access)
	s.ErrorIs(err, ErrInvalidToken, "audience must equal the resource URL")

	_, err = s.Collections[tokensCollection].UpdateOne(s.Ctx, bson.M{"token_hash": hash},
		bson.M{"$set": bson.M{"audience": s.svc.ResourceURL(), "expires_at": time.Now().Add(-time.Second)}})
	s.Require().NoError(err)
	_, err = s.svc.VerifyAccessToken(s.Ctx, access)
	s.ErrorIs(err, ErrInvalidToken, "expired")

	tok = s.connect(user, ScopeRead)
	p, err := s.svc.VerifyAccessToken(s.Ctx, tok["access_token"].(string))
	s.Require().NoError(err)

	status, _ := s.appCall(http.MethodDelete, "/v1/user/oauth/grants/"+p.ConnectionID.Hex(), s.GetUser(1).ID, nil)
	s.Equal(http.StatusNotFound, status, "revoke is scoped to the caller")
	status, _ = s.appCall(http.MethodDelete, "/v1/user/oauth/grants/"+p.ConnectionID.Hex(), user, nil)
	s.Equal(http.StatusOK, status)
	_, err = s.svc.VerifyAccessToken(s.Ctx, tok["access_token"].(string))
	s.ErrorIs(err, ErrInvalidToken, "revoked grant")
	s.Zero(s.CountDocuments(tokensCollection, bson.M{"grant_id": p.ConnectionID}))
}

func (s *FlowSuite) TestRevokeEndpoint() {
	tok := s.connect(s.GetUser(0).ID, ScopeRead)
	form := url.Values{"token": {tok["refresh_token"].(string)}, "client_id": {s.clientID}}
	r := s.do(http.MethodPost, "/oauth/revoke", strings.NewReader(form.Encode()), map[string]string{"Content-Type": "application/x-www-form-urlencoded"})
	s.Equal(http.StatusOK, r.StatusCode)
	_, err := s.svc.VerifyAccessToken(s.Ctx, tok["access_token"].(string))
	s.ErrorIs(err, ErrInvalidToken, "revoking a refresh token drops its family")

	form.Set("token", "kdr_at_unknown")
	r = s.do(http.MethodPost, "/oauth/revoke", strings.NewReader(form.Encode()), map[string]string{"Content-Type": "application/x-www-form-urlencoded"})
	s.Equal(http.StatusOK, r.StatusCode)
}

func (s *FlowSuite) TestDenyAndCancel() {
	user := s.GetUser(0).ID
	st := s.startAuthorize(nil)
	status, body := s.appCall(http.MethodPost, "/v1/user/oauth/requests/"+st.id+"/deny", user, nil)
	s.Require().Equal(http.StatusOK, status, body)
	s.Contains(body, `"status":"denied"`)
	s.Equal("access_denied", s.complete(st).Get("error"))

	st = s.startAuthorize(nil)
	resp := s.do(http.MethodGet, "/oauth/authorize/cancel?request="+st.id, nil, map[string]string{"Cookie": st.cookie})
	s.Require().Equal(http.StatusFound, resp.StatusCode)
	loc, _ := url.Parse(resp.Header.Get("Location"))
	s.Equal("access_denied", loc.Query().Get("error"))
	s.Equal("st-123", loc.Query().Get("state"))
}

func (s *FlowSuite) TestBrowserBinding() {
	st := s.startAuthorize(nil)
	s.approve(st, s.GetUser(0).ID, ScopeRead)
	resp := s.do(http.MethodGet, "/oauth/authorize/complete?request="+st.id, nil, nil)
	s.Equal(http.StatusForbidden, resp.StatusCode)
	resp = s.do(http.MethodGet, "/oauth/authorize/complete?request="+st.id, nil, map[string]string{"Cookie": bindingCookiePrefix + st.id + "=wrong"})
	s.Equal(http.StatusForbidden, resp.StatusCode)
	resp = s.do(http.MethodGet, "/oauth/authorize/status?request="+st.id, nil, nil)
	s.Equal(http.StatusForbidden, resp.StatusCode)
}

func (s *FlowSuite) TestAppAPIStatusCodes() {
	user, other := s.GetUser(0).ID, s.GetUser(1).ID
	st := s.startAuthorize(map[string]string{"scope": ScopeRead})

	status, _ := s.appCall(http.MethodGet, "/v1/user/oauth/requests/by-code/ZZZZ-ZZZZ", user, nil)
	s.Equal(http.StatusNotFound, status)
	status, _ = s.appCall(http.MethodGet, "/v1/user/oauth/requests/AAAAAAAAAAAAAAAAAAAAAA", user, nil)
	s.Equal(http.StatusNotFound, status)

	status, _ = s.appCall(http.MethodPost, "/v1/user/oauth/requests/"+st.id+"/approve", user, map[string]any{"scopes": []string{ScopeWrite}})
	s.Equal(http.StatusBadRequest, status, "scope not requested")

	s.approve(st, user, ScopeRead)
	status, _ = s.appCall(http.MethodPost, "/v1/user/oauth/requests/"+st.id+"/approve", user, map[string]any{"scopes": []string{ScopeRead}})
	s.Equal(http.StatusConflict, status)
	status, _ = s.appCall(http.MethodPost, "/v1/user/oauth/requests/"+st.id+"/deny", user, nil)
	s.Equal(http.StatusConflict, status)
	status, _ = s.appCall(http.MethodGet, "/v1/user/oauth/requests/"+st.id, other, nil)
	s.Equal(http.StatusNotFound, status, "another user's decided request is hidden")

	expired := s.startAuthorize(nil)
	_, err := s.Collections[requestsCollection].UpdateOne(s.Ctx, bson.M{"_id": expired.id}, bson.M{"$set": bson.M{"expires_at": time.Now().Add(-time.Second)}})
	s.Require().NoError(err)
	status, _ = s.appCall(http.MethodGet, "/v1/user/oauth/requests/"+expired.id, user, nil)
	s.Equal(http.StatusGone, status)
	status, _ = s.appCall(http.MethodGet, "/v1/user/oauth/requests/by-code/"+expired.code, user, nil)
	s.Equal(http.StatusGone, status)
	status, _ = s.appCall(http.MethodPost, "/v1/user/oauth/requests/"+expired.id+"/approve", user, map[string]any{"scopes": []string{ScopeRead}})
	s.Equal(http.StatusGone, status)
	s.Equal("access_denied", s.complete(expired).Get("error"))

	for i := 0; i < 8; i++ {
		s.appCall(http.MethodGet, "/v1/user/oauth/requests/by-code/ZZZZ-ZZZZ", user, nil)
	}
	status, _ = s.appCall(http.MethodGet, "/v1/user/oauth/requests/by-code/ZZZZ-ZZZZ", user, nil)
	s.Equal(http.StatusTooManyRequests, status, "by-code is rate limited per user")
}

func (s *FlowSuite) TestAuthorizeValidation() {
	// Client and redirect problems render an error page and never redirect.
	for _, o := range []map[string]string{
		{"client_id": ""},
		{"client_id": "https://claude.ai"},
		{"client_id": "kdr_client_missing"},
		{"redirect_uri": "http://127.0.0.1:43123/elsewhere"},
		{"redirect_uri": "https://attacker.example/cb"},
	} {
		resp := s.do(http.MethodGet, s.authorizeQuery(o), nil, nil)
		s.Equal(http.StatusBadRequest, resp.StatusCode, o)
		s.Empty(resp.Header.Get("Location"), o)
	}

	cases := map[string]map[string]string{
		"unsupported_response_type": {"response_type": "token"},
		"invalid_request":           {"code_challenge_method": "plain"},
		"invalid_target":            {"resource": "https://other.example/mcp"},
		"invalid_scope":             {"scope": "kindred:admin"},
	}
	for want, o := range cases {
		resp := s.do(http.MethodGet, s.authorizeQuery(o), nil, nil)
		s.Require().Equal(http.StatusFound, resp.StatusCode, want)
		loc, _ := url.Parse(resp.Header.Get("Location"))
		s.Equal(want, loc.Query().Get("error"))
		s.Equal("st-123", loc.Query().Get("state"))
		s.Equal(s.issuer, loc.Query().Get("iss"))
	}
	resp := s.do(http.MethodGet, s.authorizeQuery(map[string]string{"code_challenge": ""}), nil, nil)
	s.Equal(http.StatusFound, resp.StatusCode, "PKCE is required")

	st := s.startAuthorize(map[string]string{"resource": "", "scope": "kindred:read offline_access"})
	var doc requestDoc
	s.FindOne(requestsCollection, bson.M{"_id": st.id}, &doc)
	s.Equal(s.svc.ResourceURL(), doc.Resource)
	s.Equal([]string{ScopeRead}, doc.Scopes)
}

func (s *FlowSuite) TestDynamicClientRegistration() {
	reg := `{"client_name":"Some Tool","redirect_uris":["http://127.0.0.1/callback"],"token_endpoint_auth_method":"none"}`
	resp := s.do(http.MethodPost, "/oauth/register", strings.NewReader(reg), map[string]string{"Content-Type": "application/json"})
	body := readBody(resp)
	s.Require().Equal(http.StatusCreated, resp.StatusCode, body)
	var out map[string]any
	s.Require().NoError(json.Unmarshal([]byte(body), &out))
	clientID := out["client_id"].(string)
	s.True(strings.HasPrefix(clientID, dcrClientPrefix))
	s.Equal("none", out["token_endpoint_auth_method"])

	s.clientID = clientID
	st := s.startAuthorize(nil)
	s.Contains(st.page, "Unverified app")
	status, body := s.appCall(http.MethodGet, "/v1/user/oauth/requests/"+st.id, s.GetUser(0).ID, nil)
	s.Require().Equal(http.StatusOK, status)
	var view RequestView
	s.Require().NoError(json.Unmarshal([]byte(body), &view))
	s.False(view.Client.Verified)
	s.Equal(registrationDCR, view.Client.Registration)

	for _, bad := range []string{
		`{"redirect_uris":["http://evil.example/cb"]}`,
		`{"redirect_uris":["https://ok.example/cb"],"token_endpoint_auth_method":"client_secret_post"}`,
		`not json`,
	} {
		resp := s.do(http.MethodPost, "/oauth/register", strings.NewReader(bad), map[string]string{"Content-Type": "application/json"})
		s.Equal(http.StatusBadRequest, resp.StatusCode, bad)
	}
}

func (s *FlowSuite) TestMetadata() {
	svc := s.newService("https://kindredtodo.com/api")
	app := newTestApp(svc)
	get := func(path string) map[string]any {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil), -1)
		s.Require().NoError(err)
		s.Require().Equal(http.StatusOK, resp.StatusCode, path)
		out := map[string]any{}
		s.Require().NoError(json.Unmarshal([]byte(readBody(resp)), &out))
		return out
	}
	for _, p := range []string{"/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/api", "/.well-known/openid-configuration"} {
		m := get(p)
		s.Equal("https://kindredtodo.com/api", m["issuer"])
		s.Equal("https://kindredtodo.com/api/oauth/authorize", m["authorization_endpoint"])
		s.Equal("https://kindredtodo.com/api/oauth/token", m["token_endpoint"])
		s.Equal("https://kindredtodo.com/api/oauth/register", m["registration_endpoint"])
		s.Equal(true, m["client_id_metadata_document_supported"])
		s.Equal(true, m["authorization_response_iss_parameter_supported"])
		s.Equal([]any{"S256"}, m["code_challenge_methods_supported"])
		s.Equal([]any{"none"}, m["token_endpoint_auth_methods_supported"])
		s.NotContains(m, "jwks_uri")
		s.NotContains(m, "id_token_signing_alg_values_supported")
	}
	for _, p := range []string{"/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/v1/mcp", "/.well-known/oauth-protected-resource/api/v1/mcp"} {
		m := get(p)
		s.Equal("https://kindredtodo.com/api/v1/mcp", m["resource"])
		s.Equal([]any{"https://kindredtodo.com/api"}, m["authorization_servers"])
		s.Equal([]any{"header"}, m["bearer_methods_supported"])
		s.Equal("Kindred", m["resource_name"])
	}
	s.Equal("https://kindredtodo.com/api/.well-known/oauth-protected-resource/v1/mcp", svc.ResourceMetadataURL())

	noDCR := config.Config{}
	noDCR.MCPOAuth.Issuer = "https://kindredtodo.com/api"
	noDCR.MCPOAuth.AllowDCR = "false"
	s.Empty(NewService(s.Collections, noDCR).authServerMetadata().RegistrationEndpoint)

	prod := config.Config{}
	prod.MCPOAuth.AppEnv = "production"
	s.False(NewService(s.Collections, prod).Enabled(), "production without an issuer is disabled")
}
