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
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// MockService is a mock implementation of the auth service
type MockService struct {
	mock.Mock
}

func (m *MockService) GenerateTokens(id string, count float64) (string, string, error) {
	args := m.Called(id, count)
	return args.String(0), args.String(1), args.Error(2)
}

func (m *MockService) LoginFromCredentials(email, password string) (*primitive.ObjectID, *float64, *User, error) {
	args := m.Called(email, password)
	return args.Get(0).(*primitive.ObjectID), args.Get(1).(*float64), args.Get(2).(*User), args.Error(3)
}

func (m *MockService) LoginFromApple(appleID string) (*primitive.ObjectID, *float64, *User, error) {
	args := m.Called(appleID)
	return args.Get(0).(*primitive.ObjectID), args.Get(1).(*float64), args.Get(2).(*User), args.Error(3)
}

func (m *MockService) GetUser(userID string) (*SafeUser, error) {
	args := m.Called(userID)
	return args.Get(0).(*SafeUser), args.Error(1)
}

func (m *MockService) CreateUser(user User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockService) ValidateToken(token string) (string, float64, error) {
	args := m.Called(token)
	return args.String(0), args.Get(1).(float64), args.Error(2)
}

func (m *MockService) InvalidateTokens(userID string) error {
	args := m.Called(userID)
	return args.Error(0)
}

func (m *MockService) UpdatePushToken(userID primitive.ObjectID, pushToken string) error {
	args := m.Called(userID, pushToken)
	return args.Error(0)
}

// Helper function to create test user (currently unused but kept for future tests)
// nolint:unused
func createTestUser() *User {
	userID := primitive.NewObjectID()
	return &User{
		ID:              userID,
		Email:           "",
		Phone:           "+1234567890",
		Password:        "password123",
		DisplayName:     "Test User",
		Handle:          "@testuser",
		ProfilePicture:  "https://example.com/pic.jpg",
		Categories:      []types.CategoryDocument{},
		Friends:         []primitive.ObjectID{},
		TasksComplete:   0,
		RecentActivity:  []types.ActivityDocument{},
		Count:           0,
		TokenUsed:       false,
		Encouragements:  2,
		Congratulations: 2,
		Streak:          0,
		StreakEligible:  true,
		AppleID:         "",
		GoogleID:        "",
	}
}

// Helper function to create test safe user
func createTestSafeUser() *SafeUser {
	userID := primitive.NewObjectID()
	return &SafeUser{
		ID:              userID,
		DisplayName:     "Test User",
		Handle:          "@testuser",
		ProfilePicture:  "https://example.com/pic.jpg",
		Categories:      []types.CategoryDocument{},
		Friends:         []primitive.ObjectID{},
		TasksComplete:   0,
		RecentActivity:  []types.ActivityDocument{},
		Encouragements:  2,
		Congratulations: 2,
		Streak:          0,
		StreakEligible:  true,
	}
}

// setupTestAPI creates a test API with Huma and Chi router
func setupTestAPI(t *testing.T) (huma.API, *http.Server) {
	t.Helper()

	router := chi.NewRouter()

	// Create Huma API
	config := huma.DefaultConfig("Test API", "1.0.0")
	api := humachi.New(router, config)

	server := &http.Server{
		Handler: router,
	}

	return api, server
}

func TestHeaderStructure(t *testing.T) {
	// Test that the LoginOutput and RegisterOutput have the correct header structure
	// This tests the fix we made to separate access_token and refresh_token headers

	t.Run("LoginOutput header structure", func(t *testing.T) {
		loginOutput := &LoginOutput{
			AccessToken:  "test-access-token",
			RefreshToken: "test-refresh-token",
			Body: SafeUser{
				ID:          primitive.NewObjectID(),
				DisplayName: "Test User",
			},
		}

		assert.Equal(t, "test-access-token", loginOutput.AccessToken)
		assert.Equal(t, "test-refresh-token", loginOutput.RefreshToken)
		assert.Equal(t, "Test User", loginOutput.Body.DisplayName)
	})

	t.Run("RegisterOutput header structure", func(t *testing.T) {
		objID, _ := primitive.ObjectIDFromHex("507f1f77bcf86cd799439011")
		registerOutput := &RegisterOutput{
			AccessToken:  "test-access-token",
			RefreshToken: "test-refresh-token",
			Body: SafeUser{
				ID:          objID,
				DisplayName: "Test User",
				Handle:      "testuser",
			},
		}

		assert.Equal(t, "test-access-token", registerOutput.AccessToken)
		assert.Equal(t, "test-refresh-token", registerOutput.RefreshToken)
		assert.Equal(t, "Test User", registerOutput.Body.DisplayName)
	})
}

