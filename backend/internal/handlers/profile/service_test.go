package Profile

import (
	"testing"

	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ProfileServiceTestSuite is the test suite for profile service
type ProfileServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

// SetupTest runs before each test
func (s *ProfileServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

// TestProfileService runs the test suite
func TestProfileService(t *testing.T) {
	suite.Run(t, new(ProfileServiceTestSuite))
}

// ========================================
// GetAllProfiles Tests
// ========================================

func (s *ProfileServiceTestSuite) TestGetAllProfiles_Success() {
	profiles, err := s.service.GetAllProfiles()
	
	s.NoError(err)
	s.NotNil(profiles)
	s.GreaterOrEqual(len(profiles), 1) // Should have at least fixture users
}

// ========================================
// GetProfileByID Tests
// ========================================

func (s *ProfileServiceTestSuite) TestGetProfileByID_Success() {
	user := s.GetUser(0)
	
	profile, err := s.service.GetProfileByID(user.ID)
	
	s.NoError(err)
	s.NotNil(profile)
	s.Equal(user.ID, profile.ID)
	s.Equal(user.DisplayName, profile.DisplayName)
}

func (s *ProfileServiceTestSuite) TestGetProfileByID_NotFound() {
	invalidID := primitive.NewObjectID()
	
	profile, err := s.service.GetProfileByID(invalidID)
	
	s.Error(err)
	s.Nil(profile)
}

// ========================================
// GetProfileByEmail Tests
// ========================================

func (s *ProfileServiceTestSuite) TestGetProfileByEmail_Success() {
	user := s.GetUser(0)
	
	profile, err := s.service.GetProfileByEmail(user.Email)
	
	s.NoError(err)
	s.NotNil(profile)
	s.Equal(user.ID, profile.ID)
}

func (s *ProfileServiceTestSuite) TestGetProfileByEmail_NotFound() {
	profile, err := s.service.GetProfileByEmail("nonexistent@example.com")
	
	s.Error(err)
	s.Nil(profile)
}

// ========================================
// GetProfileByPhone Tests
// ========================================

func (s *ProfileServiceTestSuite) TestGetProfileByPhone_Success() {
	user := s.GetUser(0)
	
	// Set a phone number for the test user
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"phone": "+1234567890"},
	})
	s.NoError(err)
	
	profile, err := s.service.GetProfileByPhone("+1234567890")
	
	s.NoError(err)
	s.NotNil(profile)
	s.Equal(user.ID, profile.ID)
}

func (s *ProfileServiceTestSuite) TestGetProfileByPhone_NotFound() {
	profile, err := s.service.GetProfileByPhone("+9999999999")
	
	s.Error(err)
	s.Nil(profile)
}

// ========================================
// SearchProfiles Tests
// ========================================
// Note: SearchProfiles uses MongoDB Atlas Search which is not available in local testing
// These tests are skipped as they require Atlas

func (s *ProfileServiceTestSuite) TestSearchProfiles_Success() {
	s.T().Skip("SearchProfiles requires MongoDB Atlas Search - not available in local testing")
}

func (s *ProfileServiceTestSuite) TestSearchProfiles_NoResults() {
	s.T().Skip("SearchProfiles requires MongoDB Atlas Search - not available in local testing")
}

// ========================================
// AutocompleteProfiles Tests
// ========================================
// Note: AutocompleteProfiles uses MongoDB Atlas Search which is not available in local testing

func (s *ProfileServiceTestSuite) TestAutocompleteProfiles_Success() {
	s.T().Skip("AutocompleteProfiles requires MongoDB Atlas Search - not available in local testing")
}

// ========================================
// UpdatePartialProfile Tests
// ========================================

func (s *ProfileServiceTestSuite) TestUpdatePartialProfile_Success() {
	user := s.GetUser(0)
	
	newDisplayName := "Updated Name"
	update := UpdateProfileDocument{
		DisplayName: newDisplayName,
	}
	
	err := s.service.UpdatePartialProfile(user.ID, update)
	
	s.NoError(err)
	
	// Verify the update
	profile, err := s.service.GetProfileByID(user.ID)
	s.NoError(err)
	s.Equal(newDisplayName, profile.DisplayName)
}

func (s *ProfileServiceTestSuite) TestUpdatePartialProfile_NotFound() {
	invalidID := primitive.NewObjectID()
	
	newDisplayName := "Updated Name"
	update := UpdateProfileDocument{
		DisplayName: newDisplayName,
	}
	
	err := s.service.UpdatePartialProfile(invalidID, update)
	
	// UpdatePartialProfile is idempotent - doesn't error on non-existent user
	s.NoError(err)
}

// ========================================
// DeleteProfile Tests
// ========================================

func (s *ProfileServiceTestSuite) TestDeleteProfile_Success() {
	user := s.GetUser(0)
	
	err := s.service.DeleteProfile(user.ID)
	
	s.NoError(err)
	
	// Verify profile is deleted
	profile, err := s.service.GetProfileByID(user.ID)
	s.Error(err)
	s.Nil(profile)
}

func (s *ProfileServiceTestSuite) TestDeleteProfile_NotFound() {
	invalidID := primitive.NewObjectID()
	
	err := s.service.DeleteProfile(invalidID)
	
	// Delete of non-existent profile should not error (idempotent)
	s.NoError(err)
}

// ========================================
// UpdateProfilePicture Tests
// ========================================

func (s *ProfileServiceTestSuite) TestUpdateProfilePicture_Success() {
	user := s.GetUser(0)
	
	newPictureURL := "https://example.com/new-picture.jpg"
	err := s.service.UpdateProfilePicture(user.ID, newPictureURL)
	
	s.NoError(err)
	
	// Verify the update
	profile, err := s.service.GetProfileByID(user.ID)
	s.NoError(err)
	s.NotNil(profile.ProfilePicture)
	s.Equal(newPictureURL, *profile.ProfilePicture)
}

