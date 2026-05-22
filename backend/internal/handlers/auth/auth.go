package auth

import (
	"context"
	"errors"
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
		return nil, huma.Error400BadRequest("Please check your email and password", fmt.Errorf("validation errors: %v", errs))
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Email login attempt",
		slog.String("email", input.Body.Email),
	)

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromCredentials(input.Body.Email, input.Body.Password)
	if err != nil {
		// Propagate the specific error message from the service (e.g., "No account found..." or "Incorrect password...")
		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) {
			if fiberErr.Code == 404 {
				return nil, huma.Error404NotFound(fiberErr.Message, err)
			}
			return nil, huma.Error401Unauthorized(fiberErr.Message, err)
		}
		slog.LogAttrs(ctx, slog.LevelError, "Unexpected error during email login",
			slog.String("email", input.Body.Email),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to sign in due to a server error. Please try again later.", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Token generation failed during email login",
			slog.String("userId", id.Hex()),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to complete login due to a token generation error. Please try again.", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}

// LoginWithPhoneHuma handles user login with phone/password
func (h *Handler) LoginWithPhoneHuma(ctx context.Context, input *LoginWithPhoneInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please check your phone number and password", fmt.Errorf("validation errors: %v", errs))
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Phone login attempt")

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromPhone(input.Body.PhoneNumber, input.Body.Password)
	if err != nil {
		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) {
			if fiberErr.Code == 404 {
				return nil, huma.Error404NotFound(fiberErr.Message, err)
			}
			return nil, huma.Error401Unauthorized(fiberErr.Message, err)
		}
		slog.LogAttrs(ctx, slog.LevelError, "Unexpected error during phone login",
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to sign in due to a server error. Please try again later.", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Token generation failed during phone login",
			slog.String("userId", id.Hex()),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to complete login due to a token generation error. Please try again.", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}

// LoginWithTokenHuma handles login with existing token (PROTECTED ROUTE)
func (h *Handler) LoginWithTokenHuma(ctx context.Context, input *LoginWithTokenInput) (*LoginOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := RequireAuthFromHuma(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	user, err := h.service.GetUser(user_id)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to load user profile during token login",
			slog.String("userId", user_id),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to load your profile. Your account may have been deleted or is temporarily unavailable.", err)
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
	appleID := input.Body.AppleID

	if input.Body.IDToken != "" {
		claims, err := VerifyAppleIDToken(input.Body.IDToken, h.config.OAuth.AppleBundleID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Apple ID token verification failed during registration",
				slog.String("error", err.Error()),
			)
			return nil, huma.Error401Unauthorized("Apple authentication failed. Please try again.", err)
		}
		appleID = claims.Sub
	} else if h.config.OAuth.AppleBundleID != "" {
		return nil, huma.Error400BadRequest("Apple identity token is required for registration", nil)
	}

	// Convert to regular register input and add Apple ID to context
	ctxWithApple := context.WithValue(ctx, appleIDContextKey, appleID)

	registerInput := &RegisterInput{
		Body: RegisterRequest{
			Email:          input.Body.Email,
			Password:       "", // OAuth users don't need a password
			Phone:          "", // Phone is optional for Apple users
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
		return nil, huma.Error400BadRequest("Please provide a valid Google account", fmt.Errorf("validation errors: %v", errs))
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Google login attempt",
		slog.Bool("hasEmail", input.Body.Email != ""),
	)

	googleID := input.Body.GoogleID
	email := input.Body.Email

	// Verify Google ID token if provided
	if input.Body.IDToken != "" {
		claims, err := VerifyGoogleIDToken(input.Body.IDToken, h.config.OAuth.GoogleClientIDs)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Google ID token verification failed",
				slog.String("error", err.Error()),
			)
			return nil, huma.Error401Unauthorized("Google authentication failed. Please try again.", err)
		}
		googleID = claims.Sub
		if claims.Email != "" {
			email = claims.Email
		}
	} else if h.config.OAuth.GoogleClientIDs != "" {
		return nil, huma.Error400BadRequest("Google ID token is required for authentication", nil)
	}

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromGoogle(googleID, email)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Google login failed",
			slog.String("error", err.Error()),
			slog.Bool("hasEmail", input.Body.Email != ""),
		)
		// Check for 404 (account not found) vs other errors
		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) && fiberErr.Code == 404 {
			return nil, huma.Error404NotFound(fiberErr.Message, err)
		}
		return nil, huma.Error401Unauthorized("Unable to sign in with Google. Please try again.", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Token generation failed during Google login",
			slog.String("userId", id.Hex()),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to complete login. Please try again.", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}

// RegisterWithGoogleHuma handles Google registration
func (h *Handler) RegisterWithGoogleHuma(ctx context.Context, input *RegisterWithGoogleInput) (*RegisterOutput, error) {
	googleID := input.Body.GoogleID

	if input.Body.IDToken != "" {
		claims, err := VerifyGoogleIDToken(input.Body.IDToken, h.config.OAuth.GoogleClientIDs)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Google ID token verification failed during registration",
				slog.String("error", err.Error()),
			)
			return nil, huma.Error401Unauthorized("Google authentication failed. Please try again.", err)
		}
		googleID = claims.Sub
	} else if h.config.OAuth.GoogleClientIDs != "" {
		return nil, huma.Error400BadRequest("Google ID token is required for registration", nil)
	}

	// Convert to regular register input and add Google ID to context
	ctxWithGoogle := context.WithValue(ctx, googleIDContextKey, googleID)

	registerInput := &RegisterInput{
		Body: RegisterRequest{
			Email:          input.Body.Email,
			Password:       "", // OAuth users don't need a password
			Phone:          "", // Phone is optional for Google users
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

	// For new users, use timezone from request body if provided, otherwise default to UTC
	timezone := "UTC"
	if input.Body.Timezone != "" {
		timezone = input.Body.Timezone
	}

	access, refresh, err := h.service.GenerateTokens(id.Hex(), 0, timezone) // new users use count = 0
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Token generation failed during registration",
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to complete registration due to a token generation error. Please try again.", err)
	}

	aaid := ctx.Value(appleIDContextKey)
	googleid := ctx.Value(googleIDContextKey)

	appleIDStr := ""
	if aaid != nil {
		if str, ok := aaid.(string); ok {
			appleIDStr = str
		}
	}

	googleIDStr := ""
	if googleid != nil {
		if str, ok := googleid.(string); ok {
			googleIDStr = str
		}
	}

	// Hash the password before storing it
	hashedPassword := ""
	if input.Body.Password != "" {
		hashedBytes, err := bcrypt.GenerateFromPassword([]byte(input.Body.Password), bcrypt.DefaultCost)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Password hashing failed during registration",
				slog.String("error", err.Error()),
			)
			return nil, huma.Error500InternalServerError("Unable to create account. Please try again.", err)
		}
		hashedPassword = string(hashedBytes)
	}

	now := time.Now().UTC()
	user := User{
		Email:           input.Body.Email,
		Phone:           input.Body.Phone,
		Password:        hashedPassword, // Store the hashed password
		ID:              id,
		RefreshToken:    refresh,
		TokenUsed:       false,
		Count:           0,
		TermsAcceptedAt: &now,

		Categories:     make([]types.CategoryDocument, 0),
		Friends:        make([]primitive.ObjectID, 0),
		TasksComplete:  0,
		RecentActivity: make([]types.ActivityDocument, 0),

		DisplayName:    input.Body.DisplayName,
		Handle:         input.Body.Handle,
		ProfilePicture: input.Body.ProfilePicture,
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

		AppleID:  appleIDStr,
		GoogleID: googleIDStr,
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

		// Send welcome congratulation from beak (Kindred founder)
		// Intentionally delayed: runs after workspace setup so the task exists
		if err := h.service.SendWelcomeCongratulation(setupCtx, id); err != nil {
			slog.LogAttrs(setupCtx, slog.LevelError, "Failed to send welcome congratulation",
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
	resp.Body = buildSafeUserResponse(&user)

	return resp, nil
}

// LoginWithAppleHuma handles Apple login
func (h *Handler) LoginWithAppleHuma(ctx context.Context, input *LoginWithAppleInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please provide a valid Apple ID", fmt.Errorf("validation errors: %v", errs))
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Apple login attempt")

	appleID := input.Body.AppleID

	// Verify Apple identity token if provided
	if input.Body.IDToken != "" {
		claims, err := VerifyAppleIDToken(input.Body.IDToken, h.config.OAuth.AppleBundleID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Apple ID token verification failed",
				slog.String("error", err.Error()),
			)
			return nil, huma.Error401Unauthorized("Apple authentication failed. Please try again.", err)
		}
		appleID = claims.Sub
	} else if h.config.OAuth.AppleBundleID != "" {
		return nil, huma.Error400BadRequest("Apple identity token is required for authentication", nil)
	}

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromApple(appleID)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Apple login failed",
			slog.String("error", err.Error()),
		)
		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) && fiberErr.Code == 404 {
			return nil, huma.Error404NotFound(fiberErr.Message, err)
		}
		return nil, huma.Error401Unauthorized("Unable to sign in with Apple. Please try again.", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Token generation failed during Apple login",
			slog.String("userId", id.Hex()),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to complete login. Please try again.", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}

// RefreshTokenHuma handles token refresh (PUBLIC ROUTE — no auth middleware)
func (h *Handler) RefreshTokenHuma(ctx context.Context, input *RefreshTokenInput) (*RefreshTokenOutput, error) {
	if input.RefreshToken == "" {
		return nil, huma.Error400BadRequest("Refresh token is required", nil)
	}

	service := h.service

	// Validate the refresh token and mark it as used atomically
	userID, count, timezone, err := validateRefreshTokenCore(service, input.RefreshToken)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Refresh token validation failed",
			slog.String("error", err.Error()),
		)
		return nil, huma.Error401Unauthorized("Invalid or expired refresh token. Please log in again.", err)
	}

	// Generate new token pair
	newAccess, newRefresh, err := service.GenerateTokens(userID, count, timezone)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to generate tokens during refresh",
			slog.String("userId", userID),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to refresh session. Please try again.", err)
	}

	// Reset token_used so the new refresh token can be used in the future
	id, _ := primitive.ObjectIDFromHex(userID)
	if err := service.users.ResetTokenUsed(ctx, id); err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to reset token_used after refresh",
			slog.String("userId", userID),
			slog.String("error", err.Error()),
		)
		// Non-fatal: tokens were already generated, just log the error
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Token refresh successful",
		slog.String("userId", userID),
	)

	resp := &RefreshTokenOutput{}
	resp.AccessToken = newAccess
	resp.RefreshToken = newRefresh
	resp.Body.Message = "Tokens refreshed successfully"
	return resp, nil
}

