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

// Register Operation Types
type RegisterInput struct {
	Body RegisterRequest `json:"body"`
}

type RegisterOutput struct {
	AccessToken  string `header:"access_token"`
	RefreshToken string `header:"refresh_token"`
	Body         struct {
		Message string `json:"message" example:"User Created Successfully"`
	}
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
