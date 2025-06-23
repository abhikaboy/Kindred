package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/server"
	"github.com/abhikaboy/Kindred/internal/testutils"
	"github.com/danielgtaylor/huma/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// TestCategoryE2E_FullFlow tests all category endpoints in a realistic flow
func TestCategoryE2E_FullFlow(t *testing.T) {
	ctx := context.Background()

	// Skip if running in CI without database access
	if testutils.IsCI() {
		t.Skip("Skipping database tests in CI environment")
	}

	// Setup test database
	testConfig, err := testutils.TestDBFromEnv()
	require.NoError(t, err, "Should load test database config")

	testDB, err := testutils.NewTestDB(ctx, testConfig)
	require.NoError(t, err, "Should connect to test database")
	defer testDB.TearDown(ctx)

	// Ensure all required collections exist and are in the collections map
	requiredCollections := []string{
		"users", "categories", "activity", "friend-requests", 
		"completed-tasks", "template-tasks", "posts", "waitlist", 
		"blueprints", "passwordResets", "health", "sample",
	}
	
	if testDB.DB.Collections == nil {
		testDB.DB.Collections = make(map[string]*mongo.Collection)
	}
	
	for _, collectionName := range requiredCollections {
		// Create the collection in the database if it doesn't exist
		err := testDB.DB.DB.CreateCollection(ctx, collectionName)
		if err != nil {
			// Ignore errors if collection already exists
			t.Logf("Note: Collection %s might already exist: %v", collectionName, err)
		}
		
		// Add to collections map
		testDB.DB.Collections[collectionName] = testDB.DB.DB.Collection(collectionName)
	}

	// Setup test server with real handlers
	api, httpServer := setupTestServer(t, testDB.DB.Collections)

	// Setup test user and get auth token
	testUser, authToken := setupTestUserAndAuth(t, api, httpServer, testDB)

	t.Run("Full Category CRUD Flow", func(t *testing.T) {
		var createdCategoryID string

		// Step 1: Create a category
		t.Run("Create Category", func(t *testing.T) {
			categoryData := map[string]interface{}{
				"name":        "Test Work Category",
				"description": "A category for work-related tasks",
				"color":       "#FF5733",
				"workspace":   "Work",
			}

			createdCategory := makeAuthenticatedRequest(t, httpServer, "POST", "/v1/user/categories", authToken, categoryData)
			
			categoryMap := createdCategory.(map[string]interface{})
			assert.NotEmpty(t, categoryMap["_id"], "Should return category ID")
			assert.Equal(t, "Test Work Category", categoryMap["name"])
			assert.Equal(t, "A category for work-related tasks", categoryMap["description"])
			assert.Equal(t, "#FF5733", categoryMap["color"])
			assert.Equal(t, "Work", categoryMap["workspace"])
			assert.Equal(t, testUser.ID.Hex(), categoryMap["user_id"])

			createdCategoryID = categoryMap["_id"].(string)
		})

		// Step 2: Get category by ID
		t.Run("Get Category by ID", func(t *testing.T) {
			category := makeAuthenticatedRequest(t, httpServer, "GET", fmt.Sprintf("/v1/categories/%s", createdCategoryID), authToken, nil)
			
			categoryMap := category.(map[string]interface{})
			assert.Equal(t, createdCategoryID, categoryMap["_id"])
			assert.Equal(t, "Test Work Category", categoryMap["name"])
			assert.Equal(t, "Work", categoryMap["workspace"])
		})

		// Step 3: Get all categories
		t.Run("Get All Categories", func(t *testing.T) {
			response := makeAuthenticatedRequest(t, httpServer, "GET", "/v1/categories", authToken, nil)
			
			categories, ok := response.([]interface{})
			require.True(t, ok, "Response should be an array")
			assert.GreaterOrEqual(t, len(categories), 1, "Should have at least one category")
			
			// Find our created category
			found := false
			for _, cat := range categories {
				catMap := cat.(map[string]interface{})
				if catMap["_id"] == createdCategoryID {
					found = true
					break
				}
			}
			assert.True(t, found, "Should find our created category")
		})

		// Step 4: Get categories by user
		t.Run("Get Categories by User", func(t *testing.T) {
			response := makeAuthenticatedRequest(t, httpServer, "GET", fmt.Sprintf("/v1/user/categories/%s", testUser.ID.Hex()), authToken, nil)
			
			workspaces, ok := response.([]interface{})
			require.True(t, ok, "Response should be an array of workspaces")
			assert.GreaterOrEqual(t, len(workspaces), 1, "Should have at least one workspace")
			
			// Find the "Work" workspace
			found := false
			for _, ws := range workspaces {
				wsMap := ws.(map[string]interface{})
				if wsMap["workspace"] == "Work" {
					found = true
					categories := wsMap["categories"].([]interface{})
					assert.GreaterOrEqual(t, len(categories), 1, "Work workspace should have categories")
					break
				}
			}
			assert.True(t, found, "Should find the Work workspace")
		})

		// Step 5: Get user workspaces
		t.Run("Get User Workspaces", func(t *testing.T) {
			response := makeAuthenticatedRequest(t, httpServer, "GET", "/v1/user/workspaces", authToken, nil)
			
			workspaces, ok := response.([]interface{})
			require.True(t, ok, "Response should be an array")
			assert.GreaterOrEqual(t, len(workspaces), 1, "Should have at least one workspace")
			
			// Find the "Work" workspace
			found := false
			for _, ws := range workspaces {
				wsMap := ws.(map[string]interface{})
				if wsMap["workspace"] == "Work" {
					found = true
					break
				}
			}
			assert.True(t, found, "Should find the Work workspace")
		})

		// Step 6: Update category
		t.Run("Update Category", func(t *testing.T) {
			updateData := map[string]interface{}{
				"name":        "Updated Work Category",
				"description": "An updated category for work-related tasks",
				"color":       "#33FF57",
			}

			updatedCategory := makeAuthenticatedRequest(t, httpServer, "PATCH", fmt.Sprintf("/v1/user/categories/%s", createdCategoryID), authToken, updateData)
			
			updatedCategoryMap := updatedCategory.(map[string]interface{})
			assert.Equal(t, createdCategoryID, updatedCategoryMap["_id"])
			assert.Equal(t, "Updated Work Category", updatedCategoryMap["name"])
			assert.Equal(t, "An updated category for work-related tasks", updatedCategoryMap["description"])
			assert.Equal(t, "#33FF57", updatedCategoryMap["color"])
			assert.Equal(t, "Work", updatedCategoryMap["workspace"]) // Workspace should remain the same
		})

		// Step 7: Create another category in a different workspace
		var personalCategoryID string
		t.Run("Create Category in Personal Workspace", func(t *testing.T) {
			categoryData := map[string]interface{}{
				"name":        "Personal Tasks",
				"description": "Personal task category",
				"color":       "#5733FF",
				"workspace":   "Personal",
			}

			createdCategory := makeAuthenticatedRequest(t, httpServer, "POST", "/v1/user/categories", authToken, categoryData)
			
			personalCategoryMap := createdCategory.(map[string]interface{})
			assert.NotEmpty(t, personalCategoryMap["_id"])
			assert.Equal(t, "Personal Tasks", personalCategoryMap["name"])
			assert.Equal(t, "Personal", personalCategoryMap["workspace"])

			personalCategoryID = personalCategoryMap["_id"].(string)
		})

		// Step 8: Verify we now have 2 workspaces
		t.Run("Verify Multiple Workspaces", func(t *testing.T) {
			response := makeAuthenticatedRequest(t, httpServer, "GET", "/v1/user/workspaces", authToken, nil)
			
			workspaces, ok := response.([]interface{})
			require.True(t, ok, "Response should be an array")
			assert.GreaterOrEqual(t, len(workspaces), 2, "Should have at least two workspaces")
			
			workspaceNames := make([]string, 0)
			for _, ws := range workspaces {
				wsMap := ws.(map[string]interface{})
				workspaceNames = append(workspaceNames, wsMap["workspace"].(string))
			}
			assert.Contains(t, workspaceNames, "Work")
			assert.Contains(t, workspaceNames, "Personal")
		})

		// Step 9: Delete a single category
		t.Run("Delete Category", func(t *testing.T) {
			response := makeAuthenticatedRequest(t, httpServer, "DELETE", fmt.Sprintf("/v1/user/categories/%s", personalCategoryID), authToken, nil)
			
			responseMap := response.(map[string]interface{})
			assert.Contains(t, responseMap["message"], "deleted successfully")
		})

		// Step 10: Verify category was deleted
		t.Run("Verify Category Deleted", func(t *testing.T) {
			// Try to get the deleted category - should return 404 or empty result
			req := createAuthenticatedRequest(t, "GET", fmt.Sprintf("/v1/categories/%s", personalCategoryID), authToken, nil)
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)
			
			// Should return 404 or similar error status
			assert.NotEqual(t, http.StatusOK, rr.Code, "Should not find deleted category")
		})

		// Step 11: Delete entire workspace
		t.Run("Delete Workspace", func(t *testing.T) {
			response := makeAuthenticatedRequest(t, httpServer, "DELETE", "/v1/user/categories/workspace/Work", authToken, nil)
			
			responseMap := response.(map[string]interface{})
			assert.Contains(t, responseMap["message"], "deleted successfully")
		})

		// Step 12: Verify workspace was deleted
		t.Run("Verify Workspace Deleted", func(t *testing.T) {
			response := makeAuthenticatedRequest(t, httpServer, "GET", "/v1/user/workspaces", authToken, nil)
			
			workspaces, ok := response.([]interface{})
			require.True(t, ok, "Response should be an array")
			
			// Should not contain "Work" workspace anymore
			for _, ws := range workspaces {
				wsMap := ws.(map[string]interface{})
				assert.NotEqual(t, "Work", wsMap["workspace"], "Work workspace should be deleted")
			}
		})
	})
}

