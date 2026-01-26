package encouragement_test

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/encouragement"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// EncouragementServiceTestSuite tests the encouragement service
type EncouragementServiceTestSuite struct {
	testpkg.BaseSuite
	service *encouragement.Service
}

// SetupTest runs before each test
func (s *EncouragementServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	
	// Initialize service with test database
	s.service = encouragement.NewEncouragementService(s.Collections)
}

// TestEncouragementService runs the test suite
func TestEncouragementService(t *testing.T) {
	testpkg.RunSuite(t, new(EncouragementServiceTestSuite))
}

// ========================================
// GetAllEncouragements Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestGetAllEncouragements_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Create test encouragements
	enc1 := s.createTestEncouragement(user1.ID, user2.ID, "Great job!", "task", "Work", "Complete report", primitive.NewObjectID())
	enc2 := s.createTestEncouragement(user1.ID, user2.ID, "Keep it up!", "profile", "", "", primitive.NilObjectID)
	
	// Fetch encouragements for user2
	results, err := s.service.GetAllEncouragements(user2.ID)
	
	// Assertions
	s.NoError(err)
	s.NotNil(results)
	s.GreaterOrEqual(len(results), 2)
	
	// Verify the encouragements are in the results
	foundEnc1 := false
	foundEnc2 := false
	for _, enc := range results {
		if enc.ID == enc1.Hex() {
			foundEnc1 = true
			s.Equal("Great job!", enc.Message)
			s.Equal("task", enc.Scope)
		}
		if enc.ID == enc2.Hex() {
			foundEnc2 = true
			s.Equal("Keep it up!", enc.Message)
			s.Equal("profile", enc.Scope)
		}
	}
	s.True(foundEnc1, "First encouragement should be found")
	s.True(foundEnc2, "Second encouragement should be found")
}

func (s *EncouragementServiceTestSuite) TestGetAllEncouragements_EmptyResult() {
	user := s.GetUser(0)
	
	// Fetch encouragements for user with no encouragements
	results, err := s.service.GetAllEncouragements(user.ID)
	
	// Assertions
	s.NoError(err)
	s.NotNil(results)
	s.Empty(results)
}

// ========================================
// GetEncouragementByID Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestGetEncouragementByID_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Create test encouragement
	encID := s.createTestEncouragement(user1.ID, user2.ID, "Awesome work!", "task", "Personal", "Exercise", primitive.NewObjectID())
	
	// Fetch it via service
	result, err := s.service.GetEncouragementByID(encID)
	
	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal(encID.Hex(), result.ID)
	s.Equal("Awesome work!", result.Message)
	s.Equal("task", result.Scope)
	s.Equal("Personal", result.CategoryName)
	s.Equal("Exercise", result.TaskName)
}

func (s *EncouragementServiceTestSuite) TestGetEncouragementByID_NotFound() {
	fakeID := testpkg.GenerateObjectID()
	
	result, err := s.service.GetEncouragementByID(fakeID)
	
	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
	s.Nil(result)
}

// ========================================
// GetEncouragementsByTaskAndReceiver Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestGetEncouragementsByTaskAndReceiver_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	user3 := s.GetUser(2)
	taskID := primitive.NewObjectID()
	
	// Create multiple encouragements for the same task
	s.createTestEncouragement(user1.ID, user2.ID, "You can do it!", "task", "Work", "Project", taskID)
	s.createTestEncouragement(user3.ID, user2.ID, "Keep going!", "task", "Work", "Project", taskID)
	
	// Create encouragement for different task (should not be returned)
	differentTaskID := primitive.NewObjectID()
	s.createTestEncouragement(user1.ID, user2.ID, "Different task", "task", "Work", "Other", differentTaskID)
	
	// Fetch encouragements for specific task and receiver
	results, err := s.service.GetEncouragementsByTaskAndReceiver(taskID, user2.ID)
	
	// Assertions
	s.NoError(err)
	s.NotNil(results)
	s.Equal(2, len(results))
	
	// Verify both encouragements are for the correct task
	for _, enc := range results {
		s.Equal(taskID, enc.TaskID)
		s.Equal(user2.ID, enc.Receiver)
	}
}

func (s *EncouragementServiceTestSuite) TestGetEncouragementsByTaskAndReceiver_NoResults() {
	user := s.GetUser(0)
	fakeTaskID := testpkg.GenerateObjectID()
	
	results, err := s.service.GetEncouragementsByTaskAndReceiver(fakeTaskID, user.ID)
	
	s.NoError(err)
	s.Empty(results)
}

