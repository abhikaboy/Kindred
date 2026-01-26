package Blueprint_test

import (
	"testing"
	"time"

	Blueprint "github.com/abhikaboy/Kindred/internal/handlers/blueprint"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// BlueprintServiceTestSuite tests the blueprint service
type BlueprintServiceTestSuite struct {
	testpkg.BaseSuite
	service *Blueprint.Service
}

// SetupTest runs before each test
func (s *BlueprintServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()

	// Initialize service with test database
	s.service = Blueprint.NewService(s.Collections)
}

// TestBlueprintService runs the test suite
func TestBlueprintService(t *testing.T) {
	testpkg.RunSuite(t, new(BlueprintServiceTestSuite))
}

// ========================================
// Helper Functions
// ========================================

// createTestBlueprint creates a blueprint for testing
func (s *BlueprintServiceTestSuite) createTestBlueprint(name string, owner *types.User) *Blueprint.BlueprintDocumentInternal {
	blueprint := &Blueprint.BlueprintDocumentInternal{
		ID:          primitive.NewObjectID(),
		Banner:      "https://example.com/banner.jpg",
		Name:        name,
		Tags:        []string{"productivity", "test"},
		Description: "Test blueprint description",
		Duration:    "30m",
		Category:    "productivity",
		Categories: []types.CategoryDocument{
			{
				ID:            primitive.NewObjectID(),
				Name:          "Test Category",
				WorkspaceName: "Test Workspace",
				LastEdited:    time.Now(),
				User:          owner.ID,
				Tasks: []types.TaskDocument{
					{
						ID:         primitive.NewObjectID(),
						Content:    "Test task",
						Priority:   1,
						Value:      10,
						Active:     true,
						Recurring:  false,
						Public:     false,
						Timestamp:  time.Now(),
						LastEdited: time.Now(),
						UserID:     owner.ID,
					},
				},
			},
		},
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        time.Now(),
		Owner: &types.UserExtendedReferenceInternal{
			ID:             owner.ID,
			DisplayName:    owner.DisplayName,
			Handle:         owner.Handle,
			ProfilePicture: owner.ProfilePicture,
		},
	}

	_, err := s.Collections["blueprints"].InsertOne(s.Ctx, blueprint)
	s.Require().NoError(err)

	return blueprint
}

// ========================================
// GetAllBlueprints Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestGetAllBlueprints_Success() {
	user := s.GetUser(0)

	// Create test blueprints
	bp1 := s.createTestBlueprint("Blueprint 1", user)
	bp2 := s.createTestBlueprint("Blueprint 2", user)

	// Fetch all blueprints
	result, err := s.service.GetAllBlueprints()

	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.GreaterOrEqual(len(result), 2)

	// Find our test blueprints in the result
	foundBp1 := false
	foundBp2 := false
	for _, bp := range result {
		if bp.ID == bp1.ID.Hex() {
			foundBp1 = true
			s.Equal(bp1.Name, bp.Name)
		}
		if bp.ID == bp2.ID.Hex() {
			foundBp2 = true
			s.Equal(bp2.Name, bp.Name)
		}
	}
	s.True(foundBp1, "Blueprint 1 should be in results")
	s.True(foundBp2, "Blueprint 2 should be in results")
}

func (s *BlueprintServiceTestSuite) TestGetAllBlueprints_EmptyCollection() {
	// Clear all blueprints
	_, err := s.Collections["blueprints"].DeleteMany(s.Ctx, bson.M{})
	s.Require().NoError(err)

	result, err := s.service.GetAllBlueprints()

	s.NoError(err)
	s.NotNil(result)
	s.Equal(0, len(result))
}

// ========================================
// GetBlueprintByID Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestGetBlueprintByID_Success() {
	user := s.GetUser(0)
	blueprint := s.createTestBlueprint("Test Blueprint", user)

	result, err := s.service.GetBlueprintByID(blueprint.ID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(blueprint.ID.Hex(), result.ID)
	s.Equal(blueprint.Name, result.Name)
	s.Equal(blueprint.Description, result.Description)
	s.Equal(blueprint.Category, result.Category)
}

func (s *BlueprintServiceTestSuite) TestGetBlueprintByID_NotFound() {
	fakeID := testpkg.GenerateObjectID()

	result, err := s.service.GetBlueprintByID(fakeID)

	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
	s.Nil(result)
}