// TestHuma handles the test authentication endpoint (PROTECTED ROUTE)
func (h *Handler) TestHuma(ctx context.Context, input *TestInput) (*TestOutput, error) {
	// Extract user_id from context to verify auth middleware is working
	user_id, err := RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	resp := &TestOutput{}
	resp.Body.Message = fmt.Sprintf("Authorized! User ID: %s", user_id)
	return resp, nil
}

// LogoutHuma handles user logout
func (h *Handler) LogoutHuma(ctx context.Context, input *LogoutInput) (*LogoutOutput, error) {
	if len(input.Authorization) == 0 {
		return nil, huma.Error401Unauthorized("Please log in to log out", nil)
	}

	split := strings.Split(input.Authorization, " ")
	if len(split) != 2 {
		return nil, huma.Error400BadRequest("Invalid authorization format. Expected: Bearer <token>", nil)
	}

	tokenType, accessToken := split[0], split[1]
	if tokenType != "Bearer" {
		return nil, huma.Error400BadRequest("Invalid authorization type. Expected Bearer token.", nil)
	}

	// increase the count by one
	user_id, _, _, err := h.service.ValidateToken(accessToken)
	if err != nil {
		return nil, huma.Error401Unauthorized("Invalid or expired session", err)
	}

	err = h.service.InvalidateTokens(user_id)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to invalidate tokens during logout",
			slog.String("userId", user_id),
			slog.String("error", err.Error()),
		)
		return nil, huma.Error500InternalServerError("Unable to log out due to a server error. Please try again later.", err)
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
		slog.Error("Push token validation failed", "errors", errs)
		return nil, huma.Error400BadRequest("Invalid push token. Please check the token format and try again.", fmt.Errorf("validation errors: %v", errs))
	}
	slog.Info("✅ Push token validated successfully")

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		slog.Error("❌ Invalid user ID format", "user_id", user_id, "error", err)
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}
	slog.Info("✅ User ID converted to ObjectID", "user_id_obj", user_id_obj.Hex())

	slog.Info("🔄 Calling UpdatePushToken service...", "user_id", user_id_obj.Hex())
	err = h.service.UpdatePushToken(user_id_obj, input.Body.PushToken)
	if err != nil {
		slog.Error("❌ Push token update service failed", "user_id", user_id_obj.Hex(), "error", err, "error_type", fmt.Sprintf("%T", err))
		return nil, huma.Error500InternalServerError("Unable to update push notifications. Please try again.", err)
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
		return nil, huma.Error400BadRequest("Please provide a valid phone number", fmt.Errorf("validation errors: %v", errs))
	}

	// Call the service method which handles the async Sinch API call
	verificationID, err := h.service.SendOTP(ctx, input.Body.PhoneNumber)
	if err != nil {
		slog.Error("Failed to send OTP", "error", err, "phone", input.Body.PhoneNumber)
		return nil, huma.Error500InternalServerError("Unable to send verification code. The SMS service may be temporarily unavailable.", err)
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
		return nil, huma.Error400BadRequest("Please provide a valid phone number and verification code", fmt.Errorf("validation errors: %v", errs))
	}

	// Call the service method which handles the async Sinch API call
	valid, status, err := h.service.VerifyOTP(ctx, input.Body.PhoneNumber, input.Body.Code)
	if err != nil {
		slog.Error("Failed to verify OTP", "error", err, "phone", input.Body.PhoneNumber)
		return nil, huma.Error500InternalServerError("Unable to verify code. The verification service may be temporarily unavailable.", err)
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

// LoginWithOTPHuma handles login via OTP verification
func (h *Handler) LoginWithOTPHuma(ctx context.Context, input *LoginWithOTPInput) (*LoginWithOTPOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please provide a valid phone number and verification code", fmt.Errorf("validation errors: %v", errs))
	}

	// Step 1: Verify the OTP code
	valid, status, err := h.service.VerifyOTP(ctx, input.Body.PhoneNumber, input.Body.Code)
	if err != nil {
		slog.Error("Failed to verify OTP during login", "error", err, "phone", input.Body.PhoneNumber)
		return nil, huma.Error500InternalServerError("Unable to verify code. The verification service may be temporarily unavailable.", err)
	}

	if !valid {
		slog.Warn("Invalid OTP code during login", "phone", input.Body.PhoneNumber, "status", status)
		return nil, huma.Error401Unauthorized("Invalid or expired verification code. Please request a new one.", nil)
	}

	// Step 2: Look up user by phone number
	id, count, user, err := h.service.LoginFromPhoneOTP(input.Body.PhoneNumber)
	if err != nil {
		slog.Error("Failed to find user by phone", "error", err, "phone", input.Body.PhoneNumber)
		return nil, huma.Error404NotFound("No account found with this phone number. Please sign up first.", err)
	}

	// Step 3: Generate tokens and build response
	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		slog.Error("Token generation failed during OTP login", "error", err, "user_id", id.Hex())
		return nil, huma.Error500InternalServerError("Unable to complete login due to a token generation error. Please try again.", err)
	}

	resp := &LoginWithOTPOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User

	slog.Info("OTP login successful", "user_id", id.Hex(), "phone", input.Body.PhoneNumber)
	return resp, nil
}