// TestCategoryE2E_ErrorCases tests error scenarios
func TestCategoryE2E_ErrorCases(t *testing.T) {
	ctx := context.Background()

	// Skip if running in CI without database access
	if testutils.IsCI() {
		t.Skip("Skipping database tests in CI environment")
	}

	// Setup test database
	testConfig, err := testutils.TestDBFromEnv()
	require.NoError(t, err)

	testDB, err := testutils.NewTestDB(ctx, testConfig)
	require.NoError(t, err)
	defer testDB.TearDown(ctx)

	// Ensure all required collections exist and are in the collections map
	requiredCollections := []string{
		"users", "categories", "activity", "friend-requests", 
		"completed-tasks", "template-tasks", "posts", "waitlist", 
		"blueprints", "passwordResets", "health", "sample",
	}
	
	if testDB.DB.Collections == nil {
		testDB.DB.Collections = make(map[string]*mongo.Collection)
	}
	
	for _, collectionName := range requiredCollections {
		// Create the collection in the database if it doesn't exist
		err := testDB.DB.DB.CreateCollection(ctx, collectionName)
		if err != nil {
			// Ignore errors if collection already exists
			t.Logf("Note: Collection %s might already exist: %v", collectionName, err)
		}
		
		// Add to collections map
		testDB.DB.Collections[collectionName] = testDB.DB.DB.Collection(collectionName)
	}

	// Setup test server
	api, httpServer := setupTestServer(t, testDB.DB.Collections)
	_, authToken := setupTestUserAndAuth(t, api, httpServer, testDB)

	t.Run("Authentication Errors", func(t *testing.T) {
		t.Run("Missing Authorization Header", func(t *testing.T) {
			req := createRequest(t, "POST", "/v1/user/categories", map[string]interface{}{
				"name": "Test Category",
			})
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)
			
			assert.Equal(t, http.StatusUnauthorized, rr.Code)
		})

		t.Run("Invalid Authorization Token", func(t *testing.T) {
			req := createAuthenticatedRequest(t, "POST", "/v1/user/categories", "Bearer invalid-token", map[string]interface{}{
				"name": "Test Category",
			})
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)
			
			assert.Equal(t, http.StatusUnauthorized, rr.Code)
		})
	})

	t.Run("Validation Errors", func(t *testing.T) {
		t.Run("Create Category Missing Required Fields", func(t *testing.T) {
			req := createAuthenticatedRequest(t, "POST", "/v1/user/categories", authToken, map[string]interface{}{
				// Missing required "name" field
				"description": "Test description",
			})
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)
			
			assert.Equal(t, http.StatusBadRequest, rr.Code)
		})

		t.Run("Invalid Category ID Format", func(t *testing.T) {
			req := createAuthenticatedRequest(t, "GET", "/v1/categories/invalid-id", authToken, nil)
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)
			
			assert.NotEqual(t, http.StatusOK, rr.Code)
		})

		t.Run("Category Not Found", func(t *testing.T) {
			nonExistentID := primitive.NewObjectID().Hex()
			req := createAuthenticatedRequest(t, "GET", fmt.Sprintf("/v1/categories/%s", nonExistentID), authToken, nil)
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)
			
			assert.NotEqual(t, http.StatusOK, rr.Code)
		})
	})

	t.Run("Permission Errors", func(t *testing.T) {
		// Create a category with one user
		categoryData := map[string]interface{}{
			"name":      "Private Category",
			"workspace": "Private",
		}
		createdCategory := makeAuthenticatedRequest(t, httpServer, "POST", "/v1/user/categories", authToken, categoryData)
		categoryMap := createdCategory.(map[string]interface{})
		categoryID := categoryMap["_id"].(string)

		// Create another user
		_, otherAuthToken := setupTestUserAndAuth(t, api, httpServer, testDB)

		t.Run("Cannot Update Other User's Category", func(t *testing.T) {
			req := createAuthenticatedRequest(t, "PATCH", fmt.Sprintf("/v1/user/categories/%s", categoryID), otherAuthToken, map[string]interface{}{
				"name": "Hacked Category",
			})
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)
			
			assert.NotEqual(t, http.StatusOK, rr.Code, "Should not allow updating other user's category")
		})

		t.Run("Cannot Delete Other User's Category", func(t *testing.T) {
			req := createAuthenticatedRequest(t, "DELETE", fmt.Sprintf("/v1/user/categories/%s", categoryID), otherAuthToken, nil)
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)
			
			assert.NotEqual(t, http.StatusOK, rr.Code, "Should not allow deleting other user's category")
		})
	})
}

