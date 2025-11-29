package auth

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
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
		ID:              user.ID,
		DisplayName:     user.DisplayName,
		Handle:          user.Handle,
		ProfilePicture:  user.ProfilePicture,
		Categories:      user.Categories,
		Friends:         user.Friends,
		TasksComplete:   user.TasksComplete,
		RecentActivity:  user.RecentActivity,
		Encouragements:  user.Encouragements,
		Congratulations: user.Congratulations,
		Streak:          user.Streak,
		StreakEligible:  user.StreakEligible,
		Points:          user.Points,
		PostsMade:       user.PostsMade,
	}

	return resp, nil
}

// LoginWithPhoneHuma handles user login with phone/password
func (h *Handler) LoginWithPhoneHuma(ctx context.Context, input *LoginWithPhoneInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromPhone(input.Body.PhoneNumber, input.Body.Password)
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
		ID:              user.ID,
		DisplayName:     user.DisplayName,
		Handle:          user.Handle,
		ProfilePicture:  user.ProfilePicture,
		Categories:      user.Categories,
		Friends:         user.Friends,
		TasksComplete:   user.TasksComplete,
		RecentActivity:  user.RecentActivity,
		Encouragements:  user.Encouragements,
		Congratulations: user.Congratulations,
		Streak:          user.Streak,
		StreakEligible:  user.StreakEligible,
		Points:          user.Points,
		PostsMade:       user.PostsMade,
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
	resp.Body = *user
	return resp, nil
}

// RegisterHuma handles regular user registration
func (h *Handler) RegisterHuma(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
	return h.RegisterWithContext(ctx, input)
}

// RegisterWithAppleHuma handles Apple registration
func (h *Handler) RegisterWithAppleHuma(ctx context.Context, input *RegisterWithAppleInput) (*RegisterOutput, error) {
	// Convert to regular register input and add Apple ID to context
	ctxWithApple := context.WithValue(ctx, "apple_id", input.Body.AppleID)

	registerInput := &RegisterInput{
		Body: RegisterRequest{
			Email:          input.Body.Email,
			Password:       input.Body.AppleID, // Use Apple ID as password for validation
			Phone:          "",                 // Phone is optional for Apple users
			DisplayName:    input.Body.DisplayName,
			Handle:         input.Body.Handle,
			ProfilePicture: input.Body.ProfilePicture,
		},
	}

	return h.RegisterWithContext(ctxWithApple, registerInput)
}

