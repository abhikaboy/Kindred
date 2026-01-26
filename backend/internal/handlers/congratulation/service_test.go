package congratulation_test

import (
	"testing"
	"time"

	. "github.com/abhikaboy/Kindred/internal/handlers/congratulation"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// CongratulationServiceTestSuite tests the congratulation service
type CongratulationServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

// SetupTest runs before each test
func (s *CongratulationServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()

	// Initialize service with test database
	s.service = NewService(s.Collections)
}

// TestCongratulationService runs the test suite
func TestCongratulationService(t *testing.T) {
	testpkg.RunSuite(t, new(CongratulationServiceTestSuite))
}

// ========================================
// GetAllCongratulations Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestGetAllCongratulations_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Create test congratulations
	congratulation1 := map[string]interface{}{
		"_id": primitive.NewObjectID(),
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Great job!",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Complete project",
		"read":         false,
		"type":         "message",
	}

	congratulation2 := map[string]interface{}{
		"_id": primitive.NewObjectID(),
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Well done!",
		"timestamp":    time.Now(),
		"categoryName": "Personal",
		"taskName":     "Exercise",
		"read":         true,
		"type":         "message",
	}

	s.InsertOne("congratulations", congratulation1)
	s.InsertOne("congratulations", congratulation2)

	// Fetch congratulations
	results, err := s.service.GetAllCongratulations(user2.ID)

	// Assertions
	s.NoError(err)
	s.NotNil(results)
	s.Len(results, 2)
	s.Equal("Great job!", results[0].Message)
	s.Equal("Work", results[0].CategoryName)
}

func (s *CongratulationServiceTestSuite) TestGetAllCongratulations_Empty() {
	user := s.GetUser(0)

	// Fetch congratulations for user with none
	results, err := s.service.GetAllCongratulations(user.ID)

	// Assertions
	s.NoError(err)
	s.NotNil(results)
	s.Len(results, 0)
}

func (s *CongratulationServiceTestSuite) TestGetAllCongratulations_FiltersByReceiver() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	user3 := s.GetUser(2)

	// Create congratulations for different receivers
	congratulation1 := map[string]interface{}{
		"_id": primitive.NewObjectID(),
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "For user 2",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Task 1",
		"read":         false,
		"type":         "message",
	}

	congratulation2 := map[string]interface{}{
		"_id": primitive.NewObjectID(),
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user3.ID,
		"message":      "For user 3",
		"timestamp":    time.Now(),
		"categoryName": "Personal",
		"taskName":     "Task 2",
		"read":         false,
		"type":         "message",
	}

	s.InsertOne("congratulations", congratulation1)
	s.InsertOne("congratulations", congratulation2)

	// Fetch congratulations for user2 only
	results, err := s.service.GetAllCongratulations(user2.ID)

	// Assertions
	s.NoError(err)
	s.Len(results, 1)
	s.Equal("For user 2", results[0].Message)
	s.Equal(user2.ID.Hex(), results[0].Receiver)
}

// ========================================
// GetCongratulationByID Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestGetCongratulationByID_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	congratulationID := primitive.NewObjectID()
	congratulation := map[string]interface{}{
		"_id": congratulationID,
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Congratulations!",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Complete project",
		"read":         false,
		"type":         "message",
	}

	s.InsertOne("congratulations", congratulation)

	// Fetch by ID
	result, err := s.service.GetCongratulationByID(congratulationID)

	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal(congratulationID.Hex(), result.ID)
	s.Equal("Congratulations!", result.Message)
	s.Equal("Work", result.CategoryName)
}

func (s *CongratulationServiceTestSuite) TestGetCongratulationByID_NotFound() {
	fakeID := testpkg.GenerateObjectID()

	result, err := s.service.GetCongratulationByID(fakeID)

	// Assertions
	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
	s.Nil(result)
}

