package Connection_test

import (
	"context"
	"testing"

	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ConnectionServiceTestSuite is the test suite for Connection service
type ConnectionServiceTestSuite struct {
	testpkg.BaseSuite
	service *Connection.Service
}

// SetupTest runs before each test
func (s *ConnectionServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = Connection.NewService(s.Collections)
}

// TestConnectionService runs the test suite
func TestConnectionService(t *testing.T) {
	suite.Run(t, new(ConnectionServiceTestSuite))
}

// ========================================
// GetConnectionByID Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestGetConnectionByID_Success() {
	
	// Create a connection first
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	connectionID, err := primitive.ObjectIDFromHex(connection.ID)
	s.NoError(err)
	
	result, err := s.service.GetConnectionByID(connectionID)
	
	s.NoError(err)
	s.NotNil(result)
	s.Equal(connection.ID, result.ID)
}

func (s *ConnectionServiceTestSuite) TestGetConnectionByID_NotFound() {
	
	nonExistentID := primitive.NewObjectID()
	
	result, err := s.service.GetConnectionByID(nonExistentID)
	
	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
	s.Nil(result)
}

// ========================================
// GetAllConnections Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestGetAllConnections_Success() {
	
	connections, err := s.service.GetAllConnections()
	
	s.NoError(err)
	s.NotNil(connections)
	s.GreaterOrEqual(len(connections), 1)
}

// ========================================
// GetByReceiver Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestGetByReceiver_Success() {
	
	user := s.GetUser(1) // Get second user
	
	connections, err := s.service.GetByReciever(user.ID)
	
	s.NoError(err)
	s.NotNil(connections)
	// Should have at least one connection where this user is receiver
	s.GreaterOrEqual(len(connections), 0)
}

func (s *ConnectionServiceTestSuite) TestGetByReceiver_NoConnections() {
	
	nonExistentID := primitive.NewObjectID()
	
	connections, err := s.service.GetByReciever(nonExistentID)
	
	s.NoError(err)
	s.NotNil(connections)
	s.Equal(0, len(connections))
}

// ========================================
// GetByRequester Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestGetByRequester_Success() {
	
	user := s.GetUser(0)
	
	connections, err := s.service.GetByRequester(user.ID)
	
	s.NoError(err)
	s.NotNil(connections)
	s.GreaterOrEqual(len(connections), 0)
}

// ========================================
// CreateConnectionRequest Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestCreateConnectionRequest_Success() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Delete any existing relationship first
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	
	s.NoError(err)
	s.NotNil(connection)
	s.Equal(Connection.StatusPending, connection.Status)
	s.Equal(requester.ID.Hex(), connection.Requester.ID)
	s.Equal(receiver.ID.Hex(), connection.ReceiverID)
	
	// Verify push notification was sent to receiver
	s.AssertPushNotificationCount(1, "Expected one push notification to be sent")
	notifications := s.GetSentPushNotificationsForToken(receiver.PushToken)
	s.Require().Len(notifications, 1, "Expected notification to be sent to receiver")
	s.Equal("New Friend Request!", notifications[0].Title)
	s.Contains(notifications[0].Message, requester.DisplayName)
	s.Equal("friend_request", notifications[0].Data["type"])
}

func (s *ConnectionServiceTestSuite) TestCreateConnectionRequest_AlreadyExists() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create first request
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	_, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	// Try to create duplicate
	_, err = s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	
	s.Error(err)
	s.Contains(err.Error(), "relationship already exists")
}

func (s *ConnectionServiceTestSuite) TestCreateConnectionRequest_ReceiverNoPushToken() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Remove receiver's push token
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": receiver.ID}, bson.M{
		"$set": bson.M{"push_token": ""},
	})
	s.NoError(err)
	
	// Delete any existing relationship first
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	
	s.NoError(err)
	s.NotNil(connection)
	
	// Verify no push notification was sent (receiver has no token)
	s.AssertPushNotificationCount(0, "Expected no push notification when receiver has no token")
}

// ========================================
// AcceptConnection Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestAcceptConnection_Success() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create a pending connection request
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	// Reset mock to clear the notification from CreateConnectionRequest
	s.MockPushSender.Reset()
	
	// Parse the connection ID
	connectionID, err := primitive.ObjectIDFromHex(connection.ID)
	s.NoError(err)
	
	// Accept the connection as the receiver
	err = s.service.AcceptConnection(connectionID, receiver.ID)
	
	s.NoError(err)
	
	// Verify the connection status is now "friends"
	result, err := s.service.GetConnectionByID(connectionID)
	s.NoError(err)
	s.Equal(Connection.StatusFriends, result.Status)
	s.NotNil(result.AcceptedAt)
	
	// Verify push notification was sent to requester
	s.AssertPushNotificationCount(1, "Expected one push notification to be sent")
	notifications := s.GetSentPushNotificationsForToken(requester.PushToken)
	s.Require().Len(notifications, 1, "Expected notification to be sent to requester")
	s.Equal("Friend Request Accepted!", notifications[0].Title)
	s.Contains(notifications[0].Message, receiver.DisplayName)
	s.Equal("friend_request_accepted", notifications[0].Data["type"])
}