// ========================================
// CreateEncouragement Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestCreateEncouragement_TaskScope_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	taskID := primitive.NewObjectID()
	
	// Ensure sender has encouragement balance
	s.setUserEncouragementBalance(user1.ID, 5)
	
	// Get sender info
	senderInfo, err := s.service.GetSenderInfo(user1.ID)
	s.NoError(err)
	
	newEnc := &encouragement.EncouragementDocumentInternal{
		Sender:       *senderInfo,
		Receiver:     user2.ID,
		Message:      "Great progress!",
		Scope:        "task",
		CategoryName: "Health",
		TaskName:     "Morning run",
		TaskID:       taskID,
		Type:         "message",
	}
	
	result, err := s.service.CreateEncouragement(newEnc)
	
	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal("Great progress!", result.Message)
	s.Equal("task", result.Scope)
	s.Equal("Health", result.CategoryName)
	s.Equal("Morning run", result.TaskName)
	s.Equal(taskID.Hex(), result.TaskID)
	s.False(result.Read)
	
	// Verify it was inserted
	var found encouragement.EncouragementDocumentInternal
	encID, _ := primitive.ObjectIDFromHex(result.ID)
	err = s.Collections["encouragements"].FindOne(s.Ctx, bson.M{"_id": encID}).Decode(&found)
	s.NoError(err)
	s.Equal("Great progress!", found.Message)
	
	// Verify balance was decremented
	balance, err := s.service.GetUserBalance(user1.ID)
	s.NoError(err)
	s.Equal(4, balance)
}

func (s *EncouragementServiceTestSuite) TestCreateEncouragement_ProfileScope_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Ensure sender has encouragement balance
	s.setUserEncouragementBalance(user1.ID, 3)
	
	// Get sender info
	senderInfo, err := s.service.GetSenderInfo(user1.ID)
	s.NoError(err)
	
	newEnc := &encouragement.EncouragementDocumentInternal{
		Sender:   *senderInfo,
		Receiver: user2.ID,
		Message:  "You're doing amazing!",
		Scope:    "profile",
		Type:     "message",
	}
	
	result, err := s.service.CreateEncouragement(newEnc)
	
	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal("You're doing amazing!", result.Message)
	s.Equal("profile", result.Scope)
	s.Empty(result.CategoryName)
	s.Empty(result.TaskName)
	s.Empty(result.TaskID)
	
	// Verify balance was decremented
	balance, err := s.service.GetUserBalance(user1.ID)
	s.NoError(err)
	s.Equal(2, balance)
}

func (s *EncouragementServiceTestSuite) TestCreateEncouragement_ImageType_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Ensure sender has encouragement balance
	s.setUserEncouragementBalance(user1.ID, 2)
	
	// Get sender info
	senderInfo, err := s.service.GetSenderInfo(user1.ID)
	s.NoError(err)
	
	newEnc := &encouragement.EncouragementDocumentInternal{
		Sender:   *senderInfo,
		Receiver: user2.ID,
		Message:  "https://example.com/encouragement-image.jpg",
		Scope:    "profile",
		Type:     "image",
	}
	
	result, err := s.service.CreateEncouragement(newEnc)
	
	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal("image", result.Type)
	s.Equal("https://example.com/encouragement-image.jpg", result.Message)
}

func (s *EncouragementServiceTestSuite) TestCreateEncouragement_InsufficientBalance() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Set balance to 0
	s.setUserEncouragementBalance(user1.ID, 0)
	
	// Get sender info
	senderInfo, err := s.service.GetSenderInfo(user1.ID)
	s.NoError(err)
	
	newEnc := &encouragement.EncouragementDocumentInternal{
		Sender:   *senderInfo,
		Receiver: user2.ID,
		Message:  "This should fail",
		Scope:    "profile",
		Type:     "message",
	}
	
	result, err := s.service.CreateEncouragement(newEnc)
	
	// Assertions
	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "insufficient encouragement balance")
}

// ========================================
// UpdatePartialEncouragement Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestUpdatePartialEncouragement_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Create test encouragement
	encID := s.createTestEncouragement(user1.ID, user2.ID, "Original message", "task", "Work", "Task", primitive.NewObjectID())
	
	// Update fields
	newMessage := "Updated message"
	newTaskName := "Updated task"
	update := encouragement.UpdateEncouragementDocument{
		Message:  &newMessage,
		TaskName: &newTaskName,
	}
	
	err := s.service.UpdatePartialEncouragement(encID, update)
	
	// Assertions
	s.NoError(err)
	
	// Verify the update
	result, err := s.service.GetEncouragementByID(encID)
	s.NoError(err)
	s.Equal("Updated message", result.Message)
	s.Equal("Updated task", result.TaskName)
	s.Equal("Work", result.CategoryName) // Should remain unchanged
}