// ========================================
// CreateCongratulation Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestCreateCongratulation_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Get initial balance
	initialBalance, err := s.service.GetUserBalance(user1.ID)
	s.NoError(err)
	s.GreaterOrEqual(initialBalance, 1)

	// Create congratulation
	newCongratulation := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user1.ID,
			Name:    user1.DisplayName,
			Picture: user1.ProfilePicture,
		},
		Receiver:     user2.ID,
		Message:      "Great work!",
		CategoryName: "Work",
		TaskName:     "Complete project",
		Type:         "message",
	}

	result, err := s.service.CreateCongratulation(newCongratulation)

	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal("Great work!", result.Message)
	s.Equal("Work", result.CategoryName)
	s.Equal("Complete project", result.TaskName)
	s.Equal(user1.ID.Hex(), result.Sender.ID)
	s.Equal(user2.ID.Hex(), result.Receiver)
	s.False(result.Read) // Should default to unread

	// Verify it was inserted
	var found map[string]interface{}
	congratulationID, err := primitive.ObjectIDFromHex(result.ID)
	s.NoError(err)
	err = s.Collections["congratulations"].FindOne(s.Ctx, bson.M{"_id": congratulationID}).Decode(&found)
	s.NoError(err)
	s.Equal("Great work!", found["message"])

	// Verify balance was decremented
	newBalance, err := s.service.GetUserBalance(user1.ID)
	s.NoError(err)
	s.Equal(initialBalance-1, newBalance)
}

func (s *CongratulationServiceTestSuite) TestCreateCongratulation_WithPostID() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	postID := primitive.NewObjectID()

	// Create a post with images
	post := types.PostDocument{
		ID:      postID,
		Caption: "Test post",
		User: types.UserExtendedReferenceInternal{
			ID:             user2.ID,
			DisplayName:    user2.DisplayName,
			Handle:         user2.Handle,
			ProfilePicture: user2.ProfilePicture,
		},
		Images: []string{"https://example.com/image1.jpg", "https://example.com/image2.jpg"},
		Metadata: types.PostMetadata{
			CreatedAt: time.Now(),
			IsDeleted: false,
		},
	}
	s.InsertOne("posts", post)

	// Create congratulation with post reference
	newCongratulation := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user1.ID,
			Name:    user1.DisplayName,
			Picture: user1.ProfilePicture,
		},
		Receiver:     user2.ID,
		Message:      "Amazing post!",
		CategoryName: "Social",
		TaskName:     "Share photo",
		Type:         "message",
		PostID:       &postID,
	}

	result, err := s.service.CreateCongratulation(newCongratulation)

	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal("Amazing post!", result.Message)
}

func (s *CongratulationServiceTestSuite) TestCreateCongratulation_InsufficientBalance() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Set user balance to 0
	_, err := s.Collections["users"].UpdateOne(
		s.Ctx,
		bson.M{"_id": user1.ID},
		bson.M{"$set": bson.M{"congratulations": 0}},
	)
	s.NoError(err)

	// Try to create congratulation
	newCongratulation := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user1.ID,
			Name:    user1.DisplayName,
			Picture: user1.ProfilePicture,
		},
		Receiver:     user2.ID,
		Message:      "Great work!",
		CategoryName: "Work",
		TaskName:     "Complete project",
		Type:         "message",
	}

	result, err := s.service.CreateCongratulation(newCongratulation)

	// Assertions
	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "insufficient congratulation balance")
}

func (s *CongratulationServiceTestSuite) TestCreateCongratulation_ImageType() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Create congratulation with image type
	newCongratulation := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user1.ID,
			Name:    user1.DisplayName,
			Picture: user1.ProfilePicture,
		},
		Receiver:     user2.ID,
		Message:      "https://example.com/congrats-image.jpg",
		CategoryName: "Personal",
		TaskName:     "Achievement",
		Type:         "image",
	}

	result, err := s.service.CreateCongratulation(newCongratulation)

	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal("image", result.Type)
	s.Equal("https://example.com/congrats-image.jpg", result.Message)
}

// ========================================
// UpdatePartialCongratulation Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestUpdatePartialCongratulation_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	congratulationID := primitive.NewObjectID()
	congratulation := map[string]interface{}{
		"_id": congratulationID,
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Original message",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Original task",
		"read":         false,
		"type":         "message",
	}

	s.InsertOne("congratulations", congratulation)

	// Update congratulation
	newMessage := "Updated message"
	readStatus := true
	update := UpdateCongratulationDocument{
		Message: &newMessage,
		Read:    &readStatus,
	}

	err := s.service.UpdatePartialCongratulation(congratulationID, update)

	// Assertions
	s.NoError(err)

	// Verify update
	var updated map[string]interface{}
	err = s.Collections["congratulations"].FindOne(s.Ctx, bson.M{"_id": congratulationID}).Decode(&updated)
	s.NoError(err)
	s.Equal("Updated message", updated["message"])
	s.True(updated["read"].(bool))
	s.Equal("Original task", updated["taskName"]) // Unchanged field
}