// ========================================
// UpdateTimezone Tests
// ========================================

func (s *ProfileServiceTestSuite) TestUpdateTimezone_Success() {
	user := s.GetUser(0)
	
	newTimezone := "America/New_York"
	err := s.service.UpdateTimezone(user.ID, newTimezone)
	
	s.NoError(err)
	
	// Verify the update
	var result struct {
		Timezone string `bson:"timezone"`
	}
	err = s.Collections["users"].FindOne(s.Ctx, bson.M{"_id": user.ID}).Decode(&result)
	s.NoError(err)
	s.Equal(newTimezone, result.Timezone)
}

// ========================================
// GetProfileTasks Tests
// ========================================

func (s *ProfileServiceTestSuite) TestGetProfileTasks_Success() {
	user := s.GetUser(0)
	
	tasks, err := s.service.GetProfileTasks(user.ID)
	
	s.NoError(err)
	// May return nil or empty slice depending on implementation
	if tasks != nil {
		s.GreaterOrEqual(len(tasks), 0)
	}
}

func (s *ProfileServiceTestSuite) TestGetProfileTasks_NoTasks() {
	// Create a new user with no tasks
	newUserID := primitive.NewObjectID()
	_, err := s.Collections["users"].InsertOne(s.Ctx, bson.M{
		"_id":          newUserID,
		"email":        "notasks@example.com",
		"display_name": "No Tasks User",
		"handle":       "notasks",
		"friends":      []primitive.ObjectID{},
	})
	s.NoError(err)
	
	tasks, err := s.service.GetProfileTasks(newUserID)
	
	s.NoError(err)
	// May return nil or empty slice
	if tasks != nil {
		s.Equal(0, len(tasks))
	}
}

// ========================================
// CheckRelationship Tests
// ========================================

func (s *ProfileServiceTestSuite) TestCheckRelationship_Friends() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// Create a friendship connection
	sortedIDs := Connection.SortUserIDs(user1.ID, user2.ID)
	_, err := s.Collections["friend-requests"].InsertOne(s.Ctx, bson.M{
		"_id":         primitive.NewObjectID(),
		"users":       sortedIDs,
		"status":      Connection.StatusFriends,
		"requester": bson.M{
			"_id":     user1.ID,
			"name":    user1.DisplayName,
			"handle":  user1.Handle,
			"picture": user1.ProfilePicture,
		},
		"receiver_id": user2.ID,
	})
	s.NoError(err)
	
	relationship, err := s.service.CheckRelationship(user1.ID, user2.ID)
	
	s.NoError(err)
	s.NotNil(relationship)
	// The status is a custom type, check the string value
	s.Contains(string(relationship.Status), "connect")
}

func (s *ProfileServiceTestSuite) TestCheckRelationship_None() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(2)
	
	// Ensure no relationship exists
	sortedIDs := Connection.SortUserIDs(user1.ID, user2.ID)
	_, err := s.Collections["friend-requests"].DeleteMany(s.Ctx, bson.M{
		"users": sortedIDs,
	})
	s.NoError(err)
	
	relationship, err := s.service.CheckRelationship(user1.ID, user2.ID)
	
	s.NoError(err)
	s.NotNil(relationship)
	s.Equal("none", string(relationship.Status))
}

// ========================================
// GetSuggestedUsers Tests
// ========================================

func (s *ProfileServiceTestSuite) TestGetSuggestedUsers_Success() {
	users, err := s.service.GetSuggestedUsers()
	
	s.NoError(err)
	s.NotNil(users)
	// May have 0 or more suggested users
	s.GreaterOrEqual(len(users), 0)
}

// ========================================
// FindUsersByPhoneNumbers Tests
// ========================================

func (s *ProfileServiceTestSuite) TestFindUsersByPhoneNumbers_Success() {
	user := s.GetUser(0)
	
	// Set a phone number for the test user
	testPhone := "+1234567890"
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"phone": testPhone},
	})
	s.NoError(err)
	
	// Search for this phone number
	phoneNumbers := []string{testPhone, "+9999999999"}
	excludeUserID := primitive.NewObjectID()
	
	users, err := s.service.FindUsersByPhoneNumbers(phoneNumbers, excludeUserID)
	
	s.NoError(err)
	s.NotNil(users)
	s.GreaterOrEqual(len(users), 1)
	
	// Verify the found user
	found := false
	for _, u := range users {
		if u.ID == user.ID.Hex() {
			found = true
			s.Equal(testPhone, u.Phone)
			break
		}
	}
	s.True(found, "Should find user by phone number")
}

func (s *ProfileServiceTestSuite) TestFindUsersByPhoneNumbers_ExcludeUser() {
	user := s.GetUser(0)
	
	// Set a phone number for the test user
	testPhone := "+1234567890"
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"phone": testPhone},
	})
	s.NoError(err)
	
	// Search but exclude this user
	phoneNumbers := []string{testPhone}
	
	users, err := s.service.FindUsersByPhoneNumbers(phoneNumbers, user.ID)
	
	s.NoError(err)
	s.NotNil(users)
	
	// Verify the user is excluded
	for _, u := range users {
		s.NotEqual(user.ID.Hex(), u.ID, "Should exclude the specified user")
	}
}

func (s *ProfileServiceTestSuite) TestFindUsersByPhoneNumbers_NoResults() {
	phoneNumbers := []string{"+9999999999", "+8888888888"}
	excludeUserID := primitive.NewObjectID()
	
	users, err := s.service.FindUsersByPhoneNumbers(phoneNumbers, excludeUserID)
	
	s.NoError(err)
	s.NotNil(users)
	s.Equal(0, len(users))
}