func (s *EncouragementServiceTestSuite) TestUpdatePartialEncouragement_MarkAsRead() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Create test encouragement
	encID := s.createTestEncouragement(user1.ID, user2.ID, "Message", "profile", "", "", primitive.NilObjectID)
	
	// Mark as read
	readStatus := true
	update := encouragement.UpdateEncouragementDocument{
		Read: &readStatus,
	}
	
	err := s.service.UpdatePartialEncouragement(encID, update)
	
	// Assertions
	s.NoError(err)
	
	// Verify the update
	result, err := s.service.GetEncouragementByID(encID)
	s.NoError(err)
	s.True(result.Read)
}

// ========================================
// DeleteEncouragement Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestDeleteEncouragement_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Create test encouragement
	encID := s.createTestEncouragement(user1.ID, user2.ID, "To be deleted", "profile", "", "", primitive.NilObjectID)
	
	// Delete it
	err := s.service.DeleteEncouragement(encID)
	
	// Assertions
	s.NoError(err)
	
	// Verify it's deleted
	result, err := s.service.GetEncouragementByID(encID)
	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
	s.Nil(result)
}

func (s *EncouragementServiceTestSuite) TestDeleteEncouragement_NonExistent() {
	fakeID := testpkg.GenerateObjectID()
	
	// Try to delete non-existent encouragement
	err := s.service.DeleteEncouragement(fakeID)
	
	// Should not error (MongoDB DeleteOne doesn't error on non-existent docs)
	s.NoError(err)
}

// ========================================
// MarkEncouragementsAsRead Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestMarkEncouragementsAsRead_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Create multiple unread encouragements
	enc1ID := s.createTestEncouragement(user1.ID, user2.ID, "Message 1", "profile", "", "", primitive.NilObjectID)
	enc2ID := s.createTestEncouragement(user1.ID, user2.ID, "Message 2", "profile", "", "", primitive.NilObjectID)
	enc3ID := s.createTestEncouragement(user1.ID, user2.ID, "Message 3", "profile", "", "", primitive.NilObjectID)
	
	// Mark first two as read
	ids := []primitive.ObjectID{enc1ID, enc2ID}
	count, err := s.service.MarkEncouragementsAsRead(ids)
	
	// Assertions
	s.NoError(err)
	s.Equal(int64(2), count)
	
	// Verify they are marked as read
	enc1, _ := s.service.GetEncouragementByID(enc1ID)
	enc2, _ := s.service.GetEncouragementByID(enc2ID)
	enc3, _ := s.service.GetEncouragementByID(enc3ID)
	
	s.True(enc1.Read)
	s.True(enc2.Read)
	s.False(enc3.Read) // Should still be unread
}

func (s *EncouragementServiceTestSuite) TestMarkEncouragementsAsRead_EmptyArray() {
	ids := []primitive.ObjectID{}
	count, err := s.service.MarkEncouragementsAsRead(ids)
	
	// Should succeed with 0 count
	s.NoError(err)
	s.Equal(int64(0), count)
}

func (s *EncouragementServiceTestSuite) TestMarkEncouragementsAsRead_NonExistentIDs() {
	fakeID1 := testpkg.GenerateObjectID()
	fakeID2 := testpkg.GenerateObjectID()
	
	ids := []primitive.ObjectID{fakeID1, fakeID2}
	count, err := s.service.MarkEncouragementsAsRead(ids)
	
	// Should succeed with 0 count
	s.NoError(err)
	s.Equal(int64(0), count)
}

// ========================================
// GetUserBalance Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestGetUserBalance_Success() {
	user := s.GetUser(0)
	
	// Set a specific balance
	s.setUserEncouragementBalance(user.ID, 10)
	
	balance, err := s.service.GetUserBalance(user.ID)
	
	// Assertions
	s.NoError(err)
	s.Equal(10, balance)
}

func (s *EncouragementServiceTestSuite) TestGetUserBalance_NonExistentUser() {
	fakeID := testpkg.GenerateObjectID()
	
	balance, err := s.service.GetUserBalance(fakeID)
	
	// Should error
	s.Error(err)
	s.Equal(0, balance)
}

// ========================================
// DecrementUserBalance Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestDecrementUserBalance_Success() {
	user := s.GetUser(0)
	
	// Set initial balance
	s.setUserEncouragementBalance(user.ID, 5)
	
	// Decrement
	err := s.service.DecrementUserBalance(user.ID)
	s.NoError(err)
	
	// Verify new balance
	balance, err := s.service.GetUserBalance(user.ID)
	s.NoError(err)
	s.Equal(4, balance)
	
	// Verify kudosRewards.encouragements was incremented
	var user_doc types.User
	err = s.Collections["users"].FindOne(s.Ctx, bson.M{"_id": user.ID}).Decode(&user_doc)
	s.NoError(err)
	s.Equal(1, user_doc.KudosRewards.Encouragements)
}

