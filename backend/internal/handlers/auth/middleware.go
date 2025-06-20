package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/abhikaboy/Kindred/internal/config"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const UserIDContextKey = "user_id"

// AuthMiddleware creates a middleware function for validating JWT tokens
func AuthMiddleware(collections map[string]*mongo.Collection, cfg config.Config) func(http.Handler) http.Handler {
	service := newService(collections, cfg)
	
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"Missing authorization header","status":401}`, http.StatusUnauthorized)
				return
			}

			// Parse Bearer token
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, `{"error":"Invalid authorization header format","status":401}`, http.StatusUnauthorized)
				return
			}
			
			accessToken := parts[1]
			
			// Try to validate access token first
			userID, _, err := service.ValidateToken(accessToken)
			if err != nil {
				// Access token is invalid, try refresh token
				refreshToken := r.Header.Get("refresh_token")
				if refreshToken == "" {
					http.Error(w, `{"error":"Access token invalid and no refresh token provided","status":401}`, http.StatusUnauthorized)
					return
				}
				
				// Validate refresh token
				newCount, err := validateRefreshToken(service, refreshToken)
				if err != nil {
					http.Error(w, fmt.Sprintf(`{"error":"Both access and refresh tokens are invalid: %v","status":401}`, err), http.StatusUnauthorized)
					return
				}
				
				// Generate new tokens
				userID, _, _ = service.ValidateToken(refreshToken)
				newAccess, newRefresh, err := service.GenerateTokens(userID, newCount)
				if err != nil {
					http.Error(w, `{"error":"Failed to generate new tokens","status":500}`, http.StatusInternalServerError)
					return
				}
				
				// Mark refresh token as used
				if err := service.UseToken(userID); err != nil {
					http.Error(w, `{"error":"Failed to update token usage","status":500}`, http.StatusInternalServerError)
					return
				}
				
				// Set new tokens in response headers
				w.Header().Set("access_token", newAccess)
				w.Header().Set("refresh_token", newRefresh)
			}
			
			// Add user ID to context
			ctx := context.WithValue(r.Context(), UserIDContextKey, userID)
			r = r.WithContext(ctx)
			
			// Continue to next handler
			next.ServeHTTP(w, r)
		})
	}
}

// validateRefreshToken validates a refresh token and returns the count
func validateRefreshToken(service *Service, refreshToken string) (float64, error) {
	// Validate the refresh token
	userID, count, err := service.ValidateToken(refreshToken)
	if err != nil {
		return 0, fmt.Errorf("refresh token invalid: %v", err)
	}
	
	// Check if the refresh token is unused
	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return 0, fmt.Errorf("invalid user ID in refresh token: %v", err)
	}
	
	used, err := service.CheckIfTokenUsed(id)
	if err != nil {
		return 0, fmt.Errorf("error checking token usage: %v", err)
	}
	
	if used {
		return 0, fmt.Errorf("refresh token has already been used")
	}
	
	return count, nil
}

// GetUserIDFromContext extracts the user ID from the request context
func GetUserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(UserIDContextKey).(string)
	return userID, ok
}

// RequireAuth is a helper function that can be used to check if a user is authenticated
func RequireAuth(ctx context.Context) (string, error) {
	userID, ok := GetUserIDFromContext(ctx)
	if !ok {
		return "", fmt.Errorf("user not authenticated")
	}
	return userID, nil
} 