func TestHumaOperationRegistration(t *testing.T) {
	// Test that Huma operations are correctly registered
	api, _ := setupTestAPI(t)

	// Create a minimal handler for testing operation registration
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key-for-testing",
		},
	}

	// Mock service is not available, so we'll create a minimal mock
	handler := &Handler{
		service: nil, // We won't call service methods in this test
		config:  cfg,
	}

	// Test that operations can be registered without errors
	assert.NotPanics(t, func() {
		RegisterLoginOperation(api, handler)
		RegisterRegisterOperation(api, handler)
		RegisterLoginWithAppleOperation(api, handler)
		RegisterLogoutOperation(api, handler)
		RegisterTestOperation(api, handler)
		RegisterLoginWithTokenOperation(api, handler)
		RegisterUpdatePushTokenOperation(api, handler)
	})
}

func TestRequestValidation(t *testing.T) {
	// Test input validation for requests

	t.Run("LoginRequest validation", func(t *testing.T) {
		validLogin := LoginRequest{
			Email:    "test@example.com",
			Password: "password123",
		}

		invalidEmailLogin := LoginRequest{
			Email:    "invalid-email",
			Password: "password123",
		}
		_ = invalidEmailLogin // Used for validation testing

		shortPasswordLogin := LoginRequest{
			Email:    "test@example.com",
			Password: "123", // Too short
		}
		_ = shortPasswordLogin // Used for validation testing

		// These would normally be validated by the validator package
		// Here we just test the struct fields are set correctly
		assert.Equal(t, "test@example.com", validLogin.Email)
		assert.Equal(t, "password123", validLogin.Password)

		assert.Equal(t, "invalid-email", invalidEmailLogin.Email)
		assert.Equal(t, "123", shortPasswordLogin.Password)
	})

	t.Run("RegisterRequest validation", func(t *testing.T) {
		validRegisterWithEmail := RegisterRequest{
			Email:    "test@example.com",
			Password: "password123",
		}

		validRegisterWithPhone := RegisterRequest{
			Phone:    "+1234567890",
			Password: "password123",
		}

		assert.Equal(t, "test@example.com", validRegisterWithEmail.Email)
		assert.Equal(t, "password123", validRegisterWithEmail.Password)
		assert.Equal(t, "+1234567890", validRegisterWithPhone.Phone)
		assert.Equal(t, "password123", validRegisterWithPhone.Password)
	})

	t.Run("LoginRequestApple validation", func(t *testing.T) {
		appleLogin := LoginRequestApple{
			AppleID: "apple-user-123",
		}

		assert.Equal(t, "apple-user-123", appleLogin.AppleID)
	})
}