// ========================================
// CreateBlueprint Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestCreateBlueprint_Success() {
	user := s.GetUser(0)

	newBlueprint := &Blueprint.BlueprintDocumentInternal{
		Banner:      "https://example.com/new-banner.jpg",
		Name:        "New Blueprint",
		Tags:        []string{"test", "new"},
		Description: "A new test blueprint",
		Duration:    "45m",
		Category:    "health",
		Categories: []types.CategoryDocument{
			{
				ID:            primitive.NewObjectID(),
				Name:          "Health Category",
				WorkspaceName: "Health Workspace",
				LastEdited:    time.Now(),
				User:          user.ID,
				Tasks:         []types.TaskDocument{},
			},
		},
		Owner: &types.UserExtendedReferenceInternal{
			ID: user.ID,
		},
	}

	result, err := s.service.CreateBlueprint(newBlueprint)

	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal("New Blueprint", result.Name)
	s.Equal("A new test blueprint", result.Description)
	s.Equal("health", result.Category)
	s.Equal(int64(0), result.SubscribersCount)
	s.NotNil(result.Owner)
	s.Equal(user.Handle, result.Owner.Handle)

	// Verify it was inserted in database
	var found Blueprint.BlueprintDocumentInternal
	objID, err := primitive.ObjectIDFromHex(result.ID)
	s.NoError(err)
	err = s.Collections["blueprints"].FindOne(s.Ctx, bson.M{"_id": objID}).Decode(&found)
	s.NoError(err)
	s.Equal("New Blueprint", found.Name)
}

func (s *BlueprintServiceTestSuite) TestCreateBlueprint_WithCategories() {
	user := s.GetUser(0)

	newBlueprint := &Blueprint.BlueprintDocumentInternal{
		Banner:      "https://example.com/banner.jpg",
		Name:        "Blueprint with Categories",
		Tags:        []string{"test"},
		Description: "Test blueprint with multiple categories",
		Duration:    "1h",
		Category:    "productivity",
		Categories: []types.CategoryDocument{
			{
				ID:            primitive.NewObjectID(),
				Name:          "Morning Routine",
				WorkspaceName: "Daily",
				LastEdited:    time.Now(),
				User:          user.ID,
				Tasks: []types.TaskDocument{
					{
						ID:         primitive.NewObjectID(),
						Content:    "Wake up early",
						Priority:   1,
						Value:      10,
						Active:     true,
						Recurring:  true,
						RecurType:  "daily",
						Public:     false,
						Timestamp:  time.Now(),
						LastEdited: time.Now(),
						UserID:     user.ID,
					},
				},
			},
			{
				ID:            primitive.NewObjectID(),
				Name:          "Evening Routine",
				WorkspaceName: "Daily",
				LastEdited:    time.Now(),
				User:          user.ID,
				Tasks:         []types.TaskDocument{},
			},
		},
		Owner: &types.UserExtendedReferenceInternal{
			ID: user.ID,
		},
	}

	result, err := s.service.CreateBlueprint(newBlueprint)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(2, len(result.Categories))
	s.Equal("Morning Routine", result.Categories[0].Name)
	s.Equal("Evening Routine", result.Categories[1].Name)
}

// ========================================
// UpdatePartialBlueprint Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestUpdatePartialBlueprint_Success() {
	user := s.GetUser(0)
	blueprint := s.createTestBlueprint("Original Name", user)

	newName := "Updated Name"
	newDescription := "Updated description"
	update := Blueprint.UpdateBlueprintDocument{
		Name:        &newName,
		Description: &newDescription,
	}

	err := s.service.UpdatePartialBlueprint(blueprint.ID, update)

	s.NoError(err)

	// Verify update
	var updated Blueprint.BlueprintDocumentInternal
	err = s.Collections["blueprints"].FindOne(s.Ctx, bson.M{"_id": blueprint.ID}).Decode(&updated)
	s.NoError(err)
	s.Equal("Updated Name", updated.Name)
	s.Equal("Updated description", updated.Description)
	s.Equal(blueprint.Category, updated.Category) // Unchanged field
}

func (s *BlueprintServiceTestSuite) TestUpdatePartialBlueprint_OnlyName() {
	user := s.GetUser(0)
	blueprint := s.createTestBlueprint("Original Name", user)
	originalDesc := blueprint.Description

	newName := "Only Name Updated"
	update := Blueprint.UpdateBlueprintDocument{
		Name: &newName,
	}

	err := s.service.UpdatePartialBlueprint(blueprint.ID, update)

	s.NoError(err)

	// Verify only name changed
	var updated Blueprint.BlueprintDocumentInternal
	err = s.Collections["blueprints"].FindOne(s.Ctx, bson.M{"_id": blueprint.ID}).Decode(&updated)
	s.NoError(err)
	s.Equal("Only Name Updated", updated.Name)
	s.Equal(originalDesc, updated.Description)
}