func (s *EncouragementServiceTestSuite) TestDecrementUserBalance_CanGoNegative() {
	user := s.GetUser(0)
	
	// Set balance to 0
	s.setUserEncouragementBalance(user.ID, 0)
	
	// Decrement (should work, going negative)
	err := s.service.DecrementUserBalance(user.ID)
	s.NoError(err)
	
	// Verify new balance is negative
	balance, err := s.service.GetUserBalance(user.ID)
	s.NoError(err)
	s.Equal(-1, balance)
}

// ========================================
// GetSenderInfo Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestGetSenderInfo_Success() {
	user := s.GetUser(0)
	
	senderInfo, err := s.service.GetSenderInfo(user.ID)
	
	// Assertions
	s.NoError(err)
	s.NotNil(senderInfo)
	s.Equal(user.ID, senderInfo.ID)
	s.Equal(user.DisplayName, senderInfo.Name)
	s.Equal(user.ProfilePicture, senderInfo.Picture)
}

func (s *EncouragementServiceTestSuite) TestGetSenderInfo_NonExistentUser() {
	fakeID := testpkg.GenerateObjectID()
	
	senderInfo, err := s.service.GetSenderInfo(fakeID)
	
	// Should error
	s.Error(err)
	s.Nil(senderInfo)
}

// ========================================
// NotifyEncouragersOfCompletion Tests
// ========================================

func (s *EncouragementServiceTestSuite) TestNotifyEncouragersOfCompletion_Success() {
	user1 := s.GetUser(0) // Encourager
	user2 := s.GetUser(1) // Task owner
	user3 := s.GetUser(2) // Another encourager
	taskID := primitive.NewObjectID()
	
	// Create encouragements from multiple users
	s.createTestEncouragement(user1.ID, user2.ID, "You got this!", "task", "Work", "Project", taskID)
	s.createTestEncouragement(user3.ID, user2.ID, "Keep going!", "task", "Work", "Project", taskID)
	
	// Notify encouragers
	err := s.service.NotifyEncouragersOfCompletion(taskID, user2.ID, "Project")
	
	// Should not error (notifications might fail silently if push tokens are invalid)
	s.NoError(err)
}

func (s *EncouragementServiceTestSuite) TestNotifyEncouragersOfCompletion_NoEncouragements() {
	user := s.GetUser(0)
	fakeTaskID := testpkg.GenerateObjectID()
	
	// Try to notify for task with no encouragements
	err := s.service.NotifyEncouragersOfCompletion(fakeTaskID, user.ID, "Task")
	
	// Should not error
	s.NoError(err)
}

func (s *EncouragementServiceTestSuite) TestNotifyEncouragersOfCompletion_DuplicateEncourager() {
	user1 := s.GetUser(0) // Encourager
	user2 := s.GetUser(1) // Task owner
	taskID := primitive.NewObjectID()
	
	// Create multiple encouragements from same user
	s.createTestEncouragement(user1.ID, user2.ID, "First encouragement", "task", "Work", "Project", taskID)
	s.createTestEncouragement(user1.ID, user2.ID, "Second encouragement", "task", "Work", "Project", taskID)
	
	// Notify encouragers (should only notify user1 once)
	err := s.service.NotifyEncouragersOfCompletion(taskID, user2.ID, "Project")
	
	// Should not error
	s.NoError(err)
}

// ========================================
// Helper Methods
// ========================================

// createTestEncouragement creates and inserts a test encouragement, returns its ID
func (s *EncouragementServiceTestSuite) createTestEncouragement(
	senderID, receiverID primitive.ObjectID,
	message, scope, categoryName, taskName string,
	taskID primitive.ObjectID,
) primitive.ObjectID {
	// Get sender info
	var sender types.User
	err := s.Collections["users"].FindOne(s.Ctx, bson.M{"_id": senderID}).Decode(&sender)
	s.Require().NoError(err)
	
	enc := encouragement.EncouragementDocumentInternal{
		ID: primitive.NewObjectID(),
		Sender: encouragement.EncouragementSenderInternal{
			Name:    sender.DisplayName,
			Picture: sender.ProfilePicture,
			ID:      sender.ID,
		},
		Receiver:     receiverID,
		Message:      message,
		Timestamp:    time.Now(),
		Scope:        scope,
		CategoryName: categoryName,
		TaskName:     taskName,
		TaskID:       taskID,
		Read:         false,
		Type:         "message",
	}
	
	_, err = s.Collections["encouragements"].InsertOne(s.Ctx, enc)
	s.Require().NoError(err)
	
	return enc.ID
}

// setUserEncouragementBalance sets a user's encouragement balance
func (s *EncouragementServiceTestSuite) setUserEncouragementBalance(userID primitive.ObjectID, balance int) {
	_, err := s.Collections["users"].UpdateOne(
		s.Ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"encouragements": balance}},
	)
	s.Require().NoError(err)
}
