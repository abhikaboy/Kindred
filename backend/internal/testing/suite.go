package testing

import (
	"context"
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/mongo"
)

// BaseSuite provides common testing functionality for all test suites
// Automatically handles database setup/teardown and provides utilities
type BaseSuite struct {
	suite.Suite
	TestDB         *TestDatabase
	Fixtures       *TestFixtures
	Collections    map[string]*mongo.Collection
	Ctx            context.Context
	HTTP           *HTTPTestClient
	App            interface{} // Your Fiber app - set this in your suite
	MockPushSender *xutils.MockPushNotificationSender
}

// SetupTest runs before each test in the suite
func (s *BaseSuite) SetupTest() {
	// Create fresh ephemeral database with fixtures
	testDB, fixtures, err := SetupTestEnvironment()
	s.Require().NoError(err, "Failed to setup test environment")

	s.TestDB = testDB
	s.Fixtures = fixtures
	s.Collections = testDB.GetCollections()
	s.Ctx = context.Background()

	// Setup mock push notification sender
	s.MockPushSender = xutils.NewMockPushNotificationSender()
	xutils.SetPushNotificationSender(s.MockPushSender)

	s.T().Logf("Test database created: %s", testDB.DatabaseName)
}

// TearDownTest runs after each test in the suite
func (s *BaseSuite) TearDownTest() {
	if s.TestDB != nil {
		err := TeardownTestEnvironment(s.TestDB)
		if err != nil {
			s.T().Logf("Warning: Failed to teardown test environment: %v", err)
		}
	}

	// Reset mock push notification sender
	if s.MockPushSender != nil {
		s.MockPushSender.Reset()
	}
}

// GetUser is a convenience method to get a test user
func (s *BaseSuite) GetUser(index int) *types.User {
	return s.Fixtures.GetTestUser(index)
}

// GetPost is a convenience method to get a test post
func (s *BaseSuite) GetPost(index int) *types.PostDocument {
	return s.Fixtures.GetTestPost(index)
}

// GetConnection is a convenience method to get a test connection
func (s *BaseSuite) GetConnection(index int) interface{} {
	return s.Fixtures.GetTestConnection(index)
}

// InsertOne is a helper to insert a document into a collection
func (s *BaseSuite) InsertOne(collectionName string, document interface{}) {
	collection := s.Collections[collectionName]
	s.Require().NotNil(collection, "Collection %s not found", collectionName)

	_, err := collection.InsertOne(s.Ctx, document)
	s.Require().NoError(err, "Failed to insert document into %s", collectionName)
}

// FindOne is a helper to find a document in a collection
func (s *BaseSuite) FindOne(collectionName string, filter interface{}, result interface{}) {
	collection := s.Collections[collectionName]
	s.Require().NotNil(collection, "Collection %s not found", collectionName)

	err := collection.FindOne(s.Ctx, filter).Decode(result)
	s.Require().NoError(err, "Failed to find document in %s", collectionName)
}

// CountDocuments is a helper to count documents in a collection
func (s *BaseSuite) CountDocuments(collectionName string, filter interface{}) int64 {
	collection := s.Collections[collectionName]
	s.Require().NotNil(collection, "Collection %s not found", collectionName)

	count, err := collection.CountDocuments(s.Ctx, filter)
	s.Require().NoError(err, "Failed to count documents in %s", collectionName)

	return count
}

// AssertPushNotificationSent asserts that a push notification was sent to a specific token
func (s *BaseSuite) AssertPushNotificationSent(token string, msgAndArgs ...interface{}) {
	s.True(s.MockPushSender.AssertNotificationSent(token), msgAndArgs...)
}

// AssertPushNotificationCount asserts the number of push notifications sent
func (s *BaseSuite) AssertPushNotificationCount(expected int, msgAndArgs ...interface{}) {
	s.Equal(expected, len(s.MockPushSender.SentNotifications), msgAndArgs...)
}

// AssertPushNotificationNotSent asserts that no push notification was sent to a specific token
func (s *BaseSuite) AssertPushNotificationNotSent(token string, msgAndArgs ...interface{}) {
	s.False(s.MockPushSender.AssertNotificationSent(token), msgAndArgs...)
}

// GetSentPushNotifications returns all sent push notifications
func (s *BaseSuite) GetSentPushNotifications() []xutils.Notification {
	return s.MockPushSender.GetSentNotifications()
}

// GetSentPushNotificationsForToken returns all push notifications sent to a specific token
func (s *BaseSuite) GetSentPushNotificationsForToken(token string) []xutils.Notification {
	return s.MockPushSender.GetSentNotificationsForToken(token)
}

// GetSentPushNotificationsByType returns all push notifications of a specific type
func (s *BaseSuite) GetSentPushNotificationsByType(notificationType string) []xutils.Notification {
	return s.MockPushSender.GetSentNotificationsByType(notificationType)
}

// RunSuite is a helper function to run a test suite
func RunSuite(t *testing.T, testSuite suite.TestingSuite) {
	suite.Run(t, testSuite)
}
