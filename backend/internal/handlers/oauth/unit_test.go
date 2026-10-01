package oauth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testClientID = "https://claude.ai/oauth/mcp-oauth-client-metadata"

func cimdDoc(clientID string, extra string) []byte {
	return []byte(`{"client_id":"` + clientID + `","client_name":"Claude","redirect_uris":["https://claude.ai/api/mcp/auth_callback"]` + extra + `}`)
}

func TestParseCIMD(t *testing.T) {
	verified := []string{"claude.ai"}

	c, err := parseCIMD(cimdDoc(testClientID, `,"logo_uri":"https://claude.ai/logo.png","grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"none"`), testClientID, verified)
	require.NoError(t, err)
	assert.Equal(t, testClientID, c.ID)
	assert.Equal(t, "Claude", c.Name)
	assert.Equal(t, registrationCIMD, c.Registration)
	assert.True(t, c.Verified)
	assert.Equal(t, "https://claude.ai/logo.png", c.LogoURI)

	c, err = parseCIMD(cimdDoc("https://evil.example/client.json", ""), "https://evil.example/client.json", verified)
	require.NoError(t, err)
	assert.False(t, c.Verified)

	cases := map[string][]byte{
		"client_id mismatch": cimdDoc("https://claude.ai/other", ""),
		"confidential":       cimdDoc(testClientID, `,"token_endpoint_auth_method":"client_secret_basic"`),
		"secret present":     cimdDoc(testClientID, `,"client_secret":"x"`),
		"no auth code grant": cimdDoc(testClientID, `,"grant_types":["client_credentials"]`),
		"no redirects":       []byte(`{"client_id":"` + testClientID + `","redirect_uris":[]}`),
		"http redirect":      []byte(`{"client_id":"` + testClientID + `","redirect_uris":["http://evil.example/cb"]}`),
		"custom scheme":      []byte(`{"client_id":"` + testClientID + `","redirect_uris":["myapp://cb"]}`),
		"not json":           []byte(`<html>`),
	}
	for name, body := range cases {
		_, err := parseCIMD(body, testClientID, verified)
		assert.Error(t, err, name)
	}
}

func TestCleanNameAndLogo(t *testing.T) {
	assert.Equal(t, "Claude Desktop", cleanName("  Claude\n\tDesktop\x00 "))
	assert.Len(t, []rune(cleanName(strings.Repeat("a", 200))), maxClientNameRunes)
	assert.Equal(t, "", httpsURLOrEmpty("http://x.example/logo.png"))
	assert.Equal(t, "", httpsURLOrEmpty("javascript:alert(1)"))
}

func TestIsCIMDClientID(t *testing.T) {
	assert.True(t, isCIMDClientID(testClientID))
	assert.False(t, isCIMDClientID("https://claude.ai"))
	assert.False(t, isCIMDClientID("https://claude.ai/"))
	assert.False(t, isCIMDClientID("http://claude.ai/client"))
	assert.False(t, isCIMDClientID("https://user@claude.ai/client"))
	assert.False(t, isCIMDClientID("https://claude.ai/a/../client"))
	assert.False(t, isCIMDClientID("https://claude.ai/client#frag"))
	assert.False(t, isCIMDClientID("kdr_client_abc"))
}

func TestHostVerified(t *testing.T) {
	hosts := []string{"claude.ai", "openai.com"}
	assert.True(t, hostVerified("claude.ai", hosts))
	assert.True(t, hostVerified("api.claude.ai", hosts))
	assert.True(t, hostVerified("CLAUDE.AI.", hosts))
	assert.False(t, hostVerified("evilclaude.ai", hosts))
	assert.False(t, hostVerified("claude.ai.evil.com", hosts))
}

func TestRedirectMatching(t *testing.T) {
	reg := []string{"https://claude.ai/api/mcp/auth_callback", "http://127.0.0.1/callback", "http://localhost:3000/cb?x=1"}
	assert.True(t, redirectMatches(reg, "https://claude.ai/api/mcp/auth_callback"))
	assert.False(t, redirectMatches(reg, "https://claude.ai/api/mcp/auth_callback/"))
	assert.False(t, redirectMatches(reg, "https://claude.ai/api/mcp/auth_callback?x=1"))
	assert.False(t, redirectMatches(reg, "https://claude.ai:8443/api/mcp/auth_callback"))
	assert.True(t, redirectMatches(reg, "http://127.0.0.1:53211/callback"))
	assert.True(t, redirectMatches(reg, "http://localhost:9999/cb?x=1"))
	assert.False(t, redirectMatches(reg, "http://localhost:9999/cb"))
	assert.False(t, redirectMatches(reg, "http://127.0.0.1:53211/other"))
	assert.False(t, redirectMatches(reg, "http://[::1]:53211/callback"), "loopback host must match literally")
	assert.False(t, redirectMatches(reg, "https://127.0.0.1:53211/callback"))

	assert.True(t, validRedirectURI("https://example.com/cb"))
	assert.True(t, validRedirectURI("http://[::1]:8080/cb"))
	assert.False(t, validRedirectURI("http://example.com/cb"))
	assert.False(t, validRedirectURI("https://example.com/cb#x"))
	assert.False(t, validRedirectURI("https://user:pw@example.com/cb"))
}

func TestPKCE(t *testing.T) {
	verifier := strings.Repeat("abcdefghij", 5)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	assert.True(t, codeChallengeWellFormed(challenge))
	assert.True(t, verifyPKCE(verifier, challenge))
	assert.False(t, verifyPKCE(verifier+"x", challenge))
	assert.False(t, verifyPKCE("short", challenge))
	assert.False(t, verifyPKCE(strings.Repeat("a", 129), challenge))
	assert.False(t, codeChallengeWellFormed("plain-challenge"))
	assert.False(t, codeChallengeWellFormed(strings.Repeat("+", 43)))
}