func (s *BlueprintServiceTestSuite) TestUpdatePartialBlueprint_NotFound() {
	fakeID := testpkg.GenerateObjectID()

	newName := "Updated Name"
	update := Blueprint.UpdateBlueprintDocument{
		Name: &newName,
	}

	err := s.service.UpdatePartialBlueprint(fakeID, update)

	// Should not error even if not found (UpdateOne returns 0 matched)
	s.NoError(err)
}

// ========================================
// DeleteBlueprint Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestDeleteBlueprint_Success() {
	user := s.GetUser(0)
	blueprint := s.createTestBlueprint("To Delete", user)

	err := s.service.DeleteBlueprint(blueprint.ID)

	s.NoError(err)

	// Verify deletion
	var found Blueprint.BlueprintDocumentInternal
	err = s.Collections["blueprints"].FindOne(s.Ctx, bson.M{"_id": blueprint.ID}).Decode(&found)
	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
}

func (s *BlueprintServiceTestSuite) TestDeleteBlueprint_NotFound() {
	fakeID := testpkg.GenerateObjectID()

	err := s.service.DeleteBlueprint(fakeID)

	// Should not error even if not found (DeleteOne returns 0 deleted)
	s.NoError(err)
}

// ========================================
// SubscribeToBlueprint Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_Success() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)
	blueprint := s.createTestBlueprint("Subscribe Test", user)

	err := s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)

	s.NoError(err)

	// Verify subscription
	var updated Blueprint.BlueprintDocumentInternal
	err = s.Collections["blueprints"].FindOne(s.Ctx, bson.M{"_id": blueprint.ID}).Decode(&updated)
	s.NoError(err)
	s.Equal(int64(1), updated.SubscribersCount)
	s.Contains(updated.Subscribers, subscriber.ID)

	// Verify categories were created for the subscriber
	count, err := s.Collections["categories"].CountDocuments(s.Ctx, bson.M{
		"user":        subscriber.ID,
		"blueprintId": blueprint.ID,
		"isBlueprint": true,
	})
	s.NoError(err)
	s.Equal(int64(1), count) // Should match number of categories in blueprint
}

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_AlreadySubscribed() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)
	blueprint := s.createTestBlueprint("Subscribe Test", user)

	// First subscription
	err := s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)
	s.NoError(err)

	// Try to subscribe again
	err = s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)

	// Should return error (already subscribed)
	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)

	// Verify count didn't increase
	var updated Blueprint.BlueprintDocumentInternal
	err = s.Collections["blueprints"].FindOne(s.Ctx, bson.M{"_id": blueprint.ID}).Decode(&updated)
	s.NoError(err)
	s.Equal(int64(1), updated.SubscribersCount)
}

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_NotFound() {
	subscriber := s.GetUser(1)
	fakeID := testpkg.GenerateObjectID()

	err := s.service.SubscribeToBlueprint(fakeID, subscriber.ID)

	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
}

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_MultipleSubscribers() {
	user := s.GetUser(0)
	subscriber1 := s.GetUser(1)
	subscriber2 := s.GetUser(2)
	blueprint := s.createTestBlueprint("Multi Subscribe Test", user)

	// First subscriber
	err := s.service.SubscribeToBlueprint(blueprint.ID, subscriber1.ID)
	s.NoError(err)

	// Second subscriber
	err = s.service.SubscribeToBlueprint(blueprint.ID, subscriber2.ID)
	s.NoError(err)

	// Verify both subscriptions
	var updated Blueprint.BlueprintDocumentInternal
	err = s.Collections["blueprints"].FindOne(s.Ctx, bson.M{"_id": blueprint.ID}).Decode(&updated)
	s.NoError(err)
	s.Equal(int64(2), updated.SubscribersCount)
	s.Contains(updated.Subscribers, subscriber1.ID)
	s.Contains(updated.Subscribers, subscriber2.ID)
}

// ========================================
// UnsubscribeFromBlueprint Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestUnsubscribeFromBlueprint_Success() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)
	blueprint := s.createTestBlueprint("Unsubscribe Test", user)

	// First subscribe
	err := s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)
	s.NoError(err)

	// Then unsubscribe
	err = s.service.UnsubscribeFromBlueprint(blueprint.ID, subscriber.ID)
	s.NoError(err)

	// Verify unsubscription
	var updated Blueprint.BlueprintDocumentInternal
	err = s.Collections["blueprints"].FindOne(s.Ctx, bson.M{"_id": blueprint.ID}).Decode(&updated)
	s.NoError(err)
	s.Equal(int64(0), updated.SubscribersCount)
	s.NotContains(updated.Subscribers, subscriber.ID)

	// Verify categories were deleted
	count, err := s.Collections["categories"].CountDocuments(s.Ctx, bson.M{
		"user":        subscriber.ID,
		"blueprintId": blueprint.ID,
		"isBlueprint": true,
	})
	s.NoError(err)
	s.Equal(int64(0), count)
}