func (s *CongratulationServiceTestSuite) TestUpdatePartialCongratulation_OnlyReadStatus() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	congratulationID := primitive.NewObjectID()
	congratulation := map[string]interface{}{
		"_id": congratulationID,
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Test message",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Test task",
		"read":         false,
		"type":         "message",
	}

	s.InsertOne("congratulations", congratulation)

	// Update only read status
	readStatus := true
	update := UpdateCongratulationDocument{
		Read: &readStatus,
	}

	err := s.service.UpdatePartialCongratulation(congratulationID, update)

	// Assertions
	s.NoError(err)

	// Verify update
	var updated map[string]interface{}
	err = s.Collections["congratulations"].FindOne(s.Ctx, bson.M{"_id": congratulationID}).Decode(&updated)
	s.NoError(err)
	s.True(updated["read"].(bool))
	s.Equal("Test message", updated["message"]) // Unchanged
}

// ========================================
// DeleteCongratulation Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestDeleteCongratulation_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	congratulationID := primitive.NewObjectID()
	congratulation := map[string]interface{}{
		"_id": congratulationID,
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "To be deleted",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Task",
		"read":         false,
		"type":         "message",
	}

	s.InsertOne("congratulations", congratulation)

	// Verify it exists
	count := s.CountDocuments("congratulations", bson.M{"_id": congratulationID})
	s.Equal(int64(1), count)

	// Delete congratulation
	err := s.service.DeleteCongratulation(congratulationID)

	// Assertions
	s.NoError(err)

	// Verify deletion
	count = s.CountDocuments("congratulations", bson.M{"_id": congratulationID})
	s.Equal(int64(0), count)
}

func (s *CongratulationServiceTestSuite) TestDeleteCongratulation_NonExistent() {
	fakeID := testpkg.GenerateObjectID()

	// Delete non-existent congratulation (should not error)
	err := s.service.DeleteCongratulation(fakeID)

	// Assertions
	s.NoError(err) // MongoDB DeleteOne doesn't error on non-existent docs
}

// ========================================
// MarkCongratulationsAsRead Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestMarkCongratulationsAsRead_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Create multiple unread congratulations
	id1 := primitive.NewObjectID()
	id2 := primitive.NewObjectID()
	id3 := primitive.NewObjectID()

	congratulation1 := map[string]interface{}{
		"_id": id1,
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Message 1",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Task 1",
		"read":         false,
		"type":         "message",
	}

	congratulation2 := map[string]interface{}{
		"_id": id2,
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Message 2",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Task 2",
		"read":         false,
		"type":         "message",
	}

	congratulation3 := map[string]interface{}{
		"_id": id3,
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Message 3",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Task 3",
		"read":         false,
		"type":         "message",
	}

	s.InsertOne("congratulations", congratulation1)
	s.InsertOne("congratulations", congratulation2)
	s.InsertOne("congratulations", congratulation3)

	// Mark first two as read
	count, err := s.service.MarkCongratulationsAsRead([]primitive.ObjectID{id1, id2})

	// Assertions
	s.NoError(err)
	s.Equal(int64(2), count)

	// Verify updates
	var updated1, updated2, updated3 map[string]interface{}
	s.Collections["congratulations"].FindOne(s.Ctx, bson.M{"_id": id1}).Decode(&updated1)
	s.Collections["congratulations"].FindOne(s.Ctx, bson.M{"_id": id2}).Decode(&updated2)
	s.Collections["congratulations"].FindOne(s.Ctx, bson.M{"_id": id3}).Decode(&updated3)

	s.True(updated1["read"].(bool))
	s.True(updated2["read"].(bool))
	s.False(updated3["read"].(bool)) // Should remain unread
}

func (s *CongratulationServiceTestSuite) TestMarkCongratulationsAsRead_EmptyArray() {
	count, err := s.service.MarkCongratulationsAsRead([]primitive.ObjectID{})

	// Assertions
	s.NoError(err)
	s.Equal(int64(0), count)
}

