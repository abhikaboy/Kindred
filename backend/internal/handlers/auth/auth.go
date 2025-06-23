package auth

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// LoginHuma handles user login with email/password
func (h *Handler) LoginHuma(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromCredentials(input.Body.Email, input.Body.Password)
	if err != nil {
		return nil, huma.Error500InternalServerError("Login failed", err)
	}

	access, refresh, err := h.service.GenerateTokens(id.Hex(), *count)
	if err != nil {
		return nil, huma.Error500InternalServerError("Token generation failed", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = access
	resp.RefreshToken = refresh
	resp.Body = types.SafeUser{
		ID:             user.ID,
		DisplayName:    user.DisplayName,
		Handle:         user.Handle,
		ProfilePicture: user.ProfilePicture,
		Categories:     user.Categories,
		Friends:        user.Friends,
		TasksComplete:  user.TasksComplete,
		RecentActivity: user.RecentActivity,
	}
	
	return resp, nil
}

// LoginWithTokenHuma handles login with existing token (PROTECTED ROUTE)
func (h *Handler) LoginWithTokenHuma(ctx context.Context, input *LoginWithTokenInput) (*LoginOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := RequireAuthFromHuma(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user, err := h.service.GetUser(user_id)
	if err != nil {
		return nil, huma.Error500InternalServerError("User retrieval failed", err)
	}

	resp := &LoginOutput{}
	resp.Body = types.SafeUser{
		ID:             user.ID,
		DisplayName:    user.DisplayName,
		Handle:         user.Handle,
		ProfilePicture: user.ProfilePicture,
		Categories:     user.Categories,
		Friends:        user.Friends,
		TasksComplete:  user.TasksComplete,
		RecentActivity: user.RecentActivity,
	}
	return resp, nil
}

// RegisterHuma handles regular user registration
func (h *Handler) RegisterHuma(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
	return h.RegisterWithContext(ctx, input)
}

// RegisterWithAppleHuma handles Apple registration
func (h *Handler) RegisterWithAppleHuma(ctx context.Context, input *RegisterWithAppleInput) (*RegisterOutput, error) {
	slog.Info("Register Request With Apple", "request", input.Body.AppleID)
	
	// Convert to regular register input and add Apple ID to context
	ctxWithApple := context.WithValue(ctx, "apple_id", input.Body.AppleID)
	
	registerInput := &RegisterInput{
		Body: RegisterRequest{
			Email:    input.Body.Email,
			Password: "", // Apple registration doesn't require password
		},
	}
	
	return h.RegisterWithContext(ctxWithApple, registerInput)
}

// RegisterWithContext handles registration with context (used for Apple/Google)
func (h *Handler) RegisterWithContext(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
	slog.Info("Register Request", "request", input.Body, "apple_id", ctx.Value("apple_id"))

	errs := xvalidator.Validator.Validate(&input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	id := primitive.NewObjectID()

	access, refresh, err := h.service.GenerateTokens(id.Hex(), 0) // new users use count = 0
	if err != nil {
		return nil, huma.Error500InternalServerError("Token generation failed", err)
	}

	aaid := ctx.Value("apple_id")
	googleid := ctx.Value("google_id")

	if aaid == nil {
		aaid = ""
	}

	if googleid == nil {
		googleid = ""
	}

	user := User{
		Email:        input.Body.Email,
		Password:     input.Body.Password,
		ID:           id,
		RefreshToken: refresh,
		TokenUsed:    false,
		Count:        0,

		Categories:     make([]types.CategoryDocument, 0),
		Friends:        make([]primitive.ObjectID, 0),
		TasksComplete:  0,
		RecentActivity: make([]types.ActivityDocument, 0),

		DisplayName:    "Default Username",
		Handle:         "@default",
		ProfilePicture: "https://i.pinimg.com/736x/bd/46/35/bd463547b9ae986ba4d44d717828eb09.jpg",

		AppleID:  aaid.(string),
		GoogleID: googleid.(string),
	}

	err = h.service.CreateUser(user)
	if err != nil {
		return nil, huma.Error400BadRequest("User creation failed", err)
	}

	resp := &RegisterOutput{}
	resp.AccessToken = access
	resp.RefreshToken = refresh
	resp.Body.Message = "User Created Successfully"
	
	return resp, nil
}

// LoginWithAppleHuma handles Apple login
func (h *Handler) LoginWithAppleHuma(ctx context.Context, input *LoginWithAppleInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromApple(input.Body.AppleID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Apple login failed", err)
	}

	access, refresh, err := h.service.GenerateTokens(id.Hex(), *count)
	if err != nil {
		return nil, huma.Error500InternalServerError("Token generation failed", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = access
	resp.RefreshToken = refresh
	resp.Body = types.SafeUser{
		ID:             user.ID,
		DisplayName:    user.DisplayName,
		Handle:         user.Handle,
		ProfilePicture: user.ProfilePicture,
		Categories:     user.Categories,
		Friends:        user.Friends,
		TasksComplete:  user.TasksComplete,
		RecentActivity: user.RecentActivity,
	}
	
	return resp, nil
}

// TestHuma handles the test authentication endpoint (PROTECTED ROUTE)
func (h *Handler) TestHuma(ctx context.Context, input *TestInput) (*TestOutput, error) {
	// Extract user_id from context to verify auth middleware is working
	user_id, err := RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	resp := &TestOutput{}
	resp.Body.Message = fmt.Sprintf("Authorized! User ID: %s", user_id)
	return resp, nil
}

// LogoutHuma handles user logout
func (h *Handler) LogoutHuma(ctx context.Context, input *LogoutInput) (*LogoutOutput, error) {
	if len(input.Authorization) == 0 {
		return nil, huma.Error400BadRequest("Not Authorized, Tokens not passed", nil)
	}

	split := strings.Split(input.Authorization, " ")
	if len(split) != 2 {
		return nil, huma.Error400BadRequest("Not Authorized, Invalid Token Format", nil)
	}
	
	tokenType, accessToken := split[0], split[1]
	if tokenType != "Bearer" {
		return nil, huma.Error400BadRequest("Not Authorized, Invalid Token Type", nil)
	}

	// increase the count by one
	user_id, _, err := h.service.ValidateToken(accessToken)
	if err != nil {
		return nil, huma.Error400BadRequest("Token validation failed", err)
	}
	
	err = h.service.InvalidateTokens(user_id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Token invalidation failed", err)
	}

	resp := &LogoutOutput{}
	resp.Body.Message = "Logout Successful"
	return resp, nil
}

// UpdatePushTokenHuma handles push token updates (PROTECTED ROUTE)
func (h *Handler) UpdatePushTokenHuma(ctx context.Context, input *UpdatePushTokenInput) (*UpdatePushTokenOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	err = h.service.UpdatePushToken(user_id_obj, input.Body.PushToken)
	if err != nil {
		return nil, huma.Error500InternalServerError("Push token update failed", err)
	}

	resp := &UpdatePushTokenOutput{}
	resp.Body.Message = "Push Token Updated Successfully"
	return resp, nil
}

// RequireAuthFromHuma extracts user ID from Huma context by bridging to the underlying Fiber context
func RequireAuthFromHuma(ctx context.Context) (string, error) {
	// Try to get user ID from the standard context first (set by middleware)
	if userID, ok := ctx.Value(UserIDContextKey).(string); ok {
		slog.Info("✅ REQUIRE AUTH HUMA: User authenticated via context", "user_id", userID)
		return userID, nil
	}
	
	// If that doesn't work, check if we can find the Fiber context
	if fiberCtx, ok := ctx.Value("fiber_ctx").(*fiber.Ctx); ok {
		return RequireAuthFiber(fiberCtx)
	}
	
	slog.Error("❌ REQUIRE AUTH HUMA: User not found in context")
	return "", fmt.Errorf("user not authenticated")
} 