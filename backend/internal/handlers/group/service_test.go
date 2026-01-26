package Group

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GroupServiceTestSuite is the test suite for group service
type GroupServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

// SetupTest runs before each test
func (s *GroupServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

// TestGroupService runs the test suite
func TestGroupService(t *testing.T) {
	suite.Run(t, new(GroupServiceTestSuite))
}

// Helper to create a test group
func (s *GroupServiceTestSuite) createTestGroup(creator *types.User, members []*types.User) *types.GroupDocument {
	memberRefs := []types.UserExtendedReferenceInternal{}
	for _, member := range members {
		memberRefs = append(memberRefs, types.UserExtendedReferenceInternal{
			ID:             member.ID,
			DisplayName:    member.DisplayName,
			Handle:         member.Handle,
			ProfilePicture: member.ProfilePicture,
		})
	}

	group := &types.GroupDocument{
		Name:     "Test Group",
		Creator:  creator.ID,
		Members:  memberRefs,
		Metadata: types.NewGroupMetadata(),
	}

	result, err := s.service.CreateGroup(group)
	s.NoError(err)
	return result
}

// ========================================
// CreateGroup Tests
// ========================================

func (s *GroupServiceTestSuite) TestCreateGroup_Success() {
	user := s.GetUser(0)

	group := &types.GroupDocument{
		Name:    "Test Group",
		Creator: user.ID,
		Members: []types.UserExtendedReferenceInternal{
			{
				ID:             user.ID,
				DisplayName:    user.DisplayName,
				Handle:         user.Handle,
				ProfilePicture: user.ProfilePicture,
			},
		},
		Metadata: types.NewGroupMetadata(),
	}

	result, err := s.service.CreateGroup(group)

	s.NoError(err)
	s.NotNil(result)
	s.Equal("Test Group", result.Name)
	s.Equal(user.ID, result.Creator)
	s.GreaterOrEqual(len(result.Members), 1)
}

// ========================================
// GetAllGroups Tests
// ========================================

func (s *GroupServiceTestSuite) TestGetAllGroups_Success() {
	user := s.GetUser(0)

	// Create a group
	s.createTestGroup(user, []*types.User{user})

	groups, err := s.service.GetAllGroups(user.ID)

	s.NoError(err)
	s.NotNil(groups)
	s.GreaterOrEqual(len(groups), 1)
}

func (s *GroupServiceTestSuite) TestGetAllGroups_NoGroups() {
	newUserID := primitive.NewObjectID()

	groups, err := s.service.GetAllGroups(newUserID)

	s.NoError(err)
	s.NotNil(groups)
	s.Equal(0, len(groups))
}

// ========================================
// GetGroupByID Tests
// ========================================

func (s *GroupServiceTestSuite) TestGetGroupByID_Success() {
	user := s.GetUser(0)

	created := s.createTestGroup(user, []*types.User{user})

	// Get the group by ID
	result, err := s.service.GetGroupByID(created.ID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(created.ID, result.ID)
	s.Equal("Test Group", result.Name)
}

func (s *GroupServiceTestSuite) TestGetGroupByID_NotFound() {
	invalidID := primitive.NewObjectID()

	group, err := s.service.GetGroupByID(invalidID)

	s.Error(err)
	s.Nil(group)
}

// ========================================
// UpdateGroup Tests
// ========================================

func (s *GroupServiceTestSuite) TestUpdateGroup_Success() {
	user := s.GetUser(0)

	created := s.createTestGroup(user, []*types.User{user})

	// Update the group
	newName := "Updated Name"
	update := UpdateGroupParams{
		Name: &newName,
	}

	err := s.service.UpdateGroup(created.ID, update, user.ID)

	s.NoError(err)

	// Verify the update
	result, err := s.service.GetGroupByID(created.ID)
	s.NoError(err)
	s.Equal(newName, result.Name)
}

func (s *GroupServiceTestSuite) TestUpdateGroup_NotCreator() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	created := s.createTestGroup(user1, []*types.User{user1, user2})

	// Try to update as user2 (not creator)
	newName := "Hacked Name"
	update := UpdateGroupParams{
		Name: &newName,
	}

	err := s.service.UpdateGroup(created.ID, update, user2.ID)

	s.Error(err)
}

// ========================================
// DeleteGroup Tests
// ========================================

func (s *GroupServiceTestSuite) TestDeleteGroup_Success() {
	user := s.GetUser(0)

	created := s.createTestGroup(user, []*types.User{user})

	// Delete the group
	err := s.service.DeleteGroup(created.ID, user.ID)

	s.NoError(err)

	// Verify it's deleted
	result, err := s.service.GetGroupByID(created.ID)
	s.Error(err)
	s.Nil(result)
}

func (s *GroupServiceTestSuite) TestDeleteGroup_NotCreator() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	created := s.createTestGroup(user1, []*types.User{user1})

	// Try to delete as user2
	err := s.service.DeleteGroup(created.ID, user2.ID)

	s.Error(err)
}

// ========================================
// AddMember Tests
// ========================================

func (s *GroupServiceTestSuite) TestAddMember_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	created := s.createTestGroup(user1, []*types.User{user1})

	// Add a member
	err := s.service.AddMember(created.ID, user2.ID, user1.ID)

	s.NoError(err)

	// Verify member was added
	result, err := s.service.GetGroupByID(created.ID)
	s.NoError(err)

	found := false
	for _, member := range result.Members {
		if member.ID == user2.ID {
			found = true
			break
		}
	}
	s.True(found, "User2 should be in the group")
}

func (s *GroupServiceTestSuite) TestAddMember_NotCreator() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	user3 := s.GetUser(2)

	created := s.createTestGroup(user1, []*types.User{user1})

	// Try to add member as non-creator
	err := s.service.AddMember(created.ID, user3.ID, user2.ID)

	s.Error(err)
}

// ========================================
// RemoveMember Tests
// ========================================

func (s *GroupServiceTestSuite) TestRemoveMember_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	created := s.createTestGroup(user1, []*types.User{user1, user2})

	// Remove a member
	err := s.service.RemoveMember(created.ID, user2.ID, user1.ID)

	s.NoError(err)

	// Verify member was removed
	result, err := s.service.GetGroupByID(created.ID)
	s.NoError(err)

	for _, member := range result.Members {
		s.NotEqual(user2.ID, member.ID, "User2 should not be in the group")
	}
}

func (s *GroupServiceTestSuite) TestRemoveMember_NotCreator() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	created := s.createTestGroup(user1, []*types.User{user1, user2})

	// Try to remove member as non-creator
	err := s.service.RemoveMember(created.ID, user1.ID, user2.ID)

	s.Error(err)
}

// ========================================
// IsUserInGroup Tests
// ========================================

func (s *GroupServiceTestSuite) TestIsUserInGroup_True() {
	user := s.GetUser(0)

	created := s.createTestGroup(user, []*types.User{user})

	// Check if user is in group
	isMember, err := s.service.IsUserInGroup(created.ID, user.ID)

	s.NoError(err)
	s.True(isMember)
}

func (s *GroupServiceTestSuite) TestIsUserInGroup_False() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	created := s.createTestGroup(user1, []*types.User{user1})

	// Check if user2 is in group
	isMember, err := s.service.IsUserInGroup(created.ID, user2.ID)

	s.NoError(err)
	s.False(isMember)
}