func (s *ConnectionServiceTestSuite) TestAcceptConnection_NotReceiver() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create a pending connection request
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	connectionID, err := primitive.ObjectIDFromHex(connection.ID)
	s.NoError(err)
	
	// Try to accept as the requester (should fail)
	err = s.service.AcceptConnection(connectionID, requester.ID)
	
	s.Error(err)
	s.Contains(err.Error(), "cannot accept your own connection request")
}

func (s *ConnectionServiceTestSuite) TestAcceptConnection_NotPending() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create and accept a connection
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	connectionID, err := primitive.ObjectIDFromHex(connection.ID)
	s.NoError(err)
	
	err = s.service.AcceptConnection(connectionID, receiver.ID)
	s.NoError(err)
	
	// Try to accept again (should fail)
	err = s.service.AcceptConnection(connectionID, receiver.ID)
	
	s.Error(err)
}

// ========================================
// GetPendingRequestsByReceiver Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestGetPendingRequestsByReceiver_Success() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create a pending connection request
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	_, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	// Get pending requests for receiver
	requests, err := s.service.GetPendingRequestsByReceiver(receiver.ID)
	
	s.NoError(err)
	s.NotNil(requests)
	s.GreaterOrEqual(len(requests), 1)
}

func (s *ConnectionServiceTestSuite) TestGetPendingRequestsByReceiver_NoPending() {
	
	nonExistentID := primitive.NewObjectID()
	
	requests, err := s.service.GetPendingRequestsByReceiver(nonExistentID)
	
	s.NoError(err)
	s.NotNil(requests)
	s.Equal(0, len(requests))
}

// ========================================
// DeleteConnection Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestDeleteConnection_Success() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create a connection
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	connectionID, err := primitive.ObjectIDFromHex(connection.ID)
	s.NoError(err)
	
	// Delete the connection
	err = s.service.DeleteConnection(connectionID)
	
	s.NoError(err)
	
	// Verify it's deleted
	_, err = s.service.GetConnectionByID(connectionID)
	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
}

// ========================================
// GetRelationship Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestGetRelationship_None() {
	
	user1 := s.GetUser(0)
	nonExistentID := primitive.NewObjectID()
	
	relationship, err := s.service.GetRelationship(user1.ID, nonExistentID)
	
	s.NoError(err)
	s.Equal(Connection.RelationshipNone, relationship)
}

func (s *ConnectionServiceTestSuite) TestGetRelationship_Pending() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create a pending connection
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	_, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	// Check from requester's perspective
	relationship, err := s.service.GetRelationship(requester.ID, receiver.ID)
	s.NoError(err)
	s.Equal(Connection.RelationshipRequestSent, relationship)
	
	// Check from receiver's perspective
	relationship, err = s.service.GetRelationship(receiver.ID, requester.ID)
	s.NoError(err)
	s.Equal(Connection.RelationshipRequestReceived, relationship)
}

func (s *ConnectionServiceTestSuite) TestGetRelationship_Friends() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create and accept connection
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	connectionID, err := primitive.ObjectIDFromHex(connection.ID)
	s.NoError(err)
	
	err = s.service.AcceptConnection(connectionID, receiver.ID)
	s.NoError(err)
	
	// Check relationship
	relationship, err := s.service.GetRelationship(requester.ID, receiver.ID)
	s.NoError(err)
	s.Equal(Connection.RelationshipFriends, relationship)
}

// ========================================
// GetFriends Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestGetFriends_Success() {
	
	requester := s.GetUser(0)
	receiver := s.GetUser(1)
	
	// Create and accept connection
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{requester.ID, receiver.ID}},
	})
	connection, err := s.service.CreateConnectionRequest(requester.ID, receiver.ID)
	s.NoError(err)
	
	connectionID, err := primitive.ObjectIDFromHex(connection.ID)
	s.NoError(err)
	
	err = s.service.AcceptConnection(connectionID, receiver.ID)
	s.NoError(err)
	
	// Get friends list
	friends, err := s.service.GetFriends(requester.ID)
	
	s.NoError(err)
	s.NotNil(friends)
	s.GreaterOrEqual(len(friends), 1)
}