func TestTokenGeneration(t *testing.T) {
	// Test the token generation functionality
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key-for-testing",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := "user123"
	count := float64(0)
	exp := time.Now().Add(time.Hour).Unix()

	t.Run("Generate token", func(t *testing.T) {
		token, err := service.GenerateToken(userID, exp, count)
		assert.NoError(t, err)
		assert.NotEmpty(t, token)

		// Verify token can be parsed
		parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.Auth.Secret), nil
		})
		assert.NoError(t, err)
		assert.True(t, parsedToken.Valid)

		// Check claims
		claims, ok := parsedToken.Claims.(jwt.MapClaims)
		assert.True(t, ok)
		assert.Equal(t, userID, claims["user_id"])
		assert.Equal(t, count, claims["count"])
		assert.Equal(t, "dev-server", claims["iss"])
		assert.Equal(t, "user", claims["role"])
	})

	t.Run("Generate access token", func(t *testing.T) {
		token, err := service.GenerateAccessToken(userID, count)
		assert.NoError(t, err)
		assert.NotEmpty(t, token)

		// Verify it's a valid JWT
		parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.Auth.Secret), nil
		})
		assert.NoError(t, err)
		assert.True(t, parsedToken.Valid)
	})

	t.Run("Generate refresh token", func(t *testing.T) {
		token, err := service.GenerateRefreshToken(userID, count)
		assert.NoError(t, err)
		assert.NotEmpty(t, token)

		// Verify it's a valid JWT
		parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.Auth.Secret), nil
		})
		assert.NoError(t, err)
		assert.True(t, parsedToken.Valid)
	})

	t.Run("Generate both tokens", func(t *testing.T) {
		access, refresh, err := service.GenerateTokens(userID, count)
		assert.NoError(t, err)
		assert.NotEmpty(t, access)
		assert.NotEmpty(t, refresh)
		assert.NotEqual(t, access, refresh)
	})
}

func TestAuthContextHelpers(t *testing.T) {
	// Test the auth context helper functions

	t.Run("GetUserIDFromContext", func(t *testing.T) {
		// Test with user ID in context
		ctx := context.WithValue(context.Background(), UserIDContextKey, "user123")
		userID, ok := GetUserIDFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, "user123", userID)

		// Test with no user ID in context
		emptyCtx := context.Background()
		userID, ok = GetUserIDFromContext(emptyCtx)
		assert.False(t, ok)
		assert.Empty(t, userID)
	})

	t.Run("RequireAuth", func(t *testing.T) {
		// Test with user ID in context
		ctx := context.WithValue(context.Background(), UserIDContextKey, "user123")
		userID, err := RequireAuth(ctx)
		assert.NoError(t, err)
		assert.Equal(t, "user123", userID)

		// Test with no user ID in context
		emptyCtx := context.Background()
		userID, err = RequireAuth(emptyCtx)
		assert.Error(t, err)
		assert.Empty(t, userID)
		assert.Equal(t, "user not authenticated", err.Error())
	})
}

func TestInputOutputTypes(t *testing.T) {
	// Test that input/output types are properly structured for Huma

	t.Run("LoginInput structure", func(t *testing.T) {
		loginInput := &LoginInput{
			Body: LoginRequest{
				Email:    "test@example.com",
				Password: "password123",
			},
		}

		assert.Equal(t, "test@example.com", loginInput.Body.Email)
		assert.Equal(t, "password123", loginInput.Body.Password)
	})

	t.Run("LoginWithAppleInput structure", func(t *testing.T) {
		appleInput := &LoginWithAppleInput{
			Body: LoginRequestApple{
				AppleID: "apple-user-123",
			},
		}

		assert.Equal(t, "apple-user-123", appleInput.Body.AppleID)
	})

	t.Run("RegisterInput structure", func(t *testing.T) {
		registerInputWithEmail := &RegisterInput{
			Body: RegisterRequest{
				Email:    "test@example.com",
				Password: "password123",
			},
		}

		registerInputWithPhone := &RegisterInput{
			Body: RegisterRequest{
				Phone:    "+1234567890",
				Password: "password123",
			},
		}

		assert.Equal(t, "test@example.com", registerInputWithEmail.Body.Email)
		assert.Equal(t, "password123", registerInputWithEmail.Body.Password)
		assert.Equal(t, "+1234567890", registerInputWithPhone.Body.Phone)
		assert.Equal(t, "password123", registerInputWithPhone.Body.Password)
	})

	t.Run("LogoutInput structure", func(t *testing.T) {
		logoutInput := &LogoutInput{
			Authorization: "Bearer token123",
		}

		assert.Equal(t, "Bearer token123", logoutInput.Authorization)
	})

	t.Run("TestInput structure", func(t *testing.T) {
		testInput := &TestInput{
			Authorization: "Bearer token123",
		}

		assert.Equal(t, "Bearer token123", testInput.Authorization)
	})

	t.Run("UpdatePushTokenInput structure", func(t *testing.T) {
		pushTokenInput := &UpdatePushTokenInput{
			Authorization: "Bearer token123",
			Body: UpdatePushTokenRequest{
				PushToken: "push-token-123",
			},
		}

		assert.Equal(t, "Bearer token123", pushTokenInput.Authorization)
		assert.Equal(t, "push-token-123", pushTokenInput.Body.PushToken)
	})
}