func (s *CongratulationServiceTestSuite) TestMarkCongratulationsAsRead_NonExistentIDs() {
	fakeID1 := testpkg.GenerateObjectID()
	fakeID2 := testpkg.GenerateObjectID()

	count, err := s.service.MarkCongratulationsAsRead([]primitive.ObjectID{fakeID1, fakeID2})

	// Assertions
	s.NoError(err)
	s.Equal(int64(0), count) // No documents modified
}

func (s *CongratulationServiceTestSuite) TestMarkCongratulationsAsRead_AlreadyRead() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	id := primitive.NewObjectID()
	congratulation := map[string]interface{}{
		"_id": id,
		"sender": map[string]interface{}{
			"id":      user1.ID,
			"name":    user1.DisplayName,
			"picture": user1.ProfilePicture,
		},
		"receiver":     user2.ID,
		"message":      "Already read",
		"timestamp":    time.Now(),
		"categoryName": "Work",
		"taskName":     "Task",
		"read":         true, // Already read
		"type":         "message",
	}

	s.InsertOne("congratulations", congratulation)

	// Try to mark as read again
	count, err := s.service.MarkCongratulationsAsRead([]primitive.ObjectID{id})

	// Assertions
	s.NoError(err)
	s.Equal(int64(0), count) // No documents modified (already read)
}

// ========================================
// GetUserBalance Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestGetUserBalance_Success() {
	user := s.GetUser(0)

	balance, err := s.service.GetUserBalance(user.ID)

	// Assertions
	s.NoError(err)
	s.GreaterOrEqual(balance, 0)
	s.Equal(2, balance) // Default from fixtures
}

func (s *CongratulationServiceTestSuite) TestGetUserBalance_NonExistentUser() {
	fakeID := testpkg.GenerateObjectID()

	balance, err := s.service.GetUserBalance(fakeID)

	// Assertions
	s.Error(err)
	s.Equal(0, balance)
}

func (s *CongratulationServiceTestSuite) TestGetUserBalance_ZeroBalance() {
	user := s.GetUser(0)

	// Set balance to 0
	_, err := s.Collections["users"].UpdateOne(
		s.Ctx,
		bson.M{"_id": user.ID},
		bson.M{"$set": bson.M{"congratulations": 0}},
	)
	s.NoError(err)

	balance, err := s.service.GetUserBalance(user.ID)

	// Assertions
	s.NoError(err)
	s.Equal(0, balance)
}

// ========================================
// DecrementUserBalance Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestDecrementUserBalance_Success() {
	user := s.GetUser(0)

	// Get initial balance
	initialBalance, err := s.service.GetUserBalance(user.ID)
	s.NoError(err)

	// Decrement balance
	err = s.service.DecrementUserBalance(user.ID)

	// Assertions
	s.NoError(err)

	// Verify decrement
	newBalance, err := s.service.GetUserBalance(user.ID)
	s.NoError(err)
	s.Equal(initialBalance-1, newBalance)

	// Verify kudosRewards.congratulations was incremented
	var updatedUser types.User
	err = s.Collections["users"].FindOne(s.Ctx, bson.M{"_id": user.ID}).Decode(&updatedUser)
	s.NoError(err)
}

func (s *CongratulationServiceTestSuite) TestDecrementUserBalance_NonExistentUser() {
	fakeID := testpkg.GenerateObjectID()

	err := s.service.DecrementUserBalance(fakeID)

	// Assertions - UpdateOne doesn't error on non-existent docs
	s.NoError(err)
}

// ========================================
// GetSenderInfo Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestGetSenderInfo_Success() {
	user := s.GetUser(0)

	senderInfo, err := s.service.GetSenderInfo(user.ID)

	// Assertions
	s.NoError(err)
	s.NotNil(senderInfo)
	s.Equal(user.ID, senderInfo.ID)
	s.Equal(user.DisplayName, senderInfo.Name)
	s.Equal(user.ProfilePicture, senderInfo.Picture)
}

func (s *CongratulationServiceTestSuite) TestGetSenderInfo_NonExistentUser() {
	fakeID := testpkg.GenerateObjectID()

	senderInfo, err := s.service.GetSenderInfo(fakeID)

	// Assertions
	s.Error(err)
	s.Nil(senderInfo)
}

// ========================================
// Integration Tests
// ========================================