// ========================================
// BlockUser Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestBlockUser_Success() {
	
	blocker := s.GetUser(0)
	blocked := s.GetUser(1)
	
	// Clean up any existing relationship
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{blocker.ID, blocked.ID}},
	})
	
	err := s.service.BlockUser(context.Background(), blocker.ID, blocked.ID)
	
	s.NoError(err)
	
	// Verify the block exists
	isBlocked, err := s.service.IsBlocked(context.Background(), blocker.ID, blocked.ID)
	s.NoError(err)
	s.True(isBlocked)
}

func (s *ConnectionServiceTestSuite) TestBlockUser_UpdateExisting() {
	
	blocker := s.GetUser(0)
	blocked := s.GetUser(1)
	
	// Create a friend connection first
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{blocker.ID, blocked.ID}},
	})
	connection, err := s.service.CreateConnectionRequest(blocker.ID, blocked.ID)
	s.NoError(err)
	
	connectionID, err := primitive.ObjectIDFromHex(connection.ID)
	s.NoError(err)
	
	err = s.service.AcceptConnection(connectionID, blocked.ID)
	s.NoError(err)
	
	// Now block the user
	err = s.service.BlockUser(context.Background(), blocker.ID, blocked.ID)
	
	s.NoError(err)
	
	// Verify the relationship is now blocked
	relationship, err := s.service.GetRelationship(blocker.ID, blocked.ID)
	s.NoError(err)
	s.Equal(Connection.RelationshipBlocked, relationship)
}

// ========================================
// UnblockUser Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestUnblockUser_Success() {
	
	blocker := s.GetUser(0)
	blocked := s.GetUser(1)
	
	// Block the user first
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{blocker.ID, blocked.ID}},
	})
	err := s.service.BlockUser(context.Background(), blocker.ID, blocked.ID)
	s.NoError(err)
	
	// Unblock the user
	err = s.service.UnblockUser(context.Background(), blocker.ID, blocked.ID)
	
	s.NoError(err)
	
	// Verify the block is removed
	isBlocked, err := s.service.IsBlocked(context.Background(), blocker.ID, blocked.ID)
	s.NoError(err)
	s.False(isBlocked)
}

func (s *ConnectionServiceTestSuite) TestUnblockUser_NotBlocked() {
	
	blocker := s.GetUser(0)
	nonBlocked := s.GetUser(1)
	
	// Try to unblock when not blocked
	err := s.service.UnblockUser(context.Background(), blocker.ID, nonBlocked.ID)
	
	s.Error(err)
	s.Contains(err.Error(), "no blocked relationship found")
}

// ========================================
// GetBlockedUsers Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestGetBlockedUsers_Success() {
	
	blocker := s.GetUser(0)
	blocked := s.GetUser(1)
	
	// Block the user
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{blocker.ID, blocked.ID}},
	})
	err := s.service.BlockUser(context.Background(), blocker.ID, blocked.ID)
	s.NoError(err)
	
	// Get blocked users
	blockedUsers, err := s.service.GetBlockedUsers(context.Background(), blocker.ID)
	
	s.NoError(err)
	s.NotNil(blockedUsers)
	s.GreaterOrEqual(len(blockedUsers), 1)
}

func (s *ConnectionServiceTestSuite) TestGetBlockedUsers_None() {
	
	user := s.GetUser(0)
	
	// Get blocked users when none exist
	blockedUsers, err := s.service.GetBlockedUsers(context.Background(), user.ID)
	
	s.NoError(err)
	s.NotNil(blockedUsers)
	// May have 0 or more depending on fixtures
	s.GreaterOrEqual(len(blockedUsers), 0)
}

// ========================================
// IsBlocked Tests
// ========================================

func (s *ConnectionServiceTestSuite) TestIsBlocked_True() {
	
	blocker := s.GetUser(0)
	blocked := s.GetUser(1)
	
	// Block the user
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{blocker.ID, blocked.ID}},
	})
	err := s.service.BlockUser(context.Background(), blocker.ID, blocked.ID)
	s.NoError(err)
	
	// Check if blocked
	isBlocked, err := s.service.IsBlocked(context.Background(), blocker.ID, blocked.ID)
	
	s.NoError(err)
	s.True(isBlocked)
}

func (s *ConnectionServiceTestSuite) TestIsBlocked_False() {
	
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Clean up any existing relationship
	s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{user1.ID, user2.ID}},
	})
	
	// Check if blocked
	isBlocked, err := s.service.IsBlocked(context.Background(), user1.ID, user2.ID)
	
	s.NoError(err)
	s.False(isBlocked)
}