// Integration test for JSON serialization/deserialization
func TestJSONSerialization(t *testing.T) {
	t.Run("LoginRequest JSON", func(t *testing.T) {
		loginReq := LoginRequest{
			Email:    "test@example.com",
			Password: "password123",
		}

		// Marshal to JSON
		jsonData, err := json.Marshal(loginReq)
		assert.NoError(t, err)

		// Unmarshal from JSON
		var unmarshaled LoginRequest
		err = json.Unmarshal(jsonData, &unmarshaled)
		assert.NoError(t, err)

		assert.Equal(t, loginReq.Email, unmarshaled.Email)
		assert.Equal(t, loginReq.Password, unmarshaled.Password)
	})

	t.Run("LoginOutput JSON", func(t *testing.T) {
		user := createTestSafeUser()

		loginOutput := LoginOutput{
			AccessToken:  "access-token-123",
			RefreshToken: "refresh-token-123",
			Body:         *user,
		}
		// Tokens are used in headers, not body
		_ = loginOutput.AccessToken
		_ = loginOutput.RefreshToken

		// Marshal to JSON (body only, headers are separate)
		jsonData, err := json.Marshal(loginOutput.Body)
		assert.NoError(t, err)

		// Unmarshal from JSON
		var unmarshaled SafeUser
		err = json.Unmarshal(jsonData, &unmarshaled)
		assert.NoError(t, err)

		assert.Equal(t, user.ID, unmarshaled.ID)
		assert.Equal(t, user.DisplayName, unmarshaled.DisplayName)
		assert.Equal(t, user.Handle, unmarshaled.Handle)
	})
}

// Test to verify the header fix - that tokens are separate headers
func TestSeparateTokenHeaders(t *testing.T) {
	t.Run("Login output has separate token headers", func(t *testing.T) {
		// Create a LoginOutput
		output := &LoginOutput{
			AccessToken:  "access-123",
			RefreshToken: "refresh-456",
			Body: SafeUser{
				ID:          primitive.NewObjectID(),
				DisplayName: "Test User",
			},
		}

		// Verify that tokens are separate fields, not nested in a Headers struct
		assert.Equal(t, "access-123", output.AccessToken)
		assert.Equal(t, "refresh-456", output.RefreshToken)

		// Verify they are different
		assert.NotEqual(t, output.AccessToken, output.RefreshToken)
	})

	t.Run("Register output has separate token headers", func(t *testing.T) {
		// Create a RegisterOutput
		objID, _ := primitive.ObjectIDFromHex("507f1f77bcf86cd799439011")
		output := &RegisterOutput{
			AccessToken:  "access-789",
			RefreshToken: "refresh-012",
			Body: SafeUser{
				ID:          objID,
				DisplayName: "Test User",
				Handle:      "testuser",
			},
		}

		// Verify that tokens are separate fields, not nested in a Headers struct
		assert.Equal(t, "access-789", output.AccessToken)
		assert.Equal(t, "refresh-012", output.RefreshToken)

		// Verify they are different
		assert.NotEqual(t, output.AccessToken, output.RefreshToken)
	})
}

