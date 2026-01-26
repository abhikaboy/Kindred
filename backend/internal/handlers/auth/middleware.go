package auth

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	UserIDContextKey   contextKey = "user_id"
	TimezoneContextKey contextKey = "timezone"
)

// AuthMiddleware creates a middleware function for validating JWT tokens
func AuthMiddleware(collections map[string]*mongo.Collection, cfg config.Config) func(http.Handler) http.Handler {
	service := newService(collections, cfg)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			slog.Info("🔐 AUTH MIDDLEWARE: Starting authentication process",
				"method", r.Method,
				"path", r.URL.Path,
				"remote_addr", r.RemoteAddr)

			// Extract Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				slog.Error("❌ AUTH MIDDLEWARE: Missing authorization header")
				http.Error(w, `{"error":"Missing authorization header","status":401}`, http.StatusUnauthorized)
				return
			}
			slog.Info("✅ AUTH MIDDLEWARE: Authorization header found", "header_length", len(authHeader))

			// Parse Bearer token
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				slog.Error("❌ AUTH MIDDLEWARE: Invalid authorization header format",
					"parts_count", len(parts),
					"first_part", parts[0])
				http.Error(w, `{"error":"Invalid authorization header format","status":401}`, http.StatusUnauthorized)
				return
			}

			accessToken := parts[1]
			slog.Info("✅ AUTH MIDDLEWARE: Bearer token extracted", "token_length", len(accessToken))

			// Try to validate access token first
			slog.Info("🔍 AUTH MIDDLEWARE: Attempting to validate access token...")
			userID, count, timezone, err := service.ValidateToken(accessToken)
			if err != nil {
				slog.Error("❌ AUTH MIDDLEWARE: Access token validation failed", "error", err.Error())

				// Access token is invalid, try refresh token
				refreshToken := r.Header.Get("refresh_token")
				if refreshToken == "" {
					slog.Error("❌ AUTH MIDDLEWARE: No refresh token provided after access token failed")
					http.Error(w, `{"error":"Access token invalid and no refresh token provided","status":401}`, http.StatusUnauthorized)
					return
				}

				slog.Info("🔄 AUTH MIDDLEWARE: Attempting refresh token validation", "refresh_token_length", len(refreshToken))

				// Validate refresh token
				newCount, newTimezone, err := validateRefreshToken(service, refreshToken)
				if err != nil {
					slog.Error("❌ AUTH MIDDLEWARE: Refresh token validation failed", "error", err.Error())
					http.Error(w, fmt.Sprintf(`{"error":"Both access and refresh tokens are invalid: %v","status":401}`, err), http.StatusUnauthorized)
					return
				}

				slog.Info("✅ AUTH MIDDLEWARE: Refresh token valid, generating new tokens...")

				// Generate new tokens
				userID, _, _, _ = service.ValidateToken(refreshToken)
				timezone = newTimezone
				newAccess, newRefresh, err := service.GenerateTokens(userID, newCount, timezone)
				if err != nil {
					slog.Error("❌ AUTH MIDDLEWARE: Failed to generate new tokens", "error", err.Error())
					http.Error(w, `{"error":"Failed to generate new tokens","status":500}`, http.StatusInternalServerError)
					return
				}

				slog.Info("✅ AUTH MIDDLEWARE: New tokens generated successfully")

				// Mark refresh token as used
				if err := service.UseToken(userID); err != nil {
					slog.Error("❌ AUTH MIDDLEWARE: Failed to mark token as used", "error", err.Error())
					http.Error(w, `{"error":"Failed to update token usage","status":500}`, http.StatusInternalServerError)
					return
				}

				// Set new tokens in response headers
				w.Header().Set("access_token", newAccess)
				w.Header().Set("refresh_token", newRefresh)
				slog.Info("✅ AUTH MIDDLEWARE: New tokens set in response headers")
			} else {
				slog.Info("✅ AUTH MIDDLEWARE: Access token validation successful",
					"user_id", userID,
					"count", count,
					"timezone", timezone)
			}

			// Add user ID and timezone to context (using custom type to avoid collisions)
			ctx := context.WithValue(r.Context(), UserIDContextKey, userID)
			ctx = context.WithValue(ctx, TimezoneContextKey, timezone)
			r = r.WithContext(ctx)

			slog.Info("🎯 AUTH MIDDLEWARE: Authentication complete, proceeding to handler", "user_id", userID)

			// Continue to next handler
			next.ServeHTTP(w, r)
		})
	}
}

