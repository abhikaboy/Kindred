package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ========================================
// Unit tests (no MongoDB)
// ========================================

func TestGuestRateLimiter_AllowsUpToMaxPerWindow(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	limiter := newGuestRateLimiter(3, time.Hour)
	limiter.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		assert.True(t, limiter.Allow("1.2.3.4"), "request %d should be allowed", i+1)
	}
	assert.False(t, limiter.Allow("1.2.3.4"), "4th request in the window should be rejected")

	// Other IPs have their own bucket
	assert.True(t, limiter.Allow("5.6.7.8"))

	// A new window resets the count
	now = now.Add(time.Hour + time.Second)
	assert.True(t, limiter.Allow("1.2.3.4"))
}

func TestGuestRateLimiter_ZeroMaxRejectsEverything(t *testing.T) {
	limiter := newGuestRateLimiter(0, time.Hour)
	assert.False(t, limiter.Allow("1.2.3.4"))
}

func TestClientIPFromRequest(t *testing.T) {
	headers := func(h map[string]string) func(string) string {
		return func(name string) string { return h[name] }
	}

	assert.Equal(t, "9.9.9.9", clientIPFromRequest(headers(map[string]string{
		"CF-Connecting-IP": "9.9.9.9",
		"X-Real-IP":        "8.8.8.8",
		"X-Forwarded-For":  "7.7.7.7",
	}), "10.0.0.1:5000"))

	assert.Equal(t, "8.8.8.8", clientIPFromRequest(headers(map[string]string{
		"X-Real-IP":       "8.8.8.8",
		"X-Forwarded-For": "7.7.7.7",
	}), "10.0.0.1:5000"))

	assert.Equal(t, "7.7.7.7", clientIPFromRequest(headers(map[string]string{
		"X-Forwarded-For": "7.7.7.7, 10.0.0.2",
	}), "10.0.0.1:5000"))

	assert.Equal(t, "10.0.0.1", clientIPFromRequest(headers(nil), "10.0.0.1:5000"))
}

func TestGuestLogin_RateLimitedReturns429(t *testing.T) {
	_, api := humatest.New(t)
	handler := &Handler{
		service:      nil, // never reached: the limiter rejects first
		config:       config.Config{Auth: config.Auth{Secret: "test-secret-key"}},
		guestLimiter: newGuestRateLimiter(0, time.Hour),
	}
	RegisterGuestLoginOperation(api, handler)

	resp := api.Post("/v1/auth/guest", map[string]any{"deviceId": "device-1"})
	assert.Equal(t, http.StatusTooManyRequests, resp.Code)
}

// ========================================
// MongoDB-backed tests
// ========================================

// setupGuestTestDB returns an ephemeral database, skipping when MongoDB is not
// reachable so `go test -short` and machines without Mongo still pass.
func setupGuestTestDB(t *testing.T) map[string]*mongo.Collection {
	t.Helper()
	if testing.Short() {
		t.Skip("skipping MongoDB-backed test in -short mode")
	}

	testDB, _, err := testpkg.SetupTestEnvironment()
	if err != nil {
		t.Skipf("skipping: MongoDB not available: %v", err)
	}
	t.Cleanup(func() {
		_ = testpkg.TeardownTestEnvironment(testDB)
	})
	return testDB.GetCollections()
}

func newGuestTestHandler(collections map[string]*mongo.Collection) *Handler {
	cfg := config.Config{Auth: config.Auth{Secret: "test-secret-key"}}
	return &Handler{
		service:      NewServiceWithConfig(collections, cfg),
		config:       cfg,
		guestLimiter: newGuestRateLimiter(guestRateLimitPerIP, guestRateLimitWindow),
	}
}

func TestGuestLogin_CreatesGuestWithTokensAndWorkspace(t *testing.T) {
	collections := setupGuestTestDB(t)
	handler := newGuestTestHandler(collections)

	_, api := humatest.New(t)
	RegisterGuestLoginOperation(api, handler)

	resp := api.Post("/v1/auth/guest", map[string]any{"deviceId": "device-abc", "timezone": "America/New_York"})
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())

	access := resp.Header().Get("access_token")
	refresh := resp.Header().Get("refresh_token")
	assert.NotEmpty(t, access)
	assert.NotEmpty(t, refresh)

	var body map[string]any
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
	assert.Equal(t, true, body["isGuest"])
	assert.Equal(t, guestDisplayName, body["display_name"])
	assert.Equal(t, guestProfilePicture, body["profile_picture"])
	handle, _ := body["handle"].(string)
	assert.True(t, strings.HasPrefix(handle, guestHandlePrefix), "handle %q should start with %q", handle, guestHandlePrefix)

	idHex, _ := body["_id"].(string)
	userID, err := primitive.ObjectIDFromHex(idHex)
	require.NoError(t, err)

	// Tokens validate against the same service the auth middleware uses
	tokenUserID, _, timezone, err := handler.service.ValidateToken(access)
	require.NoError(t, err)
	assert.Equal(t, idHex, tokenUserID)
	assert.Equal(t, "America/New_York", timezone)

	// Stored document is a credential-less guest
	var stored types.User
	require.NoError(t, collections["users"].FindOne(context.Background(), bson.M{"_id": userID}).Decode(&stored))
	assert.True(t, stored.IsGuest)
	assert.Equal(t, "device-abc", stored.GuestDeviceID)
	assert.Empty(t, stored.Email)
	assert.Empty(t, stored.Phone)
	assert.Empty(t, stored.AppleID)
	assert.Empty(t, stored.GoogleID)
	assert.Empty(t, stored.Password)
	assert.Equal(t, refresh, stored.RefreshToken)

	// Workspace is seeded before the response, not in the background
	count, err := collections["categories"].CountDocuments(context.Background(), bson.M{"user": userID})
	require.NoError(t, err)
	assert.Greater(t, count, int64(0), "default workspace should be seeded synchronously")

	// The token-login path the app calls on launch reports the guest flag
	safeUser, err := handler.service.GetUser(idHex)
	require.NoError(t, err)
	assert.True(t, safeUser.IsGuest)

	// The refresh token can be exchanged for a new pair
	RegisterRefreshTokenOperation(api, handler)
	refreshResp := api.Post("/v1/auth/refresh", "refresh_token: "+refresh)
	assert.Equal(t, http.StatusOK, refreshResp.Code, refreshResp.Body.String())
	assert.NotEmpty(t, refreshResp.Header().Get("access_token"))
}

func TestGuestLogin_NoBodyAndUniqueHandles(t *testing.T) {
	collections := setupGuestTestDB(t)
	handler := newGuestTestHandler(collections)

	_, api := humatest.New(t)
	RegisterGuestLoginOperation(api, handler)

	handles := make(map[string]bool)
	for i := 0; i < 3; i++ {
		resp := api.Post("/v1/auth/guest")
		require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())

		var body map[string]any
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
		handle, _ := body["handle"].(string)
		assert.False(t, handles[handle], "handle %q was issued twice", handle)
		handles[handle] = true
	}

	count, err := collections["users"].CountDocuments(context.Background(), bson.M{"isGuest": true})
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)
}