// LoginWithGoogleHuma handles Google login
func (h *Handler) LoginWithGoogleHuma(ctx context.Context, input *LoginWithGoogleInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromGoogle(input.Body.GoogleID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Google login failed", err)
	}

	access, refresh, err := h.service.GenerateTokens(id.Hex(), *count)
	if err != nil {
		return nil, huma.Error500InternalServerError("Token generation failed", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = access
	resp.RefreshToken = refresh
	resp.Body = types.SafeUser{
		ID:              user.ID,
		DisplayName:     user.DisplayName,
		Handle:          user.Handle,
		ProfilePicture:  user.ProfilePicture,
		Categories:      user.Categories,
		Friends:         user.Friends,
		TasksComplete:   user.TasksComplete,
		RecentActivity:  user.RecentActivity,
		Encouragements:  user.Encouragements,
		Congratulations: user.Congratulations,
		Streak:          user.Streak,
		StreakEligible:  user.StreakEligible,
		Points:          user.Points,
		PostsMade:       user.PostsMade,
	}

	return resp, nil
}

// RegisterWithGoogleHuma handles Google registration
func (h *Handler) RegisterWithGoogleHuma(ctx context.Context, input *RegisterWithGoogleInput) (*RegisterOutput, error) {
	// Convert to regular register input and add Google ID to context
	ctxWithGoogle := context.WithValue(ctx, "google_id", input.Body.GoogleID)

	registerInput := &RegisterInput{
		Body: RegisterRequest{
			Email:          input.Body.Email,
			Password:       input.Body.GoogleID, // Use Google ID as password for validation
			Phone:          "",                  // Phone is optional for Google users
			DisplayName:    input.Body.DisplayName,
			Handle:         input.Body.Handle,
			ProfilePicture: input.Body.ProfilePicture,
		},
	}

	return h.RegisterWithContext(ctxWithGoogle, registerInput)
}

// RegisterWithContext handles registration with context (used for Apple/Google)
func (h *Handler) RegisterWithContext(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
	// Log registration attempt (without sensitive data)
	slog.LogAttrs(ctx, slog.LevelInfo, "Registration attempt",
		slog.String("email", input.Body.Email),
		slog.String("handle", input.Body.Handle),
		slog.String("displayName", input.Body.DisplayName),
		slog.Bool("hasPassword", input.Body.Password != ""),
		slog.Bool("hasProfilePicture", input.Body.ProfilePicture != ""),
	)

	// Validate input
	errs := xvalidator.Validator.Validate(&input.Body)
	if len(errs) > 0 {
		// Build detailed validation error messages
		var errorMessages []string
		for _, e := range errs {
			switch e.Tag {
			case "required":
				errorMessages = append(errorMessages, fmt.Sprintf("%s is required", e.FailedField))
			case "min":
				errorMessages = append(errorMessages, fmt.Sprintf("%s must be at least 8 characters", e.FailedField))
			case "email":
				errorMessages = append(errorMessages, fmt.Sprintf("%s must be a valid email address", e.FailedField))
			default:
				errorMessages = append(errorMessages, fmt.Sprintf("%s validation failed: %s", e.FailedField, e.Tag))
			}
		}

		slog.LogAttrs(ctx, slog.LevelWarn, "Registration validation failed",
			slog.Any("errors", errs),
			slog.String("email", input.Body.Email),
		)

		return nil, huma.Error400BadRequest(
			fmt.Sprintf("Validation failed: %s", strings.Join(errorMessages, "; ")),
			fmt.Errorf("validation errors: %v", errs),
		)
	}

	id := primitive.NewObjectID()

	access, refresh, err := h.service.GenerateTokens(id.Hex(), 0) // new users use count = 0
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Token generation failed during registration",
			slog.String("error", err.Error()),
		)
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

	// Hash the password before storing it
	hashedPassword := ""
	if input.Body.Password != "" {
		hashedBytes, err := bcrypt.GenerateFromPassword([]byte(input.Body.Password), bcrypt.DefaultCost)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Password hashing failed during registration",
				slog.String("error", err.Error()),
			)
			return nil, huma.Error500InternalServerError("Password hashing failed", err)
		}
		hashedPassword = string(hashedBytes)
	}

	user := User{
		Email:        input.Body.Email,
		Phone:        input.Body.Phone,
		Password:     hashedPassword, // Store the hashed password
		ID:           id,
		RefreshToken: refresh,
		TokenUsed:    false,
		Count:        0,

		Categories:     make([]types.CategoryDocument, 0),
		Friends:        make([]primitive.ObjectID, 0),
		TasksComplete:  0,
		RecentActivity: make([]types.ActivityDocument, 0),

		DisplayName:    input.Body.DisplayName,
		Handle:         input.Body.Handle,
		ProfilePicture: input.Body.ProfilePicture,

		Encouragements:  2,
		Congratulations: 2,
		Streak:          0,
		StreakEligible:  true,
		Points:          0,
		PostsMade:       0,
		Credits:         types.GetDefaultCredits(),
		Subscription:    types.GetDefaultSubscription(),

		AppleID:  aaid.(string),
		GoogleID: googleid.(string),
	}

	err = h.service.CreateUser(user)
	if err != nil {
		// Check for duplicate key errors
		if xmongo.IsDuplicateKeyError(err) {
			field, message := xmongo.ExtractDuplicateField(err)
			slog.LogAttrs(ctx, slog.LevelWarn, "Duplicate user registration attempt",
				slog.String("field", field),
				slog.String("email", input.Body.Email),
				slog.String("handle", input.Body.Handle),
				slog.String("error", err.Error()),
			)
			return nil, huma.Error400BadRequest(message, err)
		}

		// Log other database errors
		slog.LogAttrs(ctx, slog.LevelError, "User creation failed",
			slog.String("email", input.Body.Email),
			slog.String("handle", input.Body.Handle),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError(
			fmt.Sprintf("Failed to create user: %s", err.Error()),
			err,
		)
	}

	// Setup default workspace with starter tasks for the new user
	go func() {
		// Use a background context with timeout for workspace setup
		setupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := h.service.SetupDefaultWorkspace(setupCtx, id); err != nil {
			slog.LogAttrs(setupCtx, slog.LevelError, "Failed to setup default workspace for new user",
				slog.String("userId", id.Hex()),
				slog.String("error", err.Error()))
		}
	}()

	// Create referral document for the new user
	go func() {
		// Use a background context with timeout for referral document creation
		referralCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := h.service.CreateReferralDocumentForUser(referralCtx, id); err != nil {
			slog.LogAttrs(referralCtx, slog.LevelError, "Failed to create referral document for new user",
				slog.String("userId", id.Hex()),
				slog.String("error", err.Error()))
		}
	}()

	slog.LogAttrs(ctx, slog.LevelInfo, "User registered successfully",
		slog.String("userId", id.Hex()),
		slog.String("email", input.Body.Email),
		slog.String("handle", input.Body.Handle),
	)

	resp := &RegisterOutput{}
	resp.AccessToken = access
	resp.RefreshToken = refresh
	resp.Body = types.SafeUser{
		ID:              user.ID,
		DisplayName:     user.DisplayName,
		Handle:          user.Handle,
		ProfilePicture:  user.ProfilePicture,
		Categories:      user.Categories,
		Friends:         user.Friends,
		TasksComplete:   user.TasksComplete,
		RecentActivity:  user.RecentActivity,
		Encouragements:  user.Encouragements,
		Congratulations: user.Congratulations,
		Streak:          user.Streak,
		StreakEligible:  user.StreakEligible,
		Points:          user.Points,
		PostsMade:       user.PostsMade,
	}

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
		ID:              user.ID,
		DisplayName:     user.DisplayName,
		Handle:          user.Handle,
		ProfilePicture:  user.ProfilePicture,
		Categories:      user.Categories,
		Friends:         user.Friends,
		TasksComplete:   user.TasksComplete,
		RecentActivity:  user.RecentActivity,
		Encouragements:  user.Encouragements,
		Congratulations: user.Congratulations,
		Streak:          user.Streak,
		StreakEligible:  user.StreakEligible,
		Points:          user.Points,
		PostsMade:       user.PostsMade,
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
	slog.Info("📱 UpdatePushToken called", "timestamp", time.Now().Format(time.RFC3339))

	// Extract user_id from context (set by auth middleware)
	user_id, err := RequireAuth(ctx)
	if err != nil {
		slog.Error("❌ Push token update - Authentication failed", "error", err)
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}
	slog.Info("✅ User authenticated", "user_id", user_id)

	// Log the incoming push token (first 20 chars for security)
	tokenPreview := input.Body.PushToken
	if len(tokenPreview) > 20 {
		tokenPreview = tokenPreview[:20] + "..."
	}
	slog.Info("📥 Received push token", "token_preview", tokenPreview, "token_length", len(input.Body.PushToken))

	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		slog.Error("❌ Push token validation failed", "errors", errs)
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}
	slog.Info("✅ Push token validated successfully")

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		slog.Error("❌ Invalid user ID format", "user_id", user_id, "error", err)
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}
	slog.Info("✅ User ID converted to ObjectID", "user_id_obj", user_id_obj.Hex())

	slog.Info("🔄 Calling UpdatePushToken service...", "user_id", user_id_obj.Hex())
	err = h.service.UpdatePushToken(user_id_obj, input.Body.PushToken)
	if err != nil {
		slog.Error("❌ Push token update service failed", "user_id", user_id_obj.Hex(), "error", err, "error_type", fmt.Sprintf("%T", err))
		return nil, huma.Error500InternalServerError("Push token update failed", err)
	}
	slog.Info("✅ Push token updated successfully in database", "user_id", user_id_obj.Hex())

	resp := &UpdatePushTokenOutput{}
	resp.Body.Message = "Push Token Updated Successfully"

	slog.Info("🎉 UpdatePushToken completed successfully", "user_id", user_id_obj.Hex(), "response_message", resp.Body.Message)
	return resp, nil
}