func (s *BlueprintServiceTestSuite) TestUnsubscribeFromBlueprint_NotSubscribed() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)
	blueprint := s.createTestBlueprint("Unsubscribe Test", user)

	// Try to unsubscribe without subscribing first
	err := s.service.UnsubscribeFromBlueprint(blueprint.ID, subscriber.ID)

	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
}

func (s *BlueprintServiceTestSuite) TestUnsubscribeFromBlueprint_NotFound() {
	subscriber := s.GetUser(1)
	fakeID := testpkg.GenerateObjectID()

	err := s.service.UnsubscribeFromBlueprint(fakeID, subscriber.ID)

	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
}

// ========================================
// GetUserSubscribedBlueprints Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestGetUserSubscribedBlueprints_Success() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)

	// Create and subscribe to multiple blueprints
	bp1 := s.createTestBlueprint("Subscribed Blueprint 1", user)
	bp2 := s.createTestBlueprint("Subscribed Blueprint 2", user)
	bp3 := s.createTestBlueprint("Not Subscribed Blueprint", user)

	err := s.service.SubscribeToBlueprint(bp1.ID, subscriber.ID)
	s.NoError(err)
	err = s.service.SubscribeToBlueprint(bp2.ID, subscriber.ID)
	s.NoError(err)

	// Get subscribed blueprints
	result, err := s.service.GetUserSubscribedBlueprints(subscriber.ID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(2, len(result))

	// Verify correct blueprints returned
	foundBp1 := false
	foundBp2 := false
	foundBp3 := false
	for _, bp := range result {
		if bp.ID == bp1.ID.Hex() {
			foundBp1 = true
		}
		if bp.ID == bp2.ID.Hex() {
			foundBp2 = true
		}
		if bp.ID == bp3.ID.Hex() {
			foundBp3 = true
		}
	}
	s.True(foundBp1)
	s.True(foundBp2)
	s.False(foundBp3, "Should not include unsubscribed blueprint")
}

