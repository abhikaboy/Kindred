package oauth

import (
	"bytes"
	"embed"
	"encoding/base64"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"rsc.io/qr"
)

//go:embed templates/*.html
var templateFS embed.FS

var pageTemplates = template.Must(template.ParseFS(templateFS, "templates/*.html"))

const (
	bindingCookiePrefix = "kdr_oauth_"
	maxStateLength      = 2048
	deepLinkBase        = "kindred://oauth/approve?request="
)

type pageData struct {
	Nonce string

	ClientName  string
	Host        string
	Verified    bool
	LogoURI     string
	Scopes      []scopeInfo
	QR          template.URL
	DeepLink    template.URL
	UserCode    string
	StatusURL   string
	CompleteURL string
	CancelURL   string

	Heading string
	Message string
}

func htmlHeaders(c *fiber.Ctx, nonce string) {
	c.Set("Content-Type", "text/html; charset=utf-8")
	c.Set("Content-Security-Policy", fmt.Sprintf(
		"default-src 'none'; script-src 'nonce-%[1]s'; style-src 'nonce-%[1]s' https://fonts.googleapis.com; "+
			"font-src https://fonts.gstatic.com; img-src data: https:; connect-src 'self'; "+
			"base-uri 'none'; form-action 'none'; frame-ancestors 'none'", nonce))
	c.Set("X-Frame-Options", "DENY")
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("Referrer-Policy", "no-referrer")
	c.Set("Cache-Control", "no-store")
}

func (s *Service) render(c *fiber.Ctx, status int, name string, data pageData) error {
	nonce, err := randomString(16)
	if err != nil {
		return c.Status(http.StatusInternalServerError).SendString("Something went wrong.")
	}
	data.Nonce = nonce
	var buf bytes.Buffer
	if err := pageTemplates.ExecuteTemplate(&buf, name, data); err != nil {
		slog.Error("mcp oauth: render page failed", "template", name, "error", err)
		return c.Status(http.StatusInternalServerError).SendString("Something went wrong.")
	}
	htmlHeaders(c, nonce)
	return c.Status(status).Send(buf.Bytes())
}

func (s *Service) renderError(c *fiber.Ctx, status int, heading, message string) error {
	return s.render(c, status, "error.html", pageData{Heading: heading, Message: message})
}

// redirectToClient sends the browser back to the client with the given params plus iss.
func (s *Service) redirectToClient(c *fiber.Ctx, redirectURI string, params url.Values) error {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return s.renderError(c, http.StatusBadRequest, "Something went wrong", "The app's return address is invalid.")
	}
	q := u.Query()
	for k, v := range params {
		if len(v) > 0 && v[0] != "" {
			q.Set(k, v[0])
		}
	}
	q.Set("iss", s.issuer)
	u.RawQuery = q.Encode()
	c.Set("Cache-Control", "no-store")
	c.Set("Referrer-Policy", "no-referrer")
	return c.Redirect(u.String(), http.StatusFound)
}

func (s *Service) redirectError(c *fiber.Ctx, redirectURI, state, code, desc string) error {
	return s.redirectToClient(c, redirectURI, url.Values{"error": {code}, "error_description": {desc}, "state": {state}})
}

// parseRequestedScopes validates scope; offline_access is ignored because refresh tokens are always issued.
func parseRequestedScopes(raw string) ([]string, bool) {
	requested := strings.Fields(raw)
	all := AllScopes()
	var kept []string
	for _, r := range requested {
		if r == "offline_access" {
			continue
		}
		if !slices.Contains(all, r) {
			return nil, false
		}
		kept = append(kept, r)
	}
	if len(kept) == 0 {
		return all, true
	}
	return intersectScopes(all, kept), true
}

