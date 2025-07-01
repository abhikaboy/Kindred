package testing

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TestFixtures holds all test data fixtures
type TestFixtures struct {
	Users       []interface{}
	Connections []interface{}
	// Add other collections as needed
}

// NewTestFixtures creates a new set of test fixtures
func NewTestFixtures() *TestFixtures {
	return &TestFixtures{
		Users:       generateTestUsers(),
		Connections: generateTestConnections(),
	}
}

// AsMap returns fixtures as a map for seeding
func (tf *TestFixtures) AsMap() map[string][]interface{} {
	return map[string][]interface{}{
		"users":           tf.Users,
		"friend-requests": tf.Connections,
	}
}

// generateTestUsers creates test user data
func generateTestUsers() []interface{} {
	users := []interface{}{
		auth.User{
			ID:          primitive.NewObjectID(),
			AppleID:     "test_apple_1",
			Email:       "test1@example.com",
			Password:    "password123",
			DisplayName: "Test User 1",
			Handle:      "testuser1",
			Count:       1.0,
			TokenUsed:   false,
			PushToken:   "test_push_token_1",
		},
		auth.User{
			ID:          primitive.NewObjectID(),
			AppleID:     "test_apple_2",
			Email:       "test2@example.com",
			Password:    "password123",
			DisplayName: "Test User 2",
			Handle:      "testuser2",
			Count:       1.0,
			TokenUsed:   false,
			PushToken:   "test_push_token_2",
		},
		auth.User{
			ID:          primitive.NewObjectID(),
			AppleID:     "test_apple_3",
			Email:       "test3@example.com",
			Password:    "password123",
			DisplayName: "Test User 3",
			Handle:      "testuser3",
			Count:       1.0,
			TokenUsed:   true, // This user has used their token
			PushToken:   "test_push_token_3",
		},
	}
	return users
}

// generateTestConnections creates test connection data
func generateTestConnections() []interface{} {
	// Get some test user IDs (these should match the ones in generateTestUsers)
	user1ID := primitive.NewObjectID()
	user2ID := primitive.NewObjectID()
	user3ID := primitive.NewObjectID()

	connections := []interface{}{
		Connection.ConnectionDocument{
			ID: primitive.NewObjectID(),
			Requester: Connection.UserExtendedReference{
				ID:      user1ID,
				Picture: stringPtr("https://example.com/pic1.jpg"),
				Name:    "Test User 1",
				Handle:  "testuser1",
			},
			Reciever:  user2ID,
			Timestamp: time.Now(),
		},
		Connection.ConnectionDocument{
			ID: primitive.NewObjectID(),
			Requester: Connection.UserExtendedReference{
				ID:      user2ID,
				Picture: stringPtr("https://example.com/pic2.jpg"),
				Name:    "Test User 2",
				Handle:  "testuser2",
			},
			Reciever:  user3ID,
			Timestamp: time.Now(),
		},
	}
	return connections
}

// Helper function to create string pointers
func stringPtr(s string) *string {
	return &s
}

// GetTestUser returns a test user by index
func (tf *TestFixtures) GetTestUser(index int) *auth.User {
	if index >= len(tf.Users) {
		return nil
	}
	user := tf.Users[index].(auth.User)
	return &user
}

// GetTestConnection returns a test connection by index
func (tf *TestFixtures) GetTestConnection(index int) *Connection.ConnectionDocument {
	if index >= len(tf.Connections) {
		return nil
	}
	connection := tf.Connections[index].(Connection.ConnectionDocument)
	return &connection
}

// CreateMinimalFixtures creates a minimal set of fixtures for simple tests
func CreateMinimalFixtures() map[string][]interface{} {
	user := auth.User{
		ID:          primitive.NewObjectID(),
		AppleID:     "minimal_test_user",
		Email:       "minimal@example.com",
		Password:    "password",
		DisplayName: "Minimal User",
		Handle:      "minimal",
		Count:       1.0,
		TokenUsed:   false,
	}

	return map[string][]interface{}{
		"users": {user},
	}
}

// CleanFixtures represents empty fixtures for cleanup tests
func CleanFixtures() map[string][]interface{} {
	return map[string][]interface{}{
		"users":           {},
		"friend-requests": {},
	}
}