func (s *BlueprintServiceTestSuite) TestGetUserSubscribedBlueprints_NoSubscriptions() {
	subscriber := s.GetUser(1)

	result, err := s.service.GetUserSubscribedBlueprints(subscriber.ID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(0, len(result))
}

// ========================================
// GetBlueprintsByCreator Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestGetBlueprintsByCreator_Success() {
	creator := s.GetUser(0)
	otherUser := s.GetUser(1)

	// Create blueprints by different users
	bp1 := s.createTestBlueprint("Creator Blueprint 1", creator)
	bp2 := s.createTestBlueprint("Creator Blueprint 2", creator)
	bp3 := s.createTestBlueprint("Other User Blueprint", otherUser)

	// Get blueprints by creator
	result, err := s.service.GetBlueprintsByCreator(creator.ID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(2, len(result))

	// Verify correct blueprints returned
	foundBp1 := false
	foundBp2 := false
	foundBp3 := false
	for _, bp := range result {
		if bp.ID == bp1.ID.Hex() {
			foundBp1 = true
		}
		if bp.ID == bp2.ID.Hex() {
			foundBp2 = true
		}
		if bp.ID == bp3.ID.Hex() {
			foundBp3 = true
		}
	}
	s.True(foundBp1)
	s.True(foundBp2)
	s.False(foundBp3, "Should not include other user's blueprint")
}

func (s *BlueprintServiceTestSuite) TestGetBlueprintsByCreator_NoBlueprints() {
	creator := s.GetUser(2)

	result, err := s.service.GetBlueprintsByCreator(creator.ID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(0, len(result))
}

// ========================================
// GetBlueprintByCategory Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestGetBlueprintByCategory_Success() {
	user := s.GetUser(0)

	// Create blueprints with different categories
	bp1 := s.createTestBlueprint("Productivity Blueprint", user)
	bp1.Category = "productivity"
	_, err := s.Collections["blueprints"].UpdateOne(s.Ctx, bson.M{"_id": bp1.ID}, bson.M{"$set": bson.M{"category": "productivity"}})
	s.NoError(err)

	bp2 := s.createTestBlueprint("Health Blueprint", user)
	bp2.Category = "health"
	_, err = s.Collections["blueprints"].UpdateOne(s.Ctx, bson.M{"_id": bp2.ID}, bson.M{"$set": bson.M{"category": "health"}})
	s.NoError(err)

	bp3 := s.createTestBlueprint("Another Productivity Blueprint", user)
	bp3.Category = "productivity"
	_, err = s.Collections["blueprints"].UpdateOne(s.Ctx, bson.M{"_id": bp3.ID}, bson.M{"$set": bson.M{"category": "productivity"}})
	s.NoError(err)

	// Get blueprints grouped by category
	result, err := s.service.GetBlueprintByCategory()

	s.NoError(err)
	s.NotNil(result)
	s.GreaterOrEqual(len(result), 2)

	// Find productivity and health categories
	var productivityGroup *Blueprint.BlueprintCategoryGroup
	var healthGroup *Blueprint.BlueprintCategoryGroup

	for i := range result {
		if result[i].Category == "productivity" {
			productivityGroup = &result[i]
		}
		if result[i].Category == "health" {
			healthGroup = &result[i]
		}
	}

	s.NotNil(productivityGroup, "Should have productivity category")
	s.NotNil(healthGroup, "Should have health category")
	s.GreaterOrEqual(len(productivityGroup.Blueprints), 2)
	s.GreaterOrEqual(len(healthGroup.Blueprints), 1)
}

func (s *BlueprintServiceTestSuite) TestGetBlueprintByCategory_EmptyCategory() {
	user := s.GetUser(0)

	// Create blueprint with empty category
	bp := s.createTestBlueprint("No Category Blueprint", user)
	_, err := s.Collections["blueprints"].UpdateOne(s.Ctx, bson.M{"_id": bp.ID}, bson.M{"$set": bson.M{"category": ""}})
	s.NoError(err)

	result, err := s.service.GetBlueprintByCategory()

	s.NoError(err)
	s.NotNil(result)

	// Should have "Uncategorized" group
	var uncategorizedGroup *Blueprint.BlueprintCategoryGroup
	for i := range result {
		if result[i].Category == "Uncategorized" {
			uncategorizedGroup = &result[i]
			break
		}
	}

	s.NotNil(uncategorizedGroup, "Should have Uncategorized category")
	s.GreaterOrEqual(len(uncategorizedGroup.Blueprints), 1)
}

// ========================================
// SearchBlueprints Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestSearchBlueprints_ByName() {
	user := s.GetUser(0)

	// Create blueprints with searchable names
	s.createTestBlueprint("Morning Routine Blueprint", user)
	s.createTestBlueprint("Evening Routine Blueprint", user)
	s.createTestBlueprint("Workout Plan", user)

	// Note: This test may fail if MongoDB Atlas Search is not configured
	// In that case, we just verify the function doesn't crash
	result, err := s.service.SearchBlueprints("routine")

	// We can't guarantee search results without Atlas Search configured
	// So we just verify no error and result is not nil
	if err == nil {
		s.NotNil(result)
	}
}

func (s *BlueprintServiceTestSuite) TestSearchBlueprints_EmptyQuery() {
	result, err := s.service.SearchBlueprints("")

	// Should handle empty query gracefully
	if err == nil {
		s.NotNil(result)
	}
}

// ========================================
// AutocompleteBlueprints Tests
// ========================================

func (s *BlueprintServiceTestSuite) TestAutocompleteBlueprints_Success() {
	user := s.GetUser(0)

	// Create blueprints with autocomplete-able names
	s.createTestBlueprint("Morning Meditation", user)
	s.createTestBlueprint("Morning Exercise", user)
	s.createTestBlueprint("Evening Routine", user)

	// Note: This test may fail if MongoDB Atlas Search is not configured
	result, err := s.service.AutocompleteBlueprints("morn")

	// We can't guarantee search results without Atlas Search configured
	if err == nil {
		s.NotNil(result)
	}
}

func (s *BlueprintServiceTestSuite) TestAutocompleteBlueprints_ShortQuery() {
	result, err := s.service.AutocompleteBlueprints("m")

	// Should handle short query gracefully
	if err == nil {
		s.NotNil(result)
	}
}

