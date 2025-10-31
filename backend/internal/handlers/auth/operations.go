package auth

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Login Operation Types
type LoginInput struct {
	Body LoginRequest `json:"body"`
}

type LoginOutput struct {
	AccessToken  string   `header:"access_token"`
	RefreshToken string   `header:"refresh_token"`
	Body         SafeUser `json:"body"`
}

// Phone Login Operation Types
type LoginWithPhoneInput struct {
	Body LoginRequestPhone `json:"body"`
}

// Register Operation Types
type RegisterInput struct {
	Body RegisterRequest `json:"body"`
}

type RegisterOutput struct {
	AccessToken  string   `header:"access_token"`
	RefreshToken string   `header:"refresh_token"`
	Body         SafeUser `json:"body"` // Return full user data like login does
}

// Logout Operation Types
type LogoutInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type LogoutOutput struct {
	Body struct {
		Message string `json:"message" example:"Logout Successful"`
	}
}

// Apple Login Operation Types
type LoginWithAppleInput struct {
	Body LoginRequestApple `json:"body"`
}

// Apple Register Operation Types
type RegisterWithAppleInput struct {
	Body RegisterRequestApple `json:"body"`
}

// Google Login Operation Types
type LoginWithGoogleInput struct {
	Body LoginRequestGoogle `json:"body"`
}

// Google Register Operation Types
type RegisterWithGoogleInput struct {
	Body RegisterRequestGoogle `json:"body"`
}

// Test Operation Types
type TestInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type TestOutput struct {
	Body struct {
		Message string `json:"message" example:"Authorized!"`
	}
}

// Login with Token Operation Types
type LoginWithTokenInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

// Update Push Token Operation Types
type UpdatePushTokenInput struct {
	Authorization string                 `header:"Authorization" required:"true"`
	Body          UpdatePushTokenRequest `json:"body"`
}

type UpdatePushTokenOutput struct {
	Body struct {
		Message string `json:"message" example:"Push Token Updated Successfully"`
	}
}

// Send OTP Operation Types
type SendOTPInput struct {
	Body SendOTPRequest `json:"body"`
}

type SendOTPOutput struct {
	Body struct {
		Message        string `json:"message" example:"OTP sent successfully"`
		VerificationID string `json:"verification_id,omitempty"`
	}
}

// Verify OTP Operation Types
type VerifyOTPInput struct {
	Body VerifyOTPRequest `json:"body"`
}

type VerifyOTPOutput struct {
	Body struct {
		Message string `json:"message" example:"OTP verified successfully"`
		Valid   bool   `json:"valid"`
		Status  string `json:"status,omitempty"`
	}
}

// Delete Account Operation Types
type DeleteAccountInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
}

type DeleteAccountOutput struct {
	Body struct {
		Message string `json:"message" example:"Account deleted successfully"`
	}
}

// RegisterLoginOperation registers the login endpoint
func RegisterLoginOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "login",
		Method:      http.MethodPost,
		Path:        "/v1/auth/login",
		Summary:     "User login",
		Description: "Authenticate user with email and password",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
		return handler.LoginHuma(ctx, input)
	})
}

// RegisterLoginWithPhoneOperation registers the phone login endpoint
func RegisterLoginWithPhoneOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "login-phone",
		Method:      http.MethodPost,
		Path:        "/v1/auth/login/phone",
		Summary:     "User login with phone",
		Description: "Authenticate user with phone number and password",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *LoginWithPhoneInput) (*LoginOutput, error) {
		return handler.LoginWithPhoneHuma(ctx, input)
	})
}

// RegisterRegisterOperation registers the register endpoint
func RegisterRegisterOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "register",
		Method:      http.MethodPost,
		Path:        "/v1/auth/register",
		Summary:     "User registration",
		Description: "Register a new user account",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
		return handler.RegisterHuma(ctx, input)
	})
}

// RegisterLogoutOperation registers the logout endpoint
func RegisterLogoutOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "logout",
		Method:      http.MethodPost,
		Path:        "/v1/auth/logout",
		Summary:     "User logout",
		Description: "Logout user and invalidate tokens",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *LogoutInput) (*LogoutOutput, error) {
		return handler.LogoutHuma(ctx, input)
	})
}

// RegisterLoginWithAppleOperation registers the Apple login endpoint
func RegisterLoginWithAppleOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "login-apple",
		Method:      http.MethodPost,
		Path:        "/v1/auth/login/apple",
		Summary:     "Login with Apple",
		Description: "Authenticate user with Apple ID",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *LoginWithAppleInput) (*LoginOutput, error) {
		return handler.LoginWithAppleHuma(ctx, input)
	})
}