// DeleteAccountHuma handles account deletion (PROTECTED ROUTE)
func (h *Handler) DeleteAccountHuma(ctx context.Context, input *DeleteAccountInput) (*DeleteAccountOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
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
		return nil, huma.Error500InternalServerError("Unable to delete account. Please try again or contact support.", err)
	}

	resp := &DeleteAccountOutput{}
	resp.Body.Message = "Account deleted successfully"

	slog.Info("Account deleted", "user_id", user_id)
	return resp, nil
}

// AcceptTermsHuma handles user acceptance of Terms of Service
func (h *Handler) AcceptTermsHuma(ctx context.Context, input *AcceptTermsInput) (*AcceptTermsOutput, error) {
	// Validate input
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please provide a valid terms version to accept", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	// Convert user_id to ObjectID
	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Record terms acceptance
	acceptedAt, err := h.service.AcceptTerms(ctx, user_id_obj, input.Body.TermsVersion)
	if err != nil {
		slog.Error("Failed to accept terms", "error", err, "user_id", user_id)
		return nil, huma.Error500InternalServerError("Unable to accept terms. Please try again.", err)
	}

	resp := &AcceptTermsOutput{}
	resp.Body.Message = "Terms accepted successfully"
	resp.Body.TermsAcceptedAt = acceptedAt.Format(time.RFC3339)
	resp.Body.TermsVersion = input.Body.TermsVersion

	slog.Info("Terms accepted", "user_id", user_id, "version", input.Body.TermsVersion)
	return resp, nil
}
