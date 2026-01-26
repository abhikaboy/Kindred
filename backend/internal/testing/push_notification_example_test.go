package testing_test

import (
	"testing"

	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
)

// ExamplePushNotificationTestSuite demonstrates how to test push notifications
type ExamplePushNotificationTestSuite struct {
	testpkg.BaseSuite
	service *Connection.Service
}

func (s *ExamplePushNotificationTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = Connection.NewService(s.Collections)
}

// TestPushNotificationExample runs the example test suite
func TestPushNotificationExample(t *testing.T) {
	suite.Run(t, new(ExamplePushNotificationTestSuite))
}

// Example 1: Basic notification assertion
func (s *ExamplePushNotificationTestSuite) TestBasicNotificationAssertion() {
	requester := s.GetUser(0)
	receiver := s.GetUser(1)

	// Clear any existing relationships
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []interface{}{requester.ID, receiver.ID}},
	})

	// Perform action that sends notification
	_, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)

	// Assert notification was sent
	s.AssertPushNotificationCount(1, "Expected one notification to be sent")
	s.AssertPushNotificationSent(receiver.PushToken, "Expected notification to receiver")
}

// Example 2: Verify notification content
func (s *ExamplePushNotificationTestSuite) TestNotificationContent() {
	requester := s.GetUser(0)
	receiver := s.GetUser(1)

	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []interface{}{requester.ID, receiver.ID}},
	})

	_, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)

	// Get notifications sent to receiver
	notifications := s.GetSentPushNotificationsForToken(receiver.PushToken)
	s.Require().Len(notifications, 1, "Expected one notification")

	// Verify notification content
	notification := notifications[0]
	s.Equal("New Friend Request!", notification.Title)
	s.Contains(notification.Message, requester.DisplayName)
	s.Equal("friend_request", notification.Data["type"])
	s.Equal(requester.ID.Hex(), notification.Data["requester_id"])
}

// Example 3: Test with no push token
func (s *ExamplePushNotificationTestSuite) TestNoPushToken() {
	requester := s.GetUser(0)
	receiver := s.GetUser(1)

	// Remove receiver's push token
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": receiver.ID}, bson.M{
		"$set": bson.M{"push_token": ""},
	})
	s.NoError(err)

	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []interface{}{requester.ID, receiver.ID}},
	})

	_, err = s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)

	// No notification should be sent when user has no push token
	s.AssertPushNotificationCount(0, "Expected no notification when user has no push token")
}

// Example 4: Test multiple notifications
func (s *ExamplePushNotificationTestSuite) TestMultipleNotifications() {
	requester := s.GetUser(0)
	receiver1 := s.GetUser(1)
	receiver2 := s.GetUser(2)

	// Clear existing relationships
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{})

	// Send multiple friend requests
	_, err := s.service.CreateConnectionRequest(requester.ID, receiver1.ID)
	s.NoError(err)

	_, err = s.service.CreateConnectionRequest(requester.ID, receiver2.ID)
	s.NoError(err)

	// Assert total count
	s.AssertPushNotificationCount(2, "Expected two notifications")

	// Verify each receiver got their notification
	s.AssertPushNotificationSent(receiver1.PushToken)
	s.AssertPushNotificationSent(receiver2.PushToken)
}

// Example 5: Reset mock between test steps
func (s *ExamplePushNotificationTestSuite) TestResetBetweenSteps() {
	requester := s.GetUser(0)
	receiver := s.GetUser(1)

	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []interface{}{requester.ID, receiver.ID}},
	})

	// Step 1: Create friend request
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	s.AssertPushNotificationCount(1, "Expected one notification from create request")

	// Reset mock to clear previous notifications
	s.MockPushSender.Reset()

	// Step 2: Accept friend request
	// nolint:staticcheck // DecodeBytes is deprecated but still functional for this test
	connectionID, err := s.Collections["friend-requests"].FindOne(s.Ctx, bson.M{
		"users": bson.M{"$all": []interface{}{requester.ID, receiver.ID}},
	}).DecodeBytes()
	s.NoError(err)

	objID := connectionID.Lookup("_id").ObjectID()
	err = s.service.AcceptConnection(objID, receiver.ID)
	s.NoError(err)

	// Only count notifications from this step
	s.AssertPushNotificationCount(1, "Expected one notification from accept request")
	s.AssertPushNotificationSent(requester.PushToken, "Requester should be notified of acceptance")

	_ = connection // Use connection to avoid unused variable warning
}

// Example 6: Filter notifications by type
func (s *ExamplePushNotificationTestSuite) TestFilterByType() {
	requester := s.GetUser(0)
	receiver := s.GetUser(1)

	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []interface{}{requester.ID, receiver.ID}},
	})

	// Create and accept friend request
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)

	// nolint:staticcheck // DecodeBytes is deprecated but still functional for this test
	connectionID, err := s.Collections["friend-requests"].FindOne(s.Ctx, bson.M{
		"users": bson.M{"$all": []interface{}{requester.ID, receiver.ID}},
	}).DecodeBytes()
	s.NoError(err)

	objID := connectionID.Lookup("_id").ObjectID()
	err = s.service.AcceptConnection(objID, receiver.ID)
	s.NoError(err)

	// Get notifications by type
	friendRequests := s.GetSentPushNotificationsByType("friend_request")
	acceptedRequests := s.GetSentPushNotificationsByType("friend_request_accepted")

	s.Len(friendRequests, 1, "Expected one friend request notification")
	s.Len(acceptedRequests, 1, "Expected one friend request accepted notification")

	_ = connection // Use connection to avoid unused variable warning
}
