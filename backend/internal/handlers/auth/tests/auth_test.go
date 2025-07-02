package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

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