func (s *Service) handleAuthorize(c *fiber.Ctx) error {
	ip := strings.Clone(s.requestIP(c))
	if !s.authorizeLimiter.Allow(ip) {
		return s.renderError(c, http.StatusTooManyRequests, "Too many attempts", "Too many connection attempts from this network. Try again in a few minutes.")
	}
	q := func(k string) string { return strings.Clone(c.Query(k)) }
	ctx := c.UserContext()

	clientID, redirectURI, state := q("client_id"), q("redirect_uri"), q("state")
	if clientID == "" {
		return s.renderError(c, http.StatusBadRequest, "Can't connect this app", "The link is missing the app's client_id.")
	}
	client, err := s.resolver.Resolve(ctx, clientID)
	if err != nil {
		var ce *clientError
		if errors.As(err, &ce) {
			return s.renderError(c, http.StatusBadRequest, "Can't connect this app", ce.msg)
		}
		slog.Error("mcp oauth: resolve client failed", "error", err)
		return s.renderError(c, http.StatusInternalServerError, "Something went wrong", "Kindred could not load this app's details. Try again in a minute.")
	}
	if redirectURI == "" || !redirectMatches(client.RedirectURIs, redirectURI) {
		return s.renderError(c, http.StatusBadRequest, "Can't connect this app", "The app asked to return to an address it has not registered.")
	}

	if len(state) > maxStateLength {
		return s.redirectError(c, redirectURI, "", "invalid_request", "state is too long")
	}
	if q("response_type") != "code" {
		return s.redirectError(c, redirectURI, state, "unsupported_response_type", "response_type must be code")
	}
	challenge := q("code_challenge")
	if q("code_challenge_method") != "S256" || !codeChallengeWellFormed(challenge) {
		return s.redirectError(c, redirectURI, state, "invalid_request", "PKCE with code_challenge_method S256 is required")
	}
	resource := q("resource")
	if resource == "" {
		resource = s.ResourceURL()
	} else if resource != s.ResourceURL() {
		return s.redirectError(c, redirectURI, state, "invalid_target", "resource must be "+s.ResourceURL())
	}
	scopes, ok := parseRequestedScopes(q("scope"))
	if !ok {
		return s.redirectError(c, redirectURI, state, "invalid_scope", "supported scopes are "+strings.Join(AllScopes(), " "))
	}

	id, err := randomString(16)
	if err != nil {
		return s.redirectError(c, redirectURI, state, "server_error", "")
	}
	binding, err := randomString(secretBytes)
	if err != nil {
		return s.redirectError(c, redirectURI, state, "server_error", "")
	}
	now := s.now()
	doc := &requestDoc{
		ID:               id,
		Status:           statusPending,
		Client:           *client,
		ClientHost:       clientHost(client, redirectURI),
		RedirectURI:      redirectURI,
		State:            state,
		CodeChallenge:    challenge,
		Scopes:           scopes,
		Resource:         resource,
		BindingHash:      hashSecret(binding),
		BrowserUserAgent: truncate(strings.Clone(c.Get(fiber.HeaderUserAgent)), 512),
		BrowserIP:        ip,
		CreatedAt:        now,
		ExpiresAt:        now.Add(requestTTL),
	}
	if err := s.insertRequest(ctx, doc); err != nil {
		slog.Error("mcp oauth: create request failed", "error", err)
		return s.redirectError(c, redirectURI, state, "server_error", "")
	}
	c.Cookie(&fiber.Cookie{
		Name:     bindingCookiePrefix + id,
		Value:    binding,
		Path:     s.issuerPath + "/oauth/authorize",
		MaxAge:   int(requestTTL / time.Second),
		Secure:   s.secureCookies,
		HTTPOnly: true,
		SameSite: fiber.CookieSameSiteLaxMode,
	})
	return s.renderAuthorize(c, doc)
}

func (s *Service) renderAuthorize(c *fiber.Ctx, doc *requestDoc) error {
	link := deepLinkBase + doc.ID
	qrURI, err := qrDataURI(link)
	if err != nil {
		slog.Error("mcp oauth: qr encode failed", "error", err)
	}
	data := pageData{
		ClientName:  doc.Client.Name,
		Host:        doc.ClientHost,
		Verified:    doc.Client.Verified,
		Scopes:      describeScopes(doc.Scopes),
		QR:          template.URL(qrURI), //nolint:gosec // generated server-side data URI
		DeepLink:    template.URL(link),  //nolint:gosec // fixed scheme plus a validated request id
		UserCode:    formatUserCode(doc.UserCode),
		StatusURL:   s.issuerPath + "/oauth/authorize/status?request=" + doc.ID,
		CompleteURL: s.issuerPath + "/oauth/authorize/complete?request=" + doc.ID,
		CancelURL:   s.issuerPath + "/oauth/authorize/cancel?request=" + doc.ID,
	}
	if doc.Client.Verified {
		data.LogoURI = doc.Client.LogoURI
	}
	return s.render(c, http.StatusOK, "authorize.html", data)
}

func qrDataURI(text string) (string, error) {
	code, err := qr.Encode(text, qr.M)
	if err != nil {
		return "", err
	}
	const quiet = 4
	total := code.Size + 2*quiet
	var b strings.Builder
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges">`, total, total)
	fmt.Fprintf(&b, `<rect width="%d" height="%d" fill="#ffffff"/><path fill="#13121F" d="`, total, total)
	for y := 0; y < code.Size; y++ {
		for x := 0; x < code.Size; x++ {
			if code.Black(x, y) {
				fmt.Fprintf(&b, "M%d %dh1v1h-1z", x+quiet, y+quiet)
			}
		}
	}
	b.WriteString(`"/></svg>`)
	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(b.String())), nil
}