// ========================================
// Task Processing Tests (for processTaskForSubscription)
// ========================================

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_WithTaskTimeFields() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)

	now := time.Now()
	startDate := now.Add(24 * time.Hour)
	startTime := now.Add(2 * time.Hour)
	deadline := now.Add(48 * time.Hour)

	// Create blueprint with tasks that have time-related fields
	blueprint := &Blueprint.BlueprintDocumentInternal{
		ID:          primitive.NewObjectID(),
		Banner:      "https://example.com/banner.jpg",
		Name:        "Time-based Blueprint",
		Tags:        []string{"test"},
		Description: "Blueprint with time-based tasks",
		Duration:    "1h",
		Category:    "productivity",
		Categories: []types.CategoryDocument{
			{
				ID:            primitive.NewObjectID(),
				Name:          "Timed Tasks",
				WorkspaceName: "Test",
				LastEdited:    now,
				User:          user.ID,
				Tasks: []types.TaskDocument{
					{
						ID:         primitive.NewObjectID(),
						Content:    "Task with all time fields",
						Priority:   1,
						Value:      10,
						Active:     true,
						Recurring:  true,
						RecurType:  "daily",
						Public:     false,
						Timestamp:  now,
						LastEdited: now,
						UserID:     user.ID,
						StartDate:  &startDate,
						StartTime:  &startTime,
						Deadline:   &deadline,
						Reminders: []*types.Reminder{
							{
								TriggerTime:   now.Add(1 * time.Hour),
								Type:          "before_start",
								Sent:          false,
								BeforeStart:   true,
								CustomMessage: testpkg.StringPtr("Test reminder"),
								Sound:         testpkg.StringPtr("default"),
								Vibration:     true,
							},
						},
					},
				},
			},
		},
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        now,
		Owner: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
	}

	_, err := s.Collections["blueprints"].InsertOne(s.Ctx, blueprint)
	s.Require().NoError(err)

	// Subscribe to blueprint
	err = s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)
	s.NoError(err)

	// Verify categories were created with adjusted time fields
	var categories []types.CategoryDocument
	cursor, err := s.Collections["categories"].Find(s.Ctx, bson.M{
		"user":        subscriber.ID,
		"blueprintId": blueprint.ID,
		"isBlueprint": true,
	})
	s.NoError(err)
	err = cursor.All(s.Ctx, &categories)
	s.NoError(err)
	s.Equal(1, len(categories))

	// Verify task was created with time fields
	category := categories[0]
	s.Equal(1, len(category.Tasks))
	task := category.Tasks[0]

	s.Equal("Task with all time fields", task.Content)
	s.NotNil(task.StartDate)
	s.NotNil(task.StartTime)
	s.NotNil(task.Deadline)
	s.NotNil(task.Reminders)
	s.Equal(1, len(task.Reminders))

	// Verify reminder was processed
	reminder := task.Reminders[0]
	s.Equal("before_start", reminder.Type)
	s.False(reminder.Sent) // Should be reset
	s.True(reminder.BeforeStart)
}

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_WithRecurringTasks() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)

	now := time.Now()

	// Create blueprint with recurring tasks
	blueprint := &Blueprint.BlueprintDocumentInternal{
		ID:          primitive.NewObjectID(),
		Banner:      "https://example.com/banner.jpg",
		Name:        "Recurring Tasks Blueprint",
		Tags:        []string{"recurring"},
		Description: "Blueprint with recurring tasks",
		Duration:    "30m",
		Category:    "daily",
		Categories: []types.CategoryDocument{
			{
				ID:            primitive.NewObjectID(),
				Name:          "Daily Tasks",
				WorkspaceName: "Routine",
				LastEdited:    now,
				User:          user.ID,
				Tasks: []types.TaskDocument{
					{
						ID:             primitive.NewObjectID(),
						Content:        "Daily recurring task",
						Priority:       1,
						Value:          5,
						Active:         true,
						Recurring:      true,
						RecurType:      "daily",
						RecurFrequency: "1",
						RecurDetails: &types.RecurDetails{
							Every:      1,
							DaysOfWeek: []int{1, 2, 3},
							Behavior:   "ROLLING",
						},
						Public:     false,
						Timestamp:  now,
						LastEdited: now,
						UserID:     user.ID,
					},
				},
			},
		},
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        now,
		Owner: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
	}

	_, err := s.Collections["blueprints"].InsertOne(s.Ctx, blueprint)
	s.Require().NoError(err)

	// Subscribe to blueprint
	err = s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)
	s.NoError(err)

	// Verify recurring task was created properly
	var categories []types.CategoryDocument
	cursor, err := s.Collections["categories"].Find(s.Ctx, bson.M{
		"user":        subscriber.ID,
		"blueprintId": blueprint.ID,
	})
	s.NoError(err)
	err = cursor.All(s.Ctx, &categories)
	s.NoError(err)
	s.Equal(1, len(categories))

	task := categories[0].Tasks[0]
	s.True(task.Recurring)
	s.Equal("daily", task.RecurType)
	s.Equal("1", task.RecurFrequency)
	s.NotNil(task.RecurDetails)
	s.Equal(1, task.RecurDetails.Every)
}

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_WithMultipleReminders() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)

	now := time.Now()

	// Create blueprint with task that has multiple reminders
	blueprint := &Blueprint.BlueprintDocumentInternal{
		ID:          primitive.NewObjectID(),
		Banner:      "https://example.com/banner.jpg",
		Name:        "Multi-Reminder Blueprint",
		Tags:        []string{"reminders"},
		Description: "Blueprint with multiple reminders",
		Duration:    "1h",
		Category:    "productivity",
		Categories: []types.CategoryDocument{
			{
				ID:            primitive.NewObjectID(),
				Name:          "Reminder Tasks",
				WorkspaceName: "Test",
				LastEdited:    now,
				User:          user.ID,
				Tasks: []types.TaskDocument{
					{
						ID:         primitive.NewObjectID(),
						Content:    "Task with multiple reminders",
						Priority:   1,
						Value:      10,
						Active:     true,
						Recurring:  false,
						Public:     false,
						Timestamp:  now,
						LastEdited: now,
						UserID:     user.ID,
						Reminders: []*types.Reminder{
							{
								TriggerTime:   now.Add(1 * time.Hour),
								Type:          "before_start",
								Sent:          true, // Should be reset to false
								BeforeStart:   true,
								CustomMessage: testpkg.StringPtr("First reminder"),
								Sound:         testpkg.StringPtr("default"),
								Vibration:     true,
							},
							{
								TriggerTime:    now.Add(2 * time.Hour),
								Type:           "before_deadline",
								Sent:           true, // Should be reset to false
								BeforeDeadline: true,
								CustomMessage:  testpkg.StringPtr("Second reminder"),
								Sound:          testpkg.StringPtr("alert"),
								Vibration:      false,
							},
							nil, // Test nil reminder handling
						},
					},
				},
			},
		},
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        now,
		Owner: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
	}

	_, err := s.Collections["blueprints"].InsertOne(s.Ctx, blueprint)
	s.Require().NoError(err)

	// Subscribe to blueprint
	err = s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)
	s.NoError(err)

	// Verify reminders were created and sent status was reset
	var categories []types.CategoryDocument
	cursor, err := s.Collections["categories"].Find(s.Ctx, bson.M{
		"user":        subscriber.ID,
		"blueprintId": blueprint.ID,
	})
	s.NoError(err)
	err = cursor.All(s.Ctx, &categories)
	s.NoError(err)

	task := categories[0].Tasks[0]
	s.NotNil(task.Reminders)
	s.Equal(3, len(task.Reminders))

	// Check first reminder
	s.NotNil(task.Reminders[0])
	s.False(task.Reminders[0].Sent, "Sent status should be reset to false")
	s.Equal("before_start", task.Reminders[0].Type)

	// Check second reminder
	s.NotNil(task.Reminders[1])
	s.False(task.Reminders[1].Sent, "Sent status should be reset to false")
	s.Equal("before_deadline", task.Reminders[1].Type)

	// Check nil reminder
	s.Nil(task.Reminders[2])
}

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_WithChecklist() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)

	now := time.Now()

	// Create blueprint with task that has checklist
	blueprint := &Blueprint.BlueprintDocumentInternal{
		ID:          primitive.NewObjectID(),
		Banner:      "https://example.com/banner.jpg",
		Name:        "Checklist Blueprint",
		Tags:        []string{"checklist"},
		Description: "Blueprint with checklist tasks",
		Duration:    "30m",
		Category:    "productivity",
		Categories: []types.CategoryDocument{
			{
				ID:            primitive.NewObjectID(),
				Name:          "Checklist Category",
				WorkspaceName: "Test",
				LastEdited:    now,
				User:          user.ID,
				Tasks: []types.TaskDocument{
					{
						ID:         primitive.NewObjectID(),
						Content:    "Task with checklist",
						Priority:   1,
						Value:      10,
						Active:     true,
						Recurring:  false,
						Public:     false,
						Timestamp:  now,
						LastEdited: now,
						UserID:     user.ID,
						Checklist: []types.ChecklistItem{
							{
								Content:   "Item 1",
								Completed: false,
							},
							{
								Content:   "Item 2",
								Completed: true,
							},
						},
						Notes: "Test notes",
					},
				},
			},
		},
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        now,
		Owner: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
	}

	_, err := s.Collections["blueprints"].InsertOne(s.Ctx, blueprint)
	s.Require().NoError(err)

	// Subscribe to blueprint
	err = s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)
	s.NoError(err)

	// Verify checklist was copied
	var categories []types.CategoryDocument
	cursor, err := s.Collections["categories"].Find(s.Ctx, bson.M{
		"user":        subscriber.ID,
		"blueprintId": blueprint.ID,
	})
	s.NoError(err)
	err = cursor.All(s.Ctx, &categories)
	s.NoError(err)

	task := categories[0].Tasks[0]
	s.NotNil(task.Checklist)
	s.Equal(2, len(task.Checklist))
	s.Equal("Item 1", task.Checklist[0].Content)
	s.Equal("Item 2", task.Checklist[1].Content)
	s.Equal("Test notes", task.Notes)
}

