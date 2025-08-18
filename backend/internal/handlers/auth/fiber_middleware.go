package auth

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/xlog"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// FiberAuthMiddleware creates a Fiber-native middleware function for validating JWT tokens
func FiberAuthMiddleware(collections map[string]*mongo.Collection, cfg config.Config) fiber.Handler {
	service := newService(collections, cfg)

	return func(c *fiber.Ctx) error {

		// Extract Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			xlog.AuthError("Missing authorization header")
			return c.Status(401).JSON(fiber.Map{
				"error":  "Missing authorization header",
				"status": 401,
			})
		}

		// Parse Bearer token
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			xlog.AuthError(fmt.Sprintf("Invalid authorization header format (parts: %d, first: %s)",
				len(parts), parts[0]))
			return c.Status(401).JSON(fiber.Map{
				"error":  "Invalid authorization header format",
				"status": 401,
			})
		}

		accessToken := parts[1]

		// Try to validate access token first
		xlog.ValidationLog("Attempting to validate access token...")
		userID, _, err := service.ValidateToken(accessToken)
		if err != nil {
			xlog.AuthError(fmt.Sprintf("Access token validation failed: %v", err))

			// Access token is invalid, try refresh token
			refreshToken := c.Get("refresh_token")
			if refreshToken == "" {
				xlog.AuthError("No refresh token provided after access token failed")
				return c.Status(401).JSON(fiber.Map{
					"error":  "Access token invalid and no refresh token provided",
					"status": 401,
				})
			}

			xlog.RefreshLog(fmt.Sprintf("Attempting refresh token validation (length: %d)", len(refreshToken)))

			// Validate refresh token
			newCount, err := validateRefreshTokenFiber(service, refreshToken)
			if err != nil {
				xlog.AuthError(fmt.Sprintf("Refresh token validation failed: %v", err))
				return c.Status(401).JSON(fiber.Map{
					"error":  fmt.Sprintf("Both access and refresh tokens are invalid: %v", err),
					"status": 401,
				})
			}

			xlog.RefreshLog("Refresh token valid, generating new tokens...")

			// Generate new tokens
			userID, _, _ = service.ValidateToken(refreshToken)
			newAccess, newRefresh, err := service.GenerateTokens(userID, newCount)
			if err != nil {
				xlog.AuthError(fmt.Sprintf("Failed to generate new tokens: %v", err))
				return c.Status(500).JSON(fiber.Map{
					"error":  "Failed to generate new tokens",
					"status": 500,
				})
			}

			// Mark refresh token as used
			if err := service.UseToken(userID); err != nil {
				xlog.AuthError(fmt.Sprintf("Failed to mark token as used: %v", err))
				return c.Status(500).JSON(fiber.Map{
					"error":  "Failed to update token usage",
					"status": 500,
				})
			}

			// Set new tokens in response headers
			c.Set("access_token", newAccess)
			c.Set("refresh_token", newRefresh)
		} else {
		}

		// Add user ID to Fiber context locals
		c.Locals(UserIDContextKey, userID)

		// Continue to next handler
		return c.Next()
	}
}

// validateRefreshTokenFiber validates a refresh token and returns the count (Fiber version)
func validateRefreshTokenFiber(service *Service, refreshToken string) (float64, error) {
	slog.Info("🔄 REFRESH TOKEN FIBER: Starting validation process")

	// Validate the refresh token
	userID, count, err := service.ValidateToken(refreshToken)
	if err != nil {
		slog.Error("❌ REFRESH TOKEN FIBER: Token validation failed", "error", err.Error())
		return 0, fmt.Errorf("refresh token invalid: %v", err)
	}

	// Check if the refresh token is unused
	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		slog.Error("❌ REFRESH TOKEN FIBER: Invalid user ID format", "user_id", userID, "error", err.Error())
		return 0, fmt.Errorf("invalid user ID in refresh token: %v", err)
	}

	used, err := service.CheckIfTokenUsed(id)
	if err != nil {
		slog.Error("❌ REFRESH TOKEN FIBER: Error checking token usage", "error", err.Error())
		return 0, fmt.Errorf("error checking token usage: %v", err)
	}

	if used {
		slog.Error("❌ REFRESH TOKEN FIBER: Token already used", "user_id", userID)
		return 0, fmt.Errorf("refresh token has already been used")
	}

	return count, nil
}

// GetUserIDFromFiberContext extracts the user ID from the Fiber context
func GetUserIDFromFiberContext(c *fiber.Ctx) (string, bool) {
	userID, ok := c.Locals(UserIDContextKey).(string)
	return userID, ok
}

// RequireAuthFiber is a helper function that can be used to check if a user is authenticated in Fiber
func RequireAuthFiber(c *fiber.Ctx) (string, error) {
	userID, ok := GetUserIDFromFiberContext(c)
	if !ok {
		slog.Error("❌ REQUIRE AUTH FIBER: User not found in context")
		return "", fmt.Errorf("user not authenticated")
	}
	return userID, nil
}

// FiberAuthMiddlewareForServer creates auth middleware for the Fiber server
func FiberAuthMiddlewareForServer(collections map[string]*mongo.Collection) fiber.Handler {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load configuration for Fiber auth middleware", "error", err.Error())
		return func(c *fiber.Ctx) error {
			return c.Status(500).JSON(fiber.Map{"error": "Server configuration error"})
		}
	}
	return FiberAuthMiddleware(collections, cfg)
}