func (s *Service) bindingValid(c *fiber.Ctx, doc *requestDoc) bool {
	v := c.Cookies(bindingCookiePrefix + doc.ID)
	return v != "" && constantTimeEqual(hashSecret(v), doc.BindingHash)
}

func (s *Service) clearBinding(c *fiber.Ctx, id string) {
	c.Cookie(&fiber.Cookie{
		Name:     bindingCookiePrefix + id,
		Value:    "",
		Path:     s.issuerPath + "/oauth/authorize",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		Secure:   s.secureCookies,
		HTTPOnly: true,
		SameSite: fiber.CookieSameSiteLaxMode,
	})
}

func (s *Service) handleAuthorizeStatus(c *fiber.Ctx) error {
	noStore(c)
	if !s.statusLimiter.Allow(s.requestIP(c)) {
		return c.Status(http.StatusTooManyRequests).JSON(fiber.Map{"error": "too_many_requests"})
	}
	doc, err := s.findRequest(c.UserContext(), c.Query("request"))
	if errors.Is(err, errNotFound) {
		return c.JSON(fiber.Map{"status": statusExpired})
	}
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "unavailable"})
	}
	if !s.bindingValid(c, doc) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	return c.JSON(fiber.Map{"status": doc.effectiveStatus(s.now())})
}

func (s *Service) loadBoundRequest(c *fiber.Ctx) (*requestDoc, error) {
	doc, err := s.findRequest(c.UserContext(), c.Query("request"))
	if errors.Is(err, errNotFound) {
		return nil, s.renderError(c, http.StatusBadRequest, "This request expired", "Go back to the app and connect Kindred again.")
	}
	if err != nil {
		return nil, s.renderError(c, http.StatusServiceUnavailable, "Something went wrong", "Try again in a minute.")
	}
	if !s.bindingValid(c, doc) {
		return nil, s.renderError(c, http.StatusForbidden, "Open this in the original browser", "This request was started in a different browser. Go back to the app and connect Kindred again.")
	}
	return doc, nil
}

func (s *Service) handleAuthorizeComplete(c *fiber.Ctx) error {
	doc, err := s.loadBoundRequest(c)
	if doc == nil {
		return err
	}
	return s.finish(c, doc)
}

func (s *Service) handleAuthorizeCancel(c *fiber.Ctx) error {
	doc, err := s.loadBoundRequest(c)
	if doc == nil {
		return err
	}
	if doc.effectiveStatus(s.now()) == statusPending {
		if err := s.denyRequest(c.UserContext(), doc.ID, nil); err != nil && !errors.Is(err, errNotPending) {
			slog.Error("mcp oauth: cancel request failed", "error", err)
		}
		if fresh, err := s.findRequest(c.UserContext(), doc.ID); err == nil {
			doc = fresh
		}
	}
	return s.finish(c, doc)
}

// finish consumes the request exactly once and redirects back to the client.
func (s *Service) finish(c *fiber.Ctx, doc *requestDoc) error {
	if doc.CompletedAt != nil {
		return s.renderError(c, http.StatusBadRequest, "Already used", "This request was already completed. Go back to the app to continue.")
	}
	now := s.now()
	status := doc.effectiveStatus(now)
	if status == statusPending {
		return s.renderAuthorize(c, doc)
	}
	res, err := s.requests.UpdateOne(c.UserContext(),
		bson.M{"_id": doc.ID, "completed_at": nil},
		bson.M{"$set": bson.M{"completed_at": now}},
	)
	if err != nil {
		return s.renderError(c, http.StatusServiceUnavailable, "Something went wrong", "Try again in a minute.")
	}
	if res.MatchedCount == 0 {
		return s.renderError(c, http.StatusBadRequest, "Already used", "This request was already completed. Go back to the app to continue.")
	}
	s.clearBinding(c, doc.ID)

	switch status {
	case statusApproved:
		code, err := s.issueCode(c.UserContext(), doc)
		if err != nil {
			slog.Error("mcp oauth: issue code failed", "requestId", doc.ID, "error", err)
			return s.redirectError(c, doc.RedirectURI, doc.State, "server_error", "")
		}
		return s.redirectToClient(c, doc.RedirectURI, url.Values{"code": {code}, "state": {doc.State}})
	case statusDenied:
		return s.redirectError(c, doc.RedirectURI, doc.State, "access_denied", "The request was declined in Kindred")
	default:
		return s.redirectError(c, doc.RedirectURI, doc.State, "access_denied", "The request expired before it was approved")
	}
}