// Helper functions

func setupTestServer(t *testing.T, collections map[string]*mongo.Collection) (huma.API, *http.Server) {
	t.Helper()

	// Use the exact same server setup as the real server
	return server.New(collections, nil) // Pass nil for stream since we don't need it for testing
}

func setupTestUserAndAuth(t *testing.T, api huma.API, httpServer *http.Server, testDB *testutils.TestDB) (*types.SafeUser, string) {
	t.Helper()

	// Create test user
	userEmail := fmt.Sprintf("testuser%d@example.com", time.Now().UnixNano())
	userPassword := "testpassword123"

	// Register user
	registerData := map[string]interface{}{
		"email":    userEmail,
		"password": userPassword,
	}

	registerResponse := makeRequest(t, httpServer, "POST", "/v1/auth/register", registerData)
	require.NotEmpty(t, registerResponse, "Registration should succeed")

	// Login user to get auth token
	loginData := map[string]interface{}{
		"email":    userEmail,
		"password": userPassword,
	}

	req := createRequest(t, "POST", "/v1/auth/login", loginData)
	rr := httptest.NewRecorder()
	httpServer.Handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code, "Login should succeed")

	// Extract access token from response headers
	accessToken := rr.Header().Get("Access-Token")
	require.NotEmpty(t, accessToken, "Should receive access token")

	// Parse user from response body
	var loginResponse types.SafeUser
	err := json.Unmarshal(rr.Body.Bytes(), &loginResponse)
	require.NoError(t, err, "Should parse login response")

	return &loginResponse, "Bearer " + accessToken
}