// validateRefreshToken validates a refresh token and returns the count and timezone
func validateRefreshToken(service *Service, refreshToken string) (float64, string, error) {
	slog.Info("🔄 REFRESH TOKEN: Starting validation process")

	// Validate the refresh token
	userID, count, timezone, err := service.ValidateToken(refreshToken)
	if err != nil {
		slog.Error("❌ REFRESH TOKEN: Token validation failed", "error", err.Error())
		return 0, "", fmt.Errorf("refresh token invalid: %v", err)
	}

	slog.Info("✅ REFRESH TOKEN: Token structure valid", "user_id", userID, "count", count, "timezone", timezone)

	// Check if the refresh token is unused
	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		slog.Error("❌ REFRESH TOKEN: Invalid user ID format", "user_id", userID, "error", err.Error())
		return 0, "", fmt.Errorf("invalid user ID in refresh token: %v", err)
	}

	used, err := service.CheckIfTokenUsed(id)
	if err != nil {
		slog.Error("❌ REFRESH TOKEN: Error checking token usage", "error", err.Error())
		return 0, "", fmt.Errorf("error checking token usage: %v", err)
	}

	if used {
		slog.Error("❌ REFRESH TOKEN: Token already used", "user_id", userID)
		return 0, "", fmt.Errorf("refresh token has already been used")
	}

	slog.Info("✅ REFRESH TOKEN: Validation complete", "user_id", userID, "count", count, "timezone", timezone)
	return count, timezone, nil
}

// GetUserIDFromContext extracts the user ID from the request context
// This function bridges Huma context to Fiber context when needed
func GetUserIDFromContext(ctx context.Context) (string, bool) {
	// Try to get user ID from the standard context first (set by middleware)
	if userID, ok := ctx.Value(UserIDContextKey).(string); ok {
		return userID, true
	}

	// If that doesn't work, check if we can find the Fiber context
	if fiberCtx, ok := ctx.Value("fiber_ctx").(*fiber.Ctx); ok {
		return GetUserIDFromFiberContext(fiberCtx)
	}

	return "", false
}

// RequireAuth is a helper function that can be used to check if a user is authenticated
func RequireAuth(ctx context.Context) (string, error) {
	userID, ok := GetUserIDFromContext(ctx)
	if !ok {
		slog.Error("❌ REQUIRE AUTH: User not found in context")
		return "", fmt.Errorf("user not authenticated")
	}
	slog.Info("✅ REQUIRE AUTH: User authenticated", "user_id", userID)
	return userID, nil
}

// OptionalAuth is a helper function that checks if a user is authenticated but doesn't fail if not
func OptionalAuth(ctx context.Context) (string, bool) {
	userID, ok := GetUserIDFromContext(ctx)
	if ok {
		slog.Info("✅ OPTIONAL AUTH: User authenticated", "user_id", userID)
	} else {
		slog.Info("ℹ️ OPTIONAL AUTH: User not authenticated, proceeding without auth")
	}
	return userID, ok
}

// GetTimezoneFromContext extracts the timezone from the request context
func GetTimezoneFromContext(ctx context.Context) (string, bool) {
	// Try to get timezone from the standard context first (set by middleware)
	if timezone, ok := ctx.Value(TimezoneContextKey).(string); ok && timezone != "" {
		return timezone, true
	}
	return "", false
}

// GetTimezoneOrDefault extracts the timezone from context, defaulting to UTC if not found
func GetTimezoneOrDefault(ctx context.Context) string {
	if timezone, ok := GetTimezoneFromContext(ctx); ok {
		return timezone
	}
	return "UTC"
}