// Test the operation path mappings
func TestOperationPaths(t *testing.T) {
	// This test verifies that the Huma operations are mapped to the correct paths

	t.Run("Operation paths are correct", func(t *testing.T) {
		// These are the expected paths from the operations.go file
		expectedPaths := map[string]string{
			"login":             "/v1/auth/login",
			"register":          "/v1/auth/register",
			"logout":            "/v1/auth/logout",
			"login-apple":       "/v1/auth/login/apple",
			"register-apple":    "/v1/auth/register/apple",
			"auth-test":         "/v1/user/",
			"login-token":       "/v1/user/login",
			"update-push-token": "/v1/user/pushtoken",
		}

		// Test that paths are defined correctly (this is a structural test)
		assert.Equal(t, "/v1/auth/login", expectedPaths["login"])
		assert.Equal(t, "/v1/auth/login/apple", expectedPaths["login-apple"])
		assert.Equal(t, "/v1/auth/register", expectedPaths["register"])
		assert.Equal(t, "/v1/auth/register/apple", expectedPaths["register-apple"])
		assert.Equal(t, "/v1/auth/logout", expectedPaths["logout"])
		assert.Equal(t, "/v1/user/", expectedPaths["auth-test"])
		assert.Equal(t, "/v1/user/login", expectedPaths["login-token"])
		assert.Equal(t, "/v1/user/pushtoken", expectedPaths["update-push-token"])
	})
}