func makeRequest(t *testing.T, server *http.Server, method, path string, data interface{}) interface{} {
	t.Helper()

	req := createRequest(t, method, path, data)
	rr := httptest.NewRecorder()
	server.Handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code, "Request should succeed")

	var response interface{}
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err, "Should parse response")

	return response
}

func makeAuthenticatedRequest(t *testing.T, server *http.Server, method, path, authToken string, data interface{}) interface{} {
	t.Helper()

	req := createAuthenticatedRequest(t, method, path, authToken, data)
	rr := httptest.NewRecorder()
	server.Handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code, fmt.Sprintf("Request to %s %s should succeed, got status %d: %s", method, path, rr.Code, rr.Body.String()))

	var response interface{}
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err, "Should parse response")

	return response
}

func createRequest(t *testing.T, method, path string, data interface{}) *http.Request {
	t.Helper()

	var body *bytes.Buffer
	if data != nil {
		jsonData, err := json.Marshal(data)
		require.NoError(t, err)
		body = bytes.NewBuffer(jsonData)
	} else {
		body = bytes.NewBuffer(nil)
	}

	req, err := http.NewRequest(method, path, body)
	require.NoError(t, err)

	if data != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return req
}

func createAuthenticatedRequest(t *testing.T, method, path, authToken string, data interface{}) *http.Request {
	t.Helper()

	req := createRequest(t, method, path, data)
	req.Header.Set("Authorization", authToken)

	return req
}