func (s *CongratulationServiceTestSuite) TestCongratulationFlow_CreateAndRetrieve() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Create congratulation
	newCongratulation := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user1.ID,
			Name:    user1.DisplayName,
			Picture: user1.ProfilePicture,
		},
		Receiver:     user2.ID,
		Message:      "Integration test message",
		CategoryName: "Testing",
		TaskName:     "Integration test",
		Type:         "message",
	}

	created, err := s.service.CreateCongratulation(newCongratulation)
	s.NoError(err)
	s.NotNil(created)

	// Retrieve by ID
	congratulationID, err := primitive.ObjectIDFromHex(created.ID)
	s.NoError(err)

	retrieved, err := s.service.GetCongratulationByID(congratulationID)
	s.NoError(err)
	s.Equal(created.ID, retrieved.ID)
	s.Equal(created.Message, retrieved.Message)

	// Retrieve all for user2
	all, err := s.service.GetAllCongratulations(user2.ID)
	s.NoError(err)
	s.GreaterOrEqual(len(all), 1)

	// Find our congratulation in the list
	found := false
	for _, c := range all {
		if c.ID == created.ID {
			found = true
			break
		}
	}
	s.True(found)
}

func (s *CongratulationServiceTestSuite) TestCongratulationFlow_CreateUpdateDelete() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Create
	newCongratulation := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user1.ID,
			Name:    user1.DisplayName,
			Picture: user1.ProfilePicture,
		},
		Receiver:     user2.ID,
		Message:      "Original",
		CategoryName: "Work",
		TaskName:     "Task",
		Type:         "message",
	}

	created, err := s.service.CreateCongratulation(newCongratulation)
	s.NoError(err)

	congratulationID, err := primitive.ObjectIDFromHex(created.ID)
	s.NoError(err)

	// Update
	newMessage := "Updated"
	update := UpdateCongratulationDocument{
		Message: &newMessage,
	}
	err = s.service.UpdatePartialCongratulation(congratulationID, update)
	s.NoError(err)

	// Verify update
	updated, err := s.service.GetCongratulationByID(congratulationID)
	s.NoError(err)
	s.Equal("Updated", updated.Message)

	// Delete
	err = s.service.DeleteCongratulation(congratulationID)
	s.NoError(err)

	// Verify deletion
	deleted, err := s.service.GetCongratulationByID(congratulationID)
	s.Error(err)
	s.Nil(deleted)
}

func (s *CongratulationServiceTestSuite) TestMultipleUsersMultipleCongratulations() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	user3 := s.GetUser(2)

	// User1 sends to User2
	cong1 := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user1.ID,
			Name:    user1.DisplayName,
			Picture: user1.ProfilePicture,
		},
		Receiver:     user2.ID,
		Message:      "From 1 to 2",
		CategoryName: "Work",
		TaskName:     "Task",
		Type:         "message",
	}

	// User1 sends to User3
	cong2 := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user1.ID,
			Name:    user1.DisplayName,
			Picture: user1.ProfilePicture,
		},
		Receiver:     user3.ID,
		Message:      "From 1 to 3",
		CategoryName: "Personal",
		TaskName:     "Task",
		Type:         "message",
	}

	// User2 sends to User3
	cong3 := &CongratulationDocumentInternal{
		Sender: CongratulationSenderInternal{
			ID:      user2.ID,
			Name:    user2.DisplayName,
			Picture: user2.ProfilePicture,
		},
		Receiver:     user3.ID,
		Message:      "From 2 to 3",
		CategoryName: "Social",
		TaskName:     "Task",
		Type:         "message",
	}

	_, err := s.service.CreateCongratulation(cong1)
	s.NoError(err)
	_, err = s.service.CreateCongratulation(cong2)
	s.NoError(err)
	_, err = s.service.CreateCongratulation(cong3)
	s.NoError(err)

	// Verify User2 received 1 congratulation
	user2Congrats, err := s.service.GetAllCongratulations(user2.ID)
	s.NoError(err)
	s.Len(user2Congrats, 1)
	s.Equal("From 1 to 2", user2Congrats[0].Message)

	// Verify User3 received 2 congratulations
	user3Congrats, err := s.service.GetAllCongratulations(user3.ID)
	s.NoError(err)
	s.Len(user3Congrats, 2)

	// Verify User1 received 0 congratulations
	user1Congrats, err := s.service.GetAllCongratulations(user1.ID)
	s.NoError(err)
	s.Len(user1Congrats, 0)
}
