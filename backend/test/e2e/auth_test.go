package e2e

import (
	"context"
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/testutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestAuthService_E2E_UserLifecycle(t *testing.T) {
	ctx := context.Background()

	// Skip if running in CI without database access
	if testutils.IsCI() {
		t.Skip("Skipping database tests in CI environment")
	}

	// Setup test database
	testConfig, err := testutils.TestDBFromEnv()
	if err != nil {
		t.Skip("Skipping database test - no test config available")
	}

	testDB, err := testutils.NewTestDB(ctx, testConfig)
	if err != nil {
		t.Skip("Skipping database test - cannot connect to test database")
	}
	defer func() {
		if err := testDB.TearDown(ctx); err != nil {
			t.Logf("Warning: Failed to tear down test database: %v", err)
		}
	}()

	// Clean up before test
	err = testDB.ClearCollection(ctx, "users")
	require.NoError(t, err)

	// Test data
	userEmail := "e2e-test@example.com"
	userPassword := "testpassword123"
	
	// Verify we start with empty database
	count, err := testDB.CountDocuments(ctx, "users", bson.D{})
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	// Create a test user document directly in database
	testUser := auth.User{
		ID:          primitive.NewObjectID(),
		Email:       userEmail,
		Password:    userPassword,
		AppleID:     "e2e_test_apple_id",
		DisplayName: "E2E Test User",
		Handle:      "e2euser",
		Count:       1.0,
		TokenUsed:   false,
		PushToken:   "initial_push_token",
	}

	// Insert user directly into database
	_, err = testDB.DB.DB.Collection("users").InsertOne(ctx, testUser)
	require.NoError(t, err)

	// Verify user was created
	finalCount, err := testDB.CountDocuments(ctx, "users", bson.D{})
	require.NoError(t, err)
	assert.Equal(t, int64(1), finalCount)

	// Verify we can read the user back
	var retrievedUser auth.User
	err = testDB.DB.DB.Collection("users").FindOne(ctx, bson.M{"email": userEmail}).Decode(&retrievedUser)
	assert.NoError(t, err)
	assert.Equal(t, testUser.Email, retrievedUser.Email)
	assert.Equal(t, testUser.DisplayName, retrievedUser.DisplayName)
}

func TestAuthService_E2E_WithFixtures(t *testing.T) {
	ctx := context.Background()

	// Skip if running in CI without database access
	if testutils.IsCI() {
		t.Skip("Skipping database tests in CI environment")
	}

	// Setup test database
	testConfig, err := testutils.TestDBFromEnv()
	if err != nil {
		t.Skip("Skipping database test - no test config available")
	}

	testDB, err := testutils.NewTestDB(ctx, testConfig)
	if err != nil {
		t.Skip("Skipping database test - cannot connect to test database")
	}
	defer func() {
		if err := testDB.TearDown(ctx); err != nil {
			t.Logf("Warning: Failed to tear down test database: %v", err)
		}
	}()

	// Seed with test fixtures
	fixtures := testutils.NewTestFixtures()
	err = testDB.SeedData(ctx, fixtures.AsMap())
	require.NoError(t, err)

	// Verify fixtures were loaded
	userCount, err := testDB.CountDocuments(ctx, "users", bson.D{})
	assert.NoError(t, err)
	assert.Greater(t, userCount, int64(0))

	connectionCount, err := testDB.CountDocuments(ctx, "friend-requests", bson.D{})
	assert.NoError(t, err)
	assert.Greater(t, connectionCount, int64(0))

	// Test querying fixture data
	testUser := fixtures.GetTestUser(0)
	require.NotNil(t, testUser)

	var retrievedUser auth.User
	err = testDB.DB.DB.Collection("users").FindOne(ctx, bson.M{"email": testUser.Email}).Decode(&retrievedUser)
	assert.NoError(t, err)
	assert.Equal(t, testUser.Email, retrievedUser.Email)
} 