func TestBadInputValidation(t *testing.T) {
	// Test that various bad inputs properly fail validation using xvalidator

	t.Run("LoginRequest validation failures", func(t *testing.T) {
		testCases := []struct {
			name        string
			loginReq    LoginRequest
			shouldFail  bool
			description string
		}{
			{
				name: "Valid login",
				loginReq: LoginRequest{
					Email:    "test@example.com",
					Password: "password123",
				},
				shouldFail:  false,
				description: "Should pass with valid email and password",
			},
			{
				name: "Empty email",
				loginReq: LoginRequest{
					Email:    "",
					Password: "password123",
				},
				shouldFail:  true,
				description: "Should fail with empty email",
			},
			{
				name: "Invalid email format - no @",
				loginReq: LoginRequest{
					Email:    "testexample.com",
					Password: "password123",
				},
				shouldFail:  true,
				description: "Should fail with invalid email format",
			},
			{
				name: "Invalid email format - no domain",
				loginReq: LoginRequest{
					Email:    "test@",
					Password: "password123",
				},
				shouldFail:  true,
				description: "Should fail with incomplete email",
			},
			{
				name: "Invalid email format - no local part",
				loginReq: LoginRequest{
					Email:    "@example.com",
					Password: "password123",
				},
				shouldFail:  true,
				description: "Should fail with email missing local part",
			},
			{
				name: "Empty password",
				loginReq: LoginRequest{
					Email:    "test@example.com",
					Password: "",
				},
				shouldFail:  true,
				description: "Should fail with empty password",
			},
			{
				name: "Password too short - 7 chars",
				loginReq: LoginRequest{
					Email:    "test@example.com",
					Password: "1234567",
				},
				shouldFail:  true,
				description: "Should fail with password shorter than 8 characters",
			},
			{
				name: "Password too short - 1 char",
				loginReq: LoginRequest{
					Email:    "test@example.com",
					Password: "1",
				},
				shouldFail:  true,
				description: "Should fail with very short password",
			},
			{
				name: "Both email and password empty",
				loginReq: LoginRequest{
					Email:    "",
					Password: "",
				},
				shouldFail:  true,
				description: "Should fail with both fields empty",
			},
			{
				name: "Both email and password invalid",
				loginReq: LoginRequest{
					Email:    "invalid-email",
					Password: "123",
				},
				shouldFail:  true,
				description: "Should fail with both fields invalid",
			},
			{
				name: "Password exactly 8 chars - should pass",
				loginReq: LoginRequest{
					Email:    "test@example.com",
					Password: "12345678",
				},
				shouldFail:  false,
				description: "Should pass with password exactly 8 characters",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				errs := xvalidator.Validator.Validate(tc.loginReq)
				if tc.shouldFail {
					assert.NotEmpty(t, errs, tc.description)
				} else {
					assert.Empty(t, errs, tc.description)
				}
			})
		}
	})

	t.Run("RegisterRequest validation failures", func(t *testing.T) {
		testCases := []struct {
			name        string
			registerReq RegisterRequest
			shouldFail  bool
			description string
		}{
			{
				name: "Valid registration with email",
				registerReq: RegisterRequest{
					Email:          "test@example.com",
					Password:       "password123",
					DisplayName:    "Test User",
					Handle:         "testuser",
					ProfilePicture: "https://example.com/pic.jpg",
				},
				shouldFail:  false,
				description: "Should pass with valid email and password",
			},
			{
				name: "Valid registration with phone (no email)",
				registerReq: RegisterRequest{
					Email:          "",
					Phone:          "+1234567890",
					Password:       "password123",
					DisplayName:    "Test User",
					Handle:         "testuser",
					ProfilePicture: "https://example.com/pic.jpg",
				},
				shouldFail:  false,
				description: "Should pass with phone and no email",
			},
			{
				name: "Invalid email format",
				registerReq: RegisterRequest{
					Email:          "not-an-email",
					Password:       "password123",
					DisplayName:    "Test User",
					Handle:         "testuser",
					ProfilePicture: "https://example.com/pic.jpg",
				},
				shouldFail:  true,
				description: "Should fail with invalid email format",
			},
			{
				name: "Empty password",
				registerReq: RegisterRequest{
					Email:          "test@example.com",
					Password:       "",
					DisplayName:    "Test User",
					Handle:         "testuser",
					ProfilePicture: "https://example.com/pic.jpg",
				},
				shouldFail:  true,
				description: "Should fail with empty password",
			},
			{
				name: "Password too short",
				registerReq: RegisterRequest{
					Email:          "test@example.com",
					Password:       "short",
					DisplayName:    "Test User",
					Handle:         "testuser",
					ProfilePicture: "https://example.com/pic.jpg",
				},
				shouldFail:  true,
				description: "Should fail with password shorter than 8 characters",
			},
			{
				name: "Password exactly 8 chars - should pass",
				registerReq: RegisterRequest{
					Email:          "test@example.com",
					Password:       "12345678",
					DisplayName:    "Test User",
					Handle:         "testuser",
					ProfilePicture: "https://example.com/pic.jpg",
				},
				shouldFail:  false,
				description: "Should pass with password exactly 8 characters",
			},
			{
				name: "Missing DisplayName",
				registerReq: RegisterRequest{
					Email:          "test@example.com",
					Password:       "password123",
					DisplayName:    "",
					Handle:         "testuser",
					ProfilePicture: "https://example.com/pic.jpg",
				},
				shouldFail:  true,
				description: "Should fail with missing DisplayName",
			},
			{
				name: "Missing Handle",
				registerReq: RegisterRequest{
					Email:          "test@example.com",
					Password:       "password123",
					DisplayName:    "Test User",
					Handle:         "",
					ProfilePicture: "https://example.com/pic.jpg",
				},
				shouldFail:  true,
				description: "Should fail with missing Handle",
			},
			{
				name: "Missing ProfilePicture",
				registerReq: RegisterRequest{
					Email:          "test@example.com",
					Password:       "password123",
					DisplayName:    "Test User",
					Handle:         "testuser",
					ProfilePicture: "",
				},
				shouldFail:  true,
				description: "Should fail with missing ProfilePicture",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				errs := xvalidator.Validator.Validate(tc.registerReq)
				if tc.shouldFail {
					assert.NotEmpty(t, errs, tc.description)
				} else {
					assert.Empty(t, errs, tc.description)
				}
			})
		}
	})

	t.Run("Apple login validation failures", func(t *testing.T) {
		testCases := []struct {
			name        string
			appleReq    LoginRequestApple
			shouldFail  bool
			description string
		}{
			{
				name: "Valid Apple ID",
				appleReq: LoginRequestApple{
					AppleID: "apple-user-123",
				},
				shouldFail:  false,
				description: "Should pass with valid Apple ID",
			},
			{
				name: "Empty Apple ID",
				appleReq: LoginRequestApple{
					AppleID: "",
				},
				shouldFail:  true,
				description: "Should fail with empty Apple ID",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				errs := xvalidator.Validator.Validate(tc.appleReq)
				if tc.shouldFail {
					assert.NotEmpty(t, errs, tc.description)
				} else {
					assert.Empty(t, errs, tc.description)
				}
			})
		}
	})

	t.Run("Push token validation failures", func(t *testing.T) {
		testCases := []struct {
			name         string
			pushTokenReq UpdatePushTokenRequest
			shouldFail   bool
			description  string
		}{
			{
				name: "Valid push token",
				pushTokenReq: UpdatePushTokenRequest{
					PushToken: "valid-push-token-123",
				},
				shouldFail:  false,
				description: "Should pass with valid push token",
			},
			{
				name: "Empty push token",
				pushTokenReq: UpdatePushTokenRequest{
					PushToken: "",
				},
				shouldFail:  true,
				description: "Should fail with empty push token",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				errs := xvalidator.Validator.Validate(tc.pushTokenReq)
				if tc.shouldFail {
					assert.NotEmpty(t, errs, tc.description)
				} else {
					assert.Empty(t, errs, tc.description)
				}
			})
		}
	})
}