// RegisterRegisterWithAppleOperation registers the Apple register endpoint
func RegisterRegisterWithAppleOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "register-apple",
		Method:      http.MethodPost,
		Path:        "/v1/auth/register/apple",
		Summary:     "Register with Apple",
		Description: "Register a new user with Apple ID",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *RegisterWithAppleInput) (*RegisterOutput, error) {
		return handler.RegisterWithAppleHuma(ctx, input)
	})
}

// RegisterLoginWithGoogleOperation registers the Google login endpoint
func RegisterLoginWithGoogleOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "login-google",
		Method:      http.MethodPost,
		Path:        "/v1/auth/login/google",
		Summary:     "Login with Google",
		Description: "Authenticate user with Google ID",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *LoginWithGoogleInput) (*LoginOutput, error) {
		return handler.LoginWithGoogleHuma(ctx, input)
	})
}

// RegisterRegisterWithGoogleOperation registers the Google register endpoint
func RegisterRegisterWithGoogleOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "register-google",
		Method:      http.MethodPost,
		Path:        "/v1/auth/register/google",
		Summary:     "Register with Google",
		Description: "Register a new user with Google ID",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *RegisterWithGoogleInput) (*RegisterOutput, error) {
		return handler.RegisterWithGoogleHuma(ctx, input)
	})
}

// RegisterTestOperation registers the test endpoint
func RegisterTestOperation(api huma.API, handler *Handler) {
	// Register the version with trailing slash
	huma.Register(api, huma.Operation{
		OperationID: "auth-test-slash",
		Method:      http.MethodGet,
		Path:        "/v1/user/",
		Summary:     "Test authentication",
		Description: "Test endpoint for authenticated users",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *TestInput) (*TestOutput, error) {
		return handler.TestHuma(ctx, input)
	})

	// Register the version without trailing slash
	huma.Register(api, huma.Operation{
		OperationID: "auth-test",
		Method:      http.MethodGet,
		Path:        "/v1/user",
		Summary:     "Test authentication",
		Description: "Test endpoint for authenticated users",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *TestInput) (*TestOutput, error) {
		return handler.TestHuma(ctx, input)
	})
}

// RegisterLoginWithTokenOperation registers the login with token endpoint
func RegisterLoginWithTokenOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "login-token",
		Method:      http.MethodPost,
		Path:        "/v1/user/login",
		Summary:     "Login with token",
		Description: "Authenticate user with existing token",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *LoginWithTokenInput) (*LoginOutput, error) {
		return handler.LoginWithTokenHuma(ctx, input)
	})
}

// RegisterUpdatePushTokenOperation registers the update push token endpoint
func RegisterUpdatePushTokenOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-push-token",
		Method:      http.MethodPost,
		Path:        "/v1/user/pushtoken",
		Summary:     "Update push token",
		Description: "Update user's push notification token",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *UpdatePushTokenInput) (*UpdatePushTokenOutput, error) {
		return handler.UpdatePushTokenHuma(ctx, input)
	})
}

// RegisterSendOTPOperation registers the send OTP endpoint
func RegisterSendOTPOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "send-otp",
		Method:      http.MethodPost,
		Path:        "/v1/auth/send-otp",
		Summary:     "Send OTP",
		Description: "Send OTP verification code to phone number via SMS",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *SendOTPInput) (*SendOTPOutput, error) {
		return handler.SendOTPHuma(ctx, input)
	})
}

// RegisterVerifyOTPOperation registers the verify OTP endpoint
func RegisterVerifyOTPOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "verify-otp",
		Method:      http.MethodPost,
		Path:        "/v1/auth/verify-otp",
		Summary:     "Verify OTP",
		Description: "Verify OTP code sent to phone number",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *VerifyOTPInput) (*VerifyOTPOutput, error) {
		return handler.VerifyOTPHuma(ctx, input)
	})
}

// RegisterDeleteAccountOperation registers the delete account endpoint
func RegisterDeleteAccountOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-account",
		Method:      http.MethodDelete,
		Path:        "/v1/user/account",
		Summary:     "Delete user account",
		Description: "Permanently delete user account and all associated data including categories, tasks, friend connections, and notifications",
		Tags:        []string{"auth"},
	}, func(ctx context.Context, input *DeleteAccountInput) (*DeleteAccountOutput, error) {
		return handler.DeleteAccountHuma(ctx, input)
	})
}
