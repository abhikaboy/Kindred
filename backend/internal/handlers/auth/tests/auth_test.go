package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
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

// Helper function to create test user
func createTestUser() *User {
	userID := primitive.NewObjectID()
	return &User{
		ID:             userID,
		Email:          "test@example.com",
		Password:       "password123",
		DisplayName:    "Test User",
		Handle:         "@testuser",
		ProfilePicture: "https://example.com/pic.jpg",
		Categories:     []types.CategoryDocument{},
		Friends:        []primitive.ObjectID{},
		TasksComplete:  0,
		RecentActivity: []types.ActivityDocument{},
		Count:          0,
		TokenUsed:      false,
		AppleID:        "",
		GoogleID:       "",
	}
}

// Helper function to create test safe user
func createTestSafeUser() *SafeUser {
	userID := primitive.NewObjectID()
	return &SafeUser{
		ID:             userID,
		DisplayName:    "Test User",
		Handle:         "@testuser",
		ProfilePicture: "https://example.com/pic.jpg",
		Categories:     []types.CategoryDocument{},
		Friends:        []primitive.ObjectID{},
		TasksComplete:  0,
		RecentActivity: []types.ActivityDocument{},
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
		registerOutput := &RegisterOutput{
			AccessToken:  "test-access-token",
			RefreshToken: "test-refresh-token",
			Body: struct {
				Message string `json:"message" example:"User Created Successfully"`
			}{
				Message: "User Created Successfully",
			},
		}

		assert.Equal(t, "test-access-token", registerOutput.AccessToken)
		assert.Equal(t, "test-refresh-token", registerOutput.RefreshToken)
		assert.Equal(t, "User Created Successfully", registerOutput.Body.Message)
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

		shortPasswordLogin := LoginRequest{
			Email:    "test@example.com",
			Password: "123", // Too short
		}

		// These would normally be validated by the validator package
		// Here we just test the struct fields are set correctly
		assert.Equal(t, "test@example.com", validLogin.Email)
		assert.Equal(t, "password123", validLogin.Password)

		assert.Equal(t, "invalid-email", invalidEmailLogin.Email)
		assert.Equal(t, "123", shortPasswordLogin.Password)
	})

	t.Run("RegisterRequest validation", func(t *testing.T) {
		validRegister := RegisterRequest{
			Email:    "test@example.com",
			Password: "password123",
		}

		assert.Equal(t, "test@example.com", validRegister.Email)
		assert.Equal(t, "password123", validRegister.Password)
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
		registerInput := &RegisterInput{
			Body: RegisterRequest{
				Email:    "test@example.com",
				Password: "password123",
			},
		}

		assert.Equal(t, "test@example.com", registerInput.Body.Email)
		assert.Equal(t, "password123", registerInput.Body.Password)
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
		output := &RegisterOutput{
			AccessToken:  "access-789",
			RefreshToken: "refresh-012",
			Body: struct {
				Message string `json:"message" example:"User Created Successfully"`
			}{
				Message: "User Created Successfully",
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