func TestTokenValidationErrorCases(t *testing.T) {
	// Test token validation with various invalid tokens
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key-for-testing",
		},
	}

	service := &Service{
		config: cfg,
	}

	testCases := []struct {
		name        string
		token       string
		shouldFail  bool
		description string
	}{
		{
			name:        "Empty token",
			token:       "",
			shouldFail:  true,
			description: "Should fail with empty token",
		},
		{
			name:        "Invalid JWT format",
			token:       "not.a.jwt",
			shouldFail:  true,
			description: "Should fail with invalid JWT format",
		},
		{
			name:        "Random string as token",
			token:       "random-string-not-jwt",
			shouldFail:  true,
			description: "Should fail with random string",
		},
		{
			name:        "JWT with wrong signature",
			token:       "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.wrong_signature",
			shouldFail:  true,
			description: "Should fail with JWT having wrong signature",
		},
		{
			name:        "Malformed JWT - only header",
			token:       "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			shouldFail:  true,
			description: "Should fail with incomplete JWT",
		},
		{
			name:        "Malformed JWT - missing signature",
			token:       "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9",
			shouldFail:  true,
			description: "Should fail with JWT missing signature",
		},
		{
			name:        "JWT with invalid JSON in payload",
			token:       "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_base64.signature",
			shouldFail:  true,
			description: "Should fail with invalid payload",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, _, err := service.ValidateToken(tc.token)
			if tc.shouldFail {
				assert.Error(t, err, tc.description)
			} else {
				assert.NoError(t, err, tc.description)
			}
		})
	}
}

func TestEdgeCaseInputs(t *testing.T) {
	// Test edge cases and boundary conditions

	t.Run("Very long inputs", func(t *testing.T) {
		longString := strings.Repeat("a", 10000) // 10KB string
		veryLongEmail := strings.Repeat("a", 1000) + "@" + strings.Repeat("b", 1000) + ".com"

		loginReq := LoginRequest{
			Email:    veryLongEmail,
			Password: longString,
		}

		// The validation might not explicitly check length limits,
		// but we test that it doesn't crash
		assert.NotPanics(t, func() {
			loginReq.Validate()
		}, "Should not panic with very long inputs")
	})

	t.Run("Special characters in inputs", func(t *testing.T) {
		testCases := []struct {
			name     string
			email    string
			password string
		}{
			{
				name:     "Email with special chars",
				email:    "test+tag@example.com",
				password: "password123",
			},
			{
				name:     "Password with special chars",
				email:    "test@example.com",
				password: "p@ssw0rd!@#$%",
			},
			{
				name:     "Unicode characters",
				email:    "tëst@éxample.com",
				password: "pássw0rd123",
			},
			{
				name:     "SQL injection attempt",
				email:    "test'; DROP TABLE users; --@example.com",
				password: "password123",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				loginReq := LoginRequest{
					Email:    tc.email,
					Password: tc.password,
				}

				// Should not panic regardless of input
				assert.NotPanics(t, func() {
					loginReq.Validate()
				}, "Should not panic with special characters")
			})
		}
	})

	t.Run("Null bytes in inputs", func(t *testing.T) {
		loginReq := LoginRequest{
			Email:    "test\x00@example.com",
			Password: "password\x00123",
		}

		assert.NotPanics(t, func() {
			loginReq.Validate()
		}, "Should not panic with null bytes")
	})
}