// RequireAuthFromHuma extracts user ID from Huma context by bridging to the underlying Fiber context
func RequireAuthFromHuma(ctx context.Context) (string, error) {
	// Try to get user ID from the standard context first (set by middleware)
	if userID, ok := ctx.Value(UserIDContextKey).(string); ok {
		return userID, nil
	}

	// If that doesn't work, check if we can find the Fiber context
	if fiberCtx, ok := ctx.Value("fiber_ctx").(*fiber.Ctx); ok {
		return RequireAuthFiber(fiberCtx)
	}

	slog.Error("❌ REQUIRE AUTH HUMA: User not found in context")
	return "", fmt.Errorf("user not authenticated")
}

// SendOTPHuma handles sending OTP via Sinch
func (h *Handler) SendOTPHuma(ctx context.Context, input *SendOTPInput) (*SendOTPOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Call the service method which handles the async Sinch API call
	verificationID, err := h.service.SendOTP(ctx, input.Body.PhoneNumber)
	if err != nil {
		slog.Error("Failed to send OTP", "error", err, "phone", input.Body.PhoneNumber)
		return nil, huma.Error500InternalServerError("Failed to send OTP", err)
	}

	resp := &SendOTPOutput{}
	resp.Body.Message = "OTP sent successfully"
	resp.Body.VerificationID = verificationID

	return resp, nil
}

// VerifyOTPHuma handles verifying OTP code via Sinch
func (h *Handler) VerifyOTPHuma(ctx context.Context, input *VerifyOTPInput) (*VerifyOTPOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Call the service method which handles the async Sinch API call
	valid, status, err := h.service.VerifyOTP(ctx, input.Body.PhoneNumber, input.Body.Code)
	if err != nil {
		slog.Error("Failed to verify OTP", "error", err, "phone", input.Body.PhoneNumber)
		return nil, huma.Error500InternalServerError("Failed to verify OTP", err)
	}

	resp := &VerifyOTPOutput{}
	resp.Body.Valid = valid
	resp.Body.Status = status

	if valid {
		resp.Body.Message = "OTP verified successfully"
	} else {
		resp.Body.Message = "OTP verification failed"
	}

	return resp, nil
}

// DeleteAccountHuma handles account deletion (PROTECTED ROUTE)
func (h *Handler) DeleteAccountHuma(ctx context.Context, input *DeleteAccountInput) (*DeleteAccountOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert user_id to ObjectID
	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Call service method to delete account and all associated data
	err = h.service.DeleteAccount(ctx, user_id_obj)
	if err != nil {
		slog.Error("Failed to delete account", "error", err, "user_id", user_id)
		return nil, huma.Error500InternalServerError("Failed to delete account", err)
	}

	resp := &DeleteAccountOutput{}
	resp.Body.Message = "Account deleted successfully"

	slog.Info("Account deleted", "user_id", user_id)
	return resp, nil
}
