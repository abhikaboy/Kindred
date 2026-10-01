package oauth

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"

	"github.com/gofiber/fiber/v2"
	sdkauth "github.com/modelcontextprotocol/go-sdk/auth"
)

// TestEndToEndCIMD drives discovery, CIMD registration, app approval and token exchange
// with the go-sdk's AuthorizationCodeHandler, the way a real MCP client would.
func (s *FlowSuite) TestEndToEndCIMD() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	s.Require().NoError(err)
	issuer := "http://" + ln.Addr().String()
	svc := s.newService(issuer)
	app := newTestApp(svc)
	// Stand-in for the MCP resource server: 401 with resource metadata until a valid token arrives.
	app.All("/v1/mcp", func(c *fiber.Ctx) error {
		if raw, ok := strings.CutPrefix(c.Get("Authorization"), "Bearer "); ok {
			if p, err := svc.VerifyAccessToken(c.UserContext(), raw); err == nil {
				return c.JSON(fiber.Map{"user": p.UserID.Hex(), "scopes": p.Scopes})
			}
		}
		c.Set("WWW-Authenticate", fmt.Sprintf(`Bearer resource_metadata="%s", scope="%s"`, svc.ResourceMetadataURL(), strings.Join(AllScopes(), " ")))
		return c.SendStatus(http.StatusUnauthorized)
	})
	go func() { _ = app.Listener(ln) }()
	defer func() { _ = app.Shutdown() }()

	user := s.GetUser(0).ID
	jar, _ := cookiejar.New(nil)
	browser := &http.Client{Jar: jar, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

	fetcher := func(ctx context.Context, args *sdkauth.AuthorizationArgs) (*sdkauth.AuthorizationResult, error) {
		resp, err := browser.Get(args.URL)
		if err != nil {
			return nil, err
		}
		page, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("authorize page: %d %s", resp.StatusCode, page)
		}
		m := requestIDPattern.FindSubmatch(page)
		if m == nil {
			return nil, fmt.Errorf("no request id on page")
		}
		id := string(m[1])

		// The user approves in the Kindred app.
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, issuer+"/v1/user/oauth/requests/"+id+"/approve",
			bytes.NewBufferString(`{"scopes":["kindred:read","kindred:complete"]}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer app")
		req.Header.Set("X-Test-User", user.Hex())
		approve, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		_ = approve.Body.Close()
		if approve.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("approve: %d", approve.StatusCode)
		}

		done, err := browser.Get(issuer + "/oauth/authorize/complete?request=" + id)
		if err != nil {
			return nil, err
		}
		_ = done.Body.Close()
		loc, err := url.Parse(done.Header.Get("Location"))
		if err != nil || done.StatusCode != http.StatusFound {
			return nil, fmt.Errorf("complete: %d", done.StatusCode)
		}
		q := loc.Query()
		return &sdkauth.AuthorizationResult{Code: q.Get("code"), State: q.Get("state"), Iss: q.Get("iss")}, nil
	}

	handler, err := sdkauth.NewAuthorizationCodeHandler(&sdkauth.AuthorizationCodeHandlerConfig{
		ClientIDMetadataDocumentConfig: &sdkauth.ClientIDMetadataDocumentConfig{URL: s.clientID},
		RedirectURL:                    "http://127.0.0.1:61234/callback",
		AuthorizationCodeFetcher:       fetcher,
	})
	s.Require().NoError(err)

	resource := issuer + "/v1/mcp"
	resp, err := http.Get(resource)
	s.Require().NoError(err)
	s.Require().Equal(http.StatusUnauthorized, resp.StatusCode)
	s.Require().NoError(handler.Authorize(s.Ctx, resp.Request, resp))

	ts, err := handler.TokenSource(s.Ctx)
	s.Require().NoError(err)
	tok, err := ts.Token()
	s.Require().NoError(err)
	s.True(strings.HasPrefix(tok.AccessToken, accessTokenPrefix))
	s.True(strings.HasPrefix(tok.RefreshToken, refreshTokenPrefix))

	req, _ := http.NewRequest(http.MethodGet, resource, nil)
	tok.SetAuthHeader(req)
	ok, err := http.DefaultClient.Do(req)
	s.Require().NoError(err)
	body, _ := io.ReadAll(ok.Body)
	_ = ok.Body.Close()
	s.Equal(http.StatusOK, ok.StatusCode, string(body))
	s.Contains(string(body), user.Hex())
	s.Contains(string(body), ScopeComplete)
	s.NotContains(string(body), ScopeWrite)
}