func TestUserCodes(t *testing.T) {
	for i := 0; i < 50; i++ {
		code, err := newUserCode()
		require.NoError(t, err)
		require.Len(t, code, 8)
		assert.Equal(t, code, normalizeUserCode(formatUserCode(code)))
		assert.Equal(t, code, normalizeUserCode(strings.ToLower(formatUserCode(code))))
	}
	assert.Equal(t, "ABCD1234", normalizeUserCode("abcd-1234"))
	assert.Equal(t, "0B1D1234", normalizeUserCode("obid-l234"))
	assert.Equal(t, "", normalizeUserCode("ABCD-123"))
	assert.Equal(t, "", normalizeUserCode("ABCD-123U"))
	assert.Equal(t, "", normalizeUserCode("ABCD-12345"))
	assert.Equal(t, "ABCD-1234", formatUserCode("ABCD1234"))
}

func TestParseRequestedScopes(t *testing.T) {
	s, ok := parseRequestedScopes("")
	assert.True(t, ok)
	assert.Equal(t, AllScopes(), s)
	s, ok = parseRequestedScopes("kindred:complete kindred:read offline_access")
	assert.True(t, ok)
	assert.Equal(t, []string{ScopeRead, ScopeComplete}, s)
	_, ok = parseRequestedScopes("kindred:read kindred:admin")
	assert.False(t, ok)
}

func TestCacheTTL(t *testing.T) {
	assert.Equal(t, minMetadataCacheTTL, cacheTTL(""))
	assert.Equal(t, minMetadataCacheTTL, cacheTTL("max-age=10"))
	assert.Equal(t, time.Hour, cacheTTL("public, max-age=3600"))
	assert.Equal(t, maxMetadataCacheTTL, cacheTTL("max-age=99999999"))
	assert.Equal(t, minMetadataCacheTTL, cacheTTL("no-store"))
}

func TestBlockedAddr(t *testing.T) {
	blocked := []string{"127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0",
		"100.64.0.1", "::1", "fe80::1", "fc00::1", "::", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "224.0.0.1"}
	for _, a := range blocked {
		assert.True(t, blockedAddr(netip.MustParseAddr(a)), a)
	}
	for _, a := range []string{"8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"} {
		assert.False(t, blockedAddr(netip.MustParseAddr(a)), a)
	}
}

func TestFetchPolicy(t *testing.T) {
	var body = []byte(`{}`)
	contentType := "application/json; charset=utf-8"
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/client.json", http.StatusFound)
			return
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "max-age=7200")
		_, _ = w.Write(body)
	}))
	defer srv.Close()
	ctx := context.Background()
	rootCAs := srv.Client().Transport.(*http.Transport).TLSClientConfig.RootCAs

	strict := newMetadataFetcher(DefaultFetchPolicy())
	_, _, err := strict.fetch(ctx, srv.URL+"/client.json")
	assert.Error(t, err, "IP literal hosts are rejected before dialing")
	_, _, err = strict.fetch(ctx, "http://example.com/client.json")
	assert.Error(t, err, "plain http is rejected")
	_, _, err = strict.fetch(ctx, "https://localhost/client.json")
	assert.ErrorIs(t, err, errBlockedAddress)

	// The dialer guard catches names that resolve to blocked addresses (DNS rebinding).
	port := srv.Listener.Addr().(interface{ String() string }).String()
	port = port[strings.LastIndex(port, ":"):]
	guarded := newMetadataFetcher(FetchPolicy{RootCAs: rootCAs})
	_, _, err = guarded.fetch(ctx, "https://localtest.me"+port+"/client.json")
	assert.Error(t, err)

	open := newMetadataFetcher(FetchPolicy{AllowPrivateNetworks: true, RootCAs: rootCAs, MaxBytes: 64})
	got, ttl, err := open.fetch(ctx, srv.URL+"/client.json")
	require.NoError(t, err)
	assert.Equal(t, body, got)
	assert.Equal(t, 2*time.Hour, ttl)

	_, _, err = open.fetch(ctx, srv.URL+"/redirect")
	assert.Error(t, err, "redirects are not followed")

	body = []byte(`{"pad":"` + strings.Repeat("x", 100) + `"}`)
	_, _, err = open.fetch(ctx, srv.URL+"/client.json")
	assert.Error(t, err, "oversized body")

	body = []byte(`{}`)
	contentType = "text/html"
	_, _, err = open.fetch(ctx, srv.URL+"/client.json")
	assert.Error(t, err, "wrong content type")
}

func TestRateLimiter(t *testing.T) {
	now := time.Unix(0, 0)
	rl := newRateLimiter(2, time.Minute)
	rl.now = func() time.Time { return now }
	assert.True(t, rl.Allow("a"))
	assert.True(t, rl.Allow("a"))
	assert.False(t, rl.Allow("a"))
	assert.True(t, rl.Allow("b"))
	now = now.Add(2 * time.Minute)
	assert.True(t, rl.Allow("a"))
}

func TestSecrets(t *testing.T) {
	at, err := newSecret(accessTokenPrefix)
	require.NoError(t, err)
	assert.True(t, secretWellFormed(at, accessTokenPrefix))
	assert.False(t, secretWellFormed(at, refreshTokenPrefix))
	assert.False(t, secretWellFormed("kdr_"+at[len(accessTokenPrefix):], accessTokenPrefix))
	assert.Len(t, hashSecret(at), 64)
}

func TestQRDataURI(t *testing.T) {
	uri, err := qrDataURI(deepLinkBase + "abcdefghijklmnopqrstuv")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(uri, "data:image/svg+xml;base64,"))
}