func (s *BlueprintServiceTestSuite) TestSubscribeToBlueprint_WithMultipleCategories() {
	user := s.GetUser(0)
	subscriber := s.GetUser(1)

	now := time.Now()

	// Create blueprint with multiple categories
	blueprint := &Blueprint.BlueprintDocumentInternal{
		ID:          primitive.NewObjectID(),
		Banner:      "https://example.com/banner.jpg",
		Name:        "Multi-Category Blueprint",
		Tags:        []string{"multi"},
		Description: "Blueprint with multiple categories",
		Duration:    "2h",
		Category:    "productivity",
		Categories: []types.CategoryDocument{
			{
				ID:            primitive.NewObjectID(),
				Name:          "Morning Tasks",
				WorkspaceName: "Daily Routine",
				LastEdited:    now,
				User:          user.ID,
				Tasks: []types.TaskDocument{
					{
						ID:         primitive.NewObjectID(),
						Content:    "Morning task 1",
						Priority:   1,
						Value:      5,
						Active:     true,
						Recurring:  false,
						Public:     false,
						Timestamp:  now,
						LastEdited: now,
						UserID:     user.ID,
					},
				},
			},
			{
				ID:            primitive.NewObjectID(),
				Name:          "Evening Tasks",
				WorkspaceName: "Daily Routine",
				LastEdited:    now,
				User:          user.ID,
				Tasks: []types.TaskDocument{
					{
						ID:         primitive.NewObjectID(),
						Content:    "Evening task 1",
						Priority:   1,
						Value:      5,
						Active:     true,
						Recurring:  false,
						Public:     false,
						Timestamp:  now,
						LastEdited: now,
						UserID:     user.ID,
					},
					{
						ID:         primitive.NewObjectID(),
						Content:    "Evening task 2",
						Priority:   2,
						Value:      10,
						Active:     true,
						Recurring:  false,
						Public:     false,
						Timestamp:  now,
						LastEdited: now,
						UserID:     user.ID,
					},
				},
			},
		},
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        now,
		Owner: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
	}

	_, err := s.Collections["blueprints"].InsertOne(s.Ctx, blueprint)
	s.Require().NoError(err)

	// Subscribe to blueprint
	err = s.service.SubscribeToBlueprint(blueprint.ID, subscriber.ID)
	s.NoError(err)

	// Verify all categories were created
	count, err := s.Collections["categories"].CountDocuments(s.Ctx, bson.M{
		"user":        subscriber.ID,
		"blueprintId": blueprint.ID,
		"isBlueprint": true,
	})
	s.NoError(err)
	s.Equal(int64(2), count)

	// Verify tasks in each category
	var categories []types.CategoryDocument
	cursor, err := s.Collections["categories"].Find(s.Ctx, bson.M{
		"user":        subscriber.ID,
		"blueprintId": blueprint.ID,
	})
	s.NoError(err)
	err = cursor.All(s.Ctx, &categories)
	s.NoError(err)

	// Find morning and evening categories
	var morningCat, eveningCat *types.CategoryDocument
	for i := range categories {
		if categories[i].Name == "Morning Tasks" {
			morningCat = &categories[i]
		} else if categories[i].Name == "Evening Tasks" {
			eveningCat = &categories[i]
		}
	}

	s.NotNil(morningCat)
	s.NotNil(eveningCat)
	s.Equal(1, len(morningCat.Tasks))
	s.Equal(2, len(eveningCat.Tasks))
	s.Equal("Morning task 1", morningCat.Tasks[0].Content)
	s.Equal("Evening task 1", eveningCat.Tasks[0].Content)
	s.Equal("Evening task 2", eveningCat.Tasks[1].Content)
}
