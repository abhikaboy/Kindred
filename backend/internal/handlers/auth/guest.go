package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	guestDisplayName  = "Guest"
	guestHandlePrefix = "@guest_"
	// Same default avatar the onboarding flow registers email users with, so
	// the client's "has default avatar" checks treat guests the same way.
	guestProfilePicture = "https://i.pinimg.com/736x/45/69/cb/4569cb1033f0251fac46f307c3ba495a.jpg"

	// Guest creation is unauthenticated, so it is capped per client IP.
	guestRateLimitPerIP  = 100
	guestRateLimitWindow = time.Hour

	guestHandleAttempts = 5
)

// GuestLoginRequest is the optional body for POST /v1/auth/guest.
type GuestLoginRequest struct {
	DeviceID string `json:"deviceId,omitempty" maxLength:"256" doc:"Stable per-install identifier, stored for cleanup and analytics"`
	Timezone string `json:"timezone,omitempty" maxLength:"64" doc:"IANA timezone, defaults to UTC"`
}

type GuestLoginInput struct {
	Body *GuestLoginRequest `json:"body"`

	clientIP string
}

// Resolve captures the caller's IP for rate limiting. Huma runs this after
// parsing and before the handler, which is the only place the raw request is
// reachable without going through Fiber.
func (i *GuestLoginInput) Resolve(ctx huma.Context) []error {
	i.clientIP = clientIPFromRequest(ctx.Header, ctx.RemoteAddr())
	return nil
}

// clientIPFromRequest prefers proxy-supplied headers, then the socket address.
//
// These headers can be forged by a client talking to us directly, so this is
// a speed bump for scripted guest creation, not a security boundary. We take
// the left-most X-Forwarded-For entry deliberately: the right-most one is the
// nearest proxy, and bucketing every user behind a CDN edge together would
// lock out real people.
func clientIPFromRequest(header func(string) string, remoteAddr string) string {
	if ip := strings.TrimSpace(header("CF-Connecting-IP")); ip != "" {
		return ip
	}
	if ip := strings.TrimSpace(header("X-Real-IP")); ip != "" {
		return ip
	}
	if xff := header("X-Forwarded-For"); xff != "" {
		if first := strings.TrimSpace(strings.Split(xff, ",")[0]); first != "" {
			return first
		}
	}
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		return host
	}
	return remoteAddr
}

// RegisterGuestLoginOperation registers the guest account endpoint
func RegisterGuestLoginOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "login-guest",
		Method:      http.MethodPost,
		Path:        "/v1/auth/guest",
		Summary:     "Create guest account",
		Description: "Creates a credential-less guest account so the app is usable before sign up. Returns tokens in the access_token and refresh_token headers and the user in the body, exactly like register.",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *GuestLoginInput) (*RegisterOutput, error) {
		return handler.CreateGuestHuma(ctx, input)
	})
}

// CreateGuestHuma handles guest account creation (PUBLIC ROUTE)
func (h *Handler) CreateGuestHuma(ctx context.Context, input *GuestLoginInput) (*RegisterOutput, error) {
	if h.guestLimiter != nil && input.clientIP != "" && !h.guestLimiter.Allow(input.clientIP) {
		slog.LogAttrs(ctx, slog.LevelWarn, "Guest creation rate limit exceeded",
			slog.String("ip", input.clientIP),
		)
		return nil, huma.Error429TooManyRequests("Too many new accounts from this network. Please try again later.")
	}

	deviceID, timezone := "", ""
	if input.Body != nil {
		deviceID = strings.TrimSpace(input.Body.DeviceID)
		timezone = strings.TrimSpace(input.Body.Timezone)
	}

	result, err := h.service.CreateGuestUser(ctx, deviceID, timezone)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Guest creation failed",
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to start a guest session. Please try again.", err)
	}

	// Mirrors RegisterWithContext. The founder's welcome congratulation is
	// deliberately not sent: guests are created on every fresh install and most
	// are abandoned, so it is better sent when the account is upgraded.
	go func() {
		referralCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := h.service.CreateReferralDocumentForUser(referralCtx, result.User.ID); err != nil {
			slog.LogAttrs(referralCtx, slog.LevelError, "Failed to create referral document for guest",
				slog.String("userId", result.User.ID.Hex()),
				slog.String("error", err.Error()))
		}
	}()

	slog.LogAttrs(ctx, slog.LevelInfo, "Guest user created",
		slog.String("userId", result.User.ID.Hex()),
		slog.String("handle", result.User.Handle),
		slog.Bool("hasDeviceId", deviceID != ""),
	)

	resp := &RegisterOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}

// CreateGuestUser inserts a guest account and seeds its default workspace.
//
// The workspace is seeded synchronously (unlike register, which does it in a
// goroutine) because the client fetches workspaces immediately after this
// returns and a guest has no onboarding screens to hide the delay behind.
func (s *Service) CreateGuestUser(ctx context.Context, deviceID string, timezone string) (*AuthResult, error) {
	id := primitive.NewObjectID()
	timezone = timezoneOrDefault(timezone)

	handle, err := s.generateGuestHandle(ctx)
	if err != nil {
		return nil, err
	}

	access, refresh, err := s.GenerateTokens(id.Hex(), 0, timezone)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	user := User{
		ID:           id,
		RefreshToken: refresh,
		TokenUsed:    false,
		Count:        0,

		Categories:     make([]types.CategoryDocument, 0),
		Friends:        make([]primitive.ObjectID, 0),
		TasksComplete:  0,
		RecentActivity: make([]types.ActivityDocument, 0),

		DisplayName:    guestDisplayName,
		Handle:         handle,
		ProfilePicture: guestProfilePicture,
		Timezone:       timezone,

		Encouragements:  2,
		Congratulations: 2,
		Streak:          0,
		StreakEligible:  true,
		Points:          0,
		PostsMade:       0,
		Credits:         types.GetDefaultCredits(),
		Subscription:    types.GetDefaultSubscription(),
		Settings:        types.DefaultUserSettings(),

		IsGuest:       true,
		GuestDeviceID: deviceID,
	}

	if err := s.users.CreateUser(ctx, &user); err != nil {
		return nil, fmt.Errorf("failed to create guest user: %w", err)
	}

	return &AuthResult{
		AccessToken:  access,
		RefreshToken: refresh,
		User:         buildSafeUserResponse(&user),
	}, nil
}

// generateGuestHandle returns an unused handle of the form @guest_<8 hex>.
// Collisions are vanishingly rare at 32 bits, but handles have no unique
// index, so we check rather than rely on an insert error.
func (s *Service) generateGuestHandle(ctx context.Context) (string, error) {
	for attempt := 0; attempt < guestHandleAttempts; attempt++ {
		buf := make([]byte, 4)
		if _, err := rand.Read(buf); err != nil {
			return "", fmt.Errorf("failed to generate guest handle: %w", err)
		}
		handle := guestHandlePrefix + hex.EncodeToString(buf)

		taken, err := s.users.HandleExists(ctx, handle)
		if err != nil {
			return "", fmt.Errorf("failed to check guest handle: %w", err)
		}
		if !taken {
			return handle, nil
		}
	}
	return "", errors.New("could not find an unused guest handle")
}
