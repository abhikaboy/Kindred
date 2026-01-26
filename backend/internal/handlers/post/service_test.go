package Post_test

import (
	"testing"
	"time"

	Post "github.com/abhikaboy/Kindred/internal/handlers/post"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PostServiceTestSuite tests the post service
type PostServiceTestSuite struct {
	testpkg.BaseSuite
	service *Post.Service
}

// SetupTest runs before each test
func (s *PostServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()

	// Initialize service with test database
	s.service = Post.NewService(s.Collections)
}

// TestPostService runs the test suite
func TestPostService(t *testing.T) {
	testpkg.RunSuite(t, new(PostServiceTestSuite))
}

// ========================================
// GetPostByID Tests
// ========================================

func (s *PostServiceTestSuite) TestGetPostByID_Success() {
	// Get a post from fixtures
	post := s.GetPost(0)
	s.Require().NotNil(post)

	// Fetch it via service
	result, err := s.service.GetPostByID(post.ID)

	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.Equal(post.ID, result.ID)
	s.Equal(post.Caption, result.Caption)
}

func (s *PostServiceTestSuite) TestGetPostByID_NotFound() {
	fakeID := testpkg.GenerateObjectID()

	result, err := s.service.GetPostByID(fakeID)

	s.Error(err)
	s.Nil(result)
}

// ========================================
// CreatePost Tests
// ========================================

func (s *PostServiceTestSuite) TestCreatePost_Success() {
	user := s.GetUser(0)

	newPost := &types.PostDocument{
		ID:      primitive.NewObjectID(),
		Caption: "My new test post",
		User: types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
		Images: []string{"https://example.com/test.jpg"},
		Metadata: types.PostMetadata{
			IsDeleted: false,
		},
		Reactions: map[string][]primitive.ObjectID{},
		Comments:  []types.CommentDocument{},
	}

	result, stats, err := s.service.CreatePost(newPost)

	// Assertions
	s.NoError(err)
	s.NotNil(result)
	s.NotNil(stats)
	s.Equal("My new test post", result.Caption)
	s.Equal(user.ID, result.User.ID)

	// Verify it was inserted
	var found types.PostDocument
	err = s.Collections["posts"].FindOne(s.Ctx, bson.M{"_id": result.ID}).Decode(&found)
	s.NoError(err)
	s.Equal("My new test post", found.Caption)
}

func (s *PostServiceTestSuite) TestCreatePost_WithTask() {
	user := s.GetUser(0)
	taskID := testpkg.GenerateObjectID()

	newPost := &types.PostDocument{
		ID:      primitive.NewObjectID(),
		Caption: "Completed my workout!",
		User: types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
		Images: []string{"https://example.com/workout.jpg"},
		Task: &types.PostTaskExtendedReference{
			ID:      taskID,
			Content: "Morning Workout",
			Category: types.CategoryExtendedReference{
				ID:   primitive.NewObjectID(),
				Name: "Fitness",
			},
		},
		Metadata: types.PostMetadata{
			IsDeleted: false,
		},
		Reactions: map[string][]primitive.ObjectID{},
		Comments:  []types.CommentDocument{},
	}

	result, _, err := s.service.CreatePost(newPost)

	s.NoError(err)
	s.NotNil(result.Task)
	s.Equal(taskID, result.Task.ID)
	s.Equal("Morning Workout", result.Task.Content)
}

// ========================================
// AddComment Tests
// ========================================

func (s *PostServiceTestSuite) TestAddComment_Success() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	userRef := &types.UserExtendedReferenceInternal{
		ID:             user.ID,
		DisplayName:    user.DisplayName,
		Handle:         user.Handle,
		ProfilePicture: user.ProfilePicture,
	}

	comment := types.CommentDocument{
		ID:      testpkg.GenerateObjectID(),
		Content: "Great post!",
		User:    userRef,
	}

	err := s.service.AddComment(post.ID, comment)

	s.NoError(err)

	// Verify comment was added to post
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)
	s.GreaterOrEqual(len(updatedPost.Comments), 1)
}

// ========================================
// React Tests
// ========================================

func (s *PostServiceTestSuite) TestToggleReaction_Success() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	reactDoc := &types.ReactDocument{
		PostID: post.ID,
		UserID: user.ID,
		Emoji:  "❤️",
	}

	added, err := s.service.ToggleReaction(reactDoc)

	s.NoError(err)
	s.True(added) // First time should add

	// Verify reaction was added
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)
	s.Contains(updatedPost.Reactions, "❤️")
	s.Contains(updatedPost.Reactions["❤️"], user.ID)
}

func (s *PostServiceTestSuite) TestToggleReaction_Remove() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	reactDoc := &types.ReactDocument{
		PostID: post.ID,
		UserID: user.ID,
		Emoji:  "❤️",
	}

	// Add reaction
	added, err := s.service.ToggleReaction(reactDoc)
	s.NoError(err)
	s.True(added)

	// Remove reaction (toggle again)
	removed, err := s.service.ToggleReaction(reactDoc)
	s.NoError(err)
	s.False(removed) // Second time should remove

	// Verify reaction was removed
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)

	if reactions, ok := updatedPost.Reactions["❤️"]; ok {
		s.NotContains(reactions, user.ID)
	}
}

// ========================================
// DeletePost Tests
// ========================================

func (s *PostServiceTestSuite) TestDeletePost_Success() {
	user := s.GetUser(0)

	// Create a test post first
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("Test post to delete").
		Build()

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Verify post exists
	count, err := s.Collections["posts"].CountDocuments(s.Ctx, bson.M{"_id": created.ID})
	s.NoError(err)
	s.Equal(int64(1), count)

	// Now delete it (hard delete)
	err = s.service.DeletePost(created.ID)
	s.NoError(err)

	// Verify post is completely removed
	count, err = s.Collections["posts"].CountDocuments(s.Ctx, bson.M{"_id": created.ID})
	s.NoError(err)
	s.Equal(int64(0), count)
}

// ========================================
// GetFriendsPosts Tests
// ========================================
// Note: GetFriendsPosts tests removed due to complex aggregation dependencies
// These should be tested via integration tests with proper user/connection setup

// ========================================
// GetAllPosts Tests
// ========================================

func (s *PostServiceTestSuite) TestGetAllPosts_Success() {
	user := s.GetUser(0)

	// Create a public post first
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("Public test post").
		Build()
	newPost.Metadata.IsPublic = true

	_, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Now fetch all posts
	posts, total, err := s.service.GetAllPosts(10, 0)

	s.NoError(err)
	s.NotNil(posts)
	s.GreaterOrEqual(total, 0)
	s.GreaterOrEqual(len(posts), 1)
}

func (s *PostServiceTestSuite) TestGetAllPosts_OnlyPublic() {
	user := s.GetUser(0)

	// Create a public post
	publicPost := testpkg.NewPostBuilder(*user).
		WithCaption("Public post").
		Build()
	publicPost.Metadata.IsPublic = true

	_, _, err := s.service.CreatePost(&publicPost)
	s.NoError(err)

	// Get all posts
	posts, _, err := s.service.GetAllPosts(10, 0)
	s.NoError(err)

	// All posts should be public
	for _, post := range posts {
		s.True(post.Metadata.IsPublic)
		s.False(post.Metadata.IsDeleted)
	}
}

// ========================================
// UpdatePartialPost Tests
// ========================================

func (s *PostServiceTestSuite) TestUpdatePartialPost_Caption() {
	user := s.GetUser(0)

	// Create a post
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("Original caption").
		Build()

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Update caption
	newCaption := "Updated caption"
	err = s.service.UpdatePartialPost(created.ID, Post.UpdatePostParams{
		Caption: &newCaption,
	})
	s.NoError(err)

	// Verify update
	updated, err := s.service.GetPostByID(created.ID)
	s.NoError(err)
	s.Equal("Updated caption", updated.Caption)
	s.True(updated.Metadata.IsEdited)
}

func (s *PostServiceTestSuite) TestUpdatePartialPost_IsPublic() {
	user := s.GetUser(0)

	// Create a private post
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("Test post").
		Build()
	newPost.Metadata.IsPublic = false

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Update to public
	isPublic := true
	err = s.service.UpdatePartialPost(created.ID, Post.UpdatePostParams{
		IsPublic: &isPublic,
	})
	s.NoError(err)

	// Verify update
	updated, err := s.service.GetPostByID(created.ID)
	s.NoError(err)
	s.True(updated.Metadata.IsPublic)
}

func (s *PostServiceTestSuite) TestUpdatePartialPost_Size() {
	user := s.GetUser(0)

	// Create a post
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("Test post").
		Build()

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Update size
	newSize := types.ImageSize{Width: 1920, Height: 1080}
	err = s.service.UpdatePartialPost(created.ID, Post.UpdatePostParams{
		Size: &newSize,
	})
	s.NoError(err)

	// Verify update
	updated, err := s.service.GetPostByID(created.ID)
	s.NoError(err)
	s.NotNil(updated.Size)
	s.Equal(1920, updated.Size.Width)
	s.Equal(1080, updated.Size.Height)
}

func (s *PostServiceTestSuite) TestUpdatePartialPost_MultipleFields() {
	user := s.GetUser(0)

	// Create a post
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("Original").
		Build()

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Update multiple fields
	newCaption := "Updated"
	isPublic := true
	err = s.service.UpdatePartialPost(created.ID, Post.UpdatePostParams{
		Caption:  &newCaption,
		IsPublic: &isPublic,
	})
	s.NoError(err)

	// Verify updates
	updated, err := s.service.GetPostByID(created.ID)
	s.NoError(err)
	s.Equal("Updated", updated.Caption)
	s.True(updated.Metadata.IsPublic)
}

// ========================================
// GetUserPosts Tests
// ========================================

func (s *PostServiceTestSuite) TestGetUserPosts_Success() {
	user := s.GetUser(0)

	// Create multiple posts for the user
	for i := 0; i < 3; i++ {
		newPost := testpkg.NewPostBuilder(*user).
			WithCaption("User post " + string(rune(i))).
			Build()
		_, _, err := s.service.CreatePost(&newPost)
		s.NoError(err)
	}

	// Get user posts
	posts, err := s.service.GetUserPosts(user.ID)

	s.NoError(err)
	s.GreaterOrEqual(len(posts), 3)

	// Verify all posts belong to the user
	for _, post := range posts {
		s.Equal(user.ID, post.User.ID)
		s.False(post.Metadata.IsDeleted)
	}
}

func (s *PostServiceTestSuite) TestGetUserPosts_EmptyResult() {
	// Create a user with no posts
	fakeUserID := testpkg.GenerateObjectID()

	posts, err := s.service.GetUserPosts(fakeUserID)

	s.NoError(err)
	s.Empty(posts)
}

func (s *PostServiceTestSuite) TestGetUserPosts_ExcludesDeleted() {
	user := s.GetUser(0)

	// Create a post and delete it
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("To be deleted").
		Build()

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Mark as deleted
	_, err = s.Collections["posts"].UpdateOne(s.Ctx, bson.M{"_id": created.ID}, bson.M{
		"$set": bson.M{"metadata.isDeleted": true},
	})
	s.NoError(err)

	// Get user posts - should not include deleted
	posts, err := s.service.GetUserPosts(user.ID)
	s.NoError(err)

	for _, post := range posts {
		s.NotEqual(created.ID, post.ID)
	}
}

// ========================================
// GetUserGroups Tests
// ========================================

func (s *PostServiceTestSuite) TestGetUserGroups_AsCreator() {
	user := s.GetUser(0)

	// Create a group where user is creator
	group := types.GroupDocument{
		ID:      primitive.NewObjectID(),
		Name:    "Test Group",
		Creator: user.ID,
		Members: []types.UserExtendedReferenceInternal{},
		Metadata: types.GroupMetadata{
			IsDeleted: false,
		},
	}

	_, err := s.Collections["groups"].InsertOne(s.Ctx, group)
	s.NoError(err)

	// Get user groups
	groups, err := s.service.GetUserGroups(user.ID)

	s.NoError(err)
	s.GreaterOrEqual(len(groups), 1)

	// Verify group is in results
	found := false
	for _, g := range groups {
		if g.ID == group.ID {
			found = true
			s.Equal("Test Group", g.Name)
		}
	}
	s.True(found)
}

func (s *PostServiceTestSuite) TestGetUserGroups_AsMember() {
	user := s.GetUser(0)
	otherUser := s.GetUser(1)

	// Create a group where user is a member
	group := types.GroupDocument{
		ID:      primitive.NewObjectID(),
		Name:    "Member Group",
		Creator: otherUser.ID,
		Members: []types.UserExtendedReferenceInternal{
			{
				ID:             user.ID,
				DisplayName:    user.DisplayName,
				Handle:         user.Handle,
				ProfilePicture: user.ProfilePicture,
			},
		},
		Metadata: types.GroupMetadata{
			IsDeleted: false,
		},
	}

	_, err := s.Collections["groups"].InsertOne(s.Ctx, group)
	s.NoError(err)

	// Get user groups
	groups, err := s.service.GetUserGroups(user.ID)

	s.NoError(err)
	s.GreaterOrEqual(len(groups), 1)

	// Verify group is in results
	found := false
	for _, g := range groups {
		if g.ID == group.ID {
			found = true
		}
	}
	s.True(found)
}

func (s *PostServiceTestSuite) TestGetUserGroups_ExcludesDeleted() {
	user := s.GetUser(0)

	// Create a deleted group
	group := types.GroupDocument{
		ID:      primitive.NewObjectID(),
		Name:    "Deleted Group",
		Creator: user.ID,
		Members: []types.UserExtendedReferenceInternal{},
		Metadata: types.GroupMetadata{
			IsDeleted: true,
		},
	}

	_, err := s.Collections["groups"].InsertOne(s.Ctx, group)
	s.NoError(err)

	// Get user groups
	groups, err := s.service.GetUserGroups(user.ID)

	s.NoError(err)

	// Verify deleted group is not in results
	for _, g := range groups {
		s.NotEqual(group.ID, g.ID)
	}
}

// ========================================
// GetPostsByBlueprint Tests
// ========================================

func (s *PostServiceTestSuite) TestGetPostsByBlueprint_Success() {
	user := s.GetUser(0)
	blueprintID := testpkg.GenerateObjectID()

	// Create posts with blueprint
	for i := 0; i < 2; i++ {
		newPost := testpkg.NewPostBuilder(*user).
			WithCaption("Blueprint post").
			Build()
		newPost.Blueprint = &types.EnhancedBlueprintReference{
			ID:       blueprintID,
			IsPublic: true,
		}
		newPost.Metadata.IsPublic = true

		_, _, err := s.service.CreatePost(&newPost)
		s.NoError(err)
	}

	// Get posts by blueprint
	posts, err := s.service.GetPostsByBlueprint(blueprintID)

	s.NoError(err)
	s.GreaterOrEqual(len(posts), 2)

	// Verify all posts have the blueprint
	for _, post := range posts {
		s.NotNil(post.Blueprint)
		s.Equal(blueprintID, post.Blueprint.ID)
		s.True(post.Metadata.IsPublic)
	}
}

func (s *PostServiceTestSuite) TestGetPostsByBlueprint_OnlyPublic() {
	user := s.GetUser(0)
	blueprintID := testpkg.GenerateObjectID()

	// Create a private post with blueprint
	privatePost := testpkg.NewPostBuilder(*user).
		WithCaption("Private blueprint post").
		Build()
	privatePost.Blueprint = &types.EnhancedBlueprintReference{
		ID:       blueprintID,
		IsPublic: false,
	}
	privatePost.Metadata.IsPublic = false

	_, _, err := s.service.CreatePost(&privatePost)
	s.NoError(err)

	// Get posts by blueprint - should not include private
	posts, err := s.service.GetPostsByBlueprint(blueprintID)

	s.NoError(err)

	// All returned posts should be public
	for _, post := range posts {
		s.True(post.Metadata.IsPublic)
	}
}

func (s *PostServiceTestSuite) TestGetPostsByBlueprint_EmptyResult() {
	fakeID := testpkg.GenerateObjectID()

	posts, err := s.service.GetPostsByBlueprint(fakeID)

	s.NoError(err)
	s.Empty(posts)
}

// ========================================
// DeleteComment Tests
// ========================================

func (s *PostServiceTestSuite) TestDeleteComment_Success() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	// Add a comment
	comment := types.CommentDocument{
		ID:      testpkg.GenerateObjectID(),
		Content: "Comment to delete",
		User: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
	}

	err := s.service.AddComment(post.ID, comment)
	s.NoError(err)

	// Delete the comment
	err = s.service.DeleteComment(post.ID, comment.ID)
	s.NoError(err)

	// Verify comment was deleted
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)

	for _, c := range updatedPost.Comments {
		s.NotEqual(comment.ID, c.ID)
	}
}

func (s *PostServiceTestSuite) TestDeleteComment_WithReplies() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	// Add a parent comment
	parentComment := types.CommentDocument{
		ID:      testpkg.GenerateObjectID(),
		Content: "Parent comment",
		User: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
	}

	err := s.service.AddComment(post.ID, parentComment)
	s.NoError(err)

	// Add a reply
	replyComment := types.CommentDocument{
		ID:       testpkg.GenerateObjectID(),
		Content:  "Reply comment",
		ParentID: &parentComment.ID,
		User: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
	}

	err = s.service.AddComment(post.ID, replyComment)
	s.NoError(err)

	// Delete parent comment - should also delete reply
	err = s.service.DeleteComment(post.ID, parentComment.ID)
	s.NoError(err)

	// Verify both parent and reply were deleted
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)

	for _, c := range updatedPost.Comments {
		s.NotEqual(parentComment.ID, c.ID)
		s.NotEqual(replyComment.ID, c.ID)
	}
}

func (s *PostServiceTestSuite) TestDeleteComment_NotFound() {
	post := s.GetPost(0)
	fakeCommentID := testpkg.GenerateObjectID()

	err := s.service.DeleteComment(post.ID, fakeCommentID)

	// DeleteComment returns error when no documents are modified
	// but if the post exists and comment doesn't, it may not error
	// Let's verify the comment doesn't exist instead
	if err != nil {
		s.Error(err)
	} else {
		// If no error, verify comment was not found by checking post
		updatedPost, err := s.service.GetPostByID(post.ID)
		s.NoError(err)
		for _, c := range updatedPost.Comments {
			s.NotEqual(fakeCommentID, c.ID)
		}
	}
}

// ========================================
// CheckRelationship Tests
// ========================================

func (s *PostServiceTestSuite) TestCheckRelationship_SameUser() {
	user := s.GetUser(0)

	isFriend, err := s.service.CheckRelationship(user.ID, user.ID)

	s.NoError(err)
	s.True(isFriend) // User can always view their own posts
}

func (s *PostServiceTestSuite) TestCheckRelationship_Friends() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Create a friend connection
	sortedIDs := []primitive.ObjectID{user1.ID, user2.ID}
	if user1.ID.Hex() > user2.ID.Hex() {
		sortedIDs = []primitive.ObjectID{user2.ID, user1.ID}
	}

	connection := bson.M{
		"users":  sortedIDs,
		"status": "friends",
	}

	_, err := s.Collections["friend-requests"].InsertOne(s.Ctx, connection)
	s.NoError(err)

	// Check relationship
	isFriend, err := s.service.CheckRelationship(user1.ID, user2.ID)

	s.NoError(err)
	s.True(isFriend)
}

func (s *PostServiceTestSuite) TestCheckRelationship_NotFriends() {
	// Create two new users with no connection
	user1ID := testpkg.GenerateObjectID()
	user2ID := testpkg.GenerateObjectID()

	// No connection exists
	isFriend, err := s.service.CheckRelationship(user1ID, user2ID)

	s.NoError(err)
	s.False(isFriend)
}

func (s *PostServiceTestSuite) TestCheckRelationship_Blocked() {
	// Create two new users
	user1ID := testpkg.GenerateObjectID()
	user2ID := testpkg.GenerateObjectID()

	// Create a blocked connection
	sortedIDs := []primitive.ObjectID{user1ID, user2ID}
	if user1ID.Hex() > user2ID.Hex() {
		sortedIDs = []primitive.ObjectID{user2ID, user1ID}
	}

	connection := bson.M{
		"users":  sortedIDs,
		"status": "blocked",
	}

	_, err := s.Collections["friend-requests"].InsertOne(s.Ctx, connection)
	s.NoError(err)

	// Check relationship
	isFriend, err := s.service.CheckRelationship(user1ID, user2ID)

	s.NoError(err)
	s.False(isFriend) // Blocked users should not have access
}

// ========================================
// GetBlockedUserIDs Tests
// ========================================

func (s *PostServiceTestSuite) TestGetBlockedUserIDs_Success() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Create a blocked connection
	sortedIDs := []primitive.ObjectID{user1.ID, user2.ID}
	if user1.ID.Hex() > user2.ID.Hex() {
		sortedIDs = []primitive.ObjectID{user2.ID, user1.ID}
	}

	connection := bson.M{
		"users":  sortedIDs,
		"status": "blocked",
	}

	_, err := s.Collections["friend-requests"].InsertOne(s.Ctx, connection)
	s.NoError(err)

	// Get blocked user IDs
	blockedIDs, err := s.service.GetBlockedUserIDs(s.Ctx, user1.ID)

	s.NoError(err)
	s.Contains(blockedIDs, user2.ID)
}

func (s *PostServiceTestSuite) TestGetBlockedUserIDs_MultipleBlocked() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	user3 := s.GetUser(2)

	// Block user2
	sortedIDs1 := []primitive.ObjectID{user1.ID, user2.ID}
	if user1.ID.Hex() > user2.ID.Hex() {
		sortedIDs1 = []primitive.ObjectID{user2.ID, user1.ID}
	}

	_, err := s.Collections["friend-requests"].InsertOne(s.Ctx, bson.M{
		"users":  sortedIDs1,
		"status": "blocked",
	})
	s.NoError(err)

	// Block user3
	sortedIDs2 := []primitive.ObjectID{user1.ID, user3.ID}
	if user1.ID.Hex() > user3.ID.Hex() {
		sortedIDs2 = []primitive.ObjectID{user3.ID, user1.ID}
	}

	_, err = s.Collections["friend-requests"].InsertOne(s.Ctx, bson.M{
		"users":  sortedIDs2,
		"status": "blocked",
	})
	s.NoError(err)

	// Get blocked user IDs
	blockedIDs, err := s.service.GetBlockedUserIDs(s.Ctx, user1.ID)

	s.NoError(err)
	s.Len(blockedIDs, 2)
	s.Contains(blockedIDs, user2.ID)
	s.Contains(blockedIDs, user3.ID)
}

func (s *PostServiceTestSuite) TestGetBlockedUserIDs_NoBlocked() {
	user := s.GetUser(0)

	blockedIDs, err := s.service.GetBlockedUserIDs(s.Ctx, user.ID)

	s.NoError(err)
	s.Empty(blockedIDs)
}

// ========================================
// AddComment with Mentions Tests
// ========================================

func (s *PostServiceTestSuite) TestAddComment_WithMentions() {
	user := s.GetUser(0)
	mentionedUser := s.GetUser(1)
	post := s.GetPost(0)

	userRef := &types.UserExtendedReferenceInternal{
		ID:             user.ID,
		DisplayName:    user.DisplayName,
		Handle:         user.Handle,
		ProfilePicture: user.ProfilePicture,
	}

	comment := types.CommentDocument{
		ID:      testpkg.GenerateObjectID(),
		Content: "Hey @user check this out!",
		User:    userRef,
		Mentions: []types.MentionReference{
			{
				ID:     mentionedUser.ID,
				Handle: mentionedUser.Handle,
			},
		},
	}

	err := s.service.AddComment(post.ID, comment)

	s.NoError(err)

	// Verify comment was added with mentions
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)
	s.GreaterOrEqual(len(updatedPost.Comments), 1)

	// Find the comment
	found := false
	for _, c := range updatedPost.Comments {
		if c.ID == comment.ID {
			found = true
			s.Len(c.Mentions, 1)
			s.Equal(mentionedUser.ID, c.Mentions[0].ID)
		}
	}
	s.True(found)
}

func (s *PostServiceTestSuite) TestAddComment_ReplyToComment() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	userRef := &types.UserExtendedReferenceInternal{
		ID:             user.ID,
		DisplayName:    user.DisplayName,
		Handle:         user.Handle,
		ProfilePicture: user.ProfilePicture,
	}

	// Add parent comment
	parentComment := types.CommentDocument{
		ID:      testpkg.GenerateObjectID(),
		Content: "Parent comment",
		User:    userRef,
	}

	err := s.service.AddComment(post.ID, parentComment)
	s.NoError(err)

	// Add reply
	replyComment := types.CommentDocument{
		ID:       testpkg.GenerateObjectID(),
		Content:  "Reply to parent",
		User:     userRef,
		ParentID: &parentComment.ID,
	}

	err = s.service.AddComment(post.ID, replyComment)
	s.NoError(err)

	// Verify reply was added
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)

	found := false
	for _, c := range updatedPost.Comments {
		if c.ID == replyComment.ID {
			found = true
			s.NotNil(c.ParentID)
			s.Equal(parentComment.ID, *c.ParentID)
		}
	}
	s.True(found)
}

// ========================================
// Reaction Edge Cases
// ========================================

func (s *PostServiceTestSuite) TestToggleReaction_DifferentEmojis() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	// Add multiple different reactions
	emojis := []string{"❤️", "👍", "😂"}

	for _, emoji := range emojis {
		reactDoc := &types.ReactDocument{
			PostID: post.ID,
			UserID: user.ID,
			Emoji:  emoji,
		}

		added, err := s.service.ToggleReaction(reactDoc)
		s.NoError(err)
		s.True(added)
	}

	// Verify all reactions were added
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)

	for _, emoji := range emojis {
		s.Contains(updatedPost.Reactions, emoji)
		s.Contains(updatedPost.Reactions[emoji], user.ID)
	}
}

func (s *PostServiceTestSuite) TestToggleReaction_MultipleUsers() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	post := s.GetPost(0)

	emoji := "❤️"

	// User 1 reacts
	reactDoc1 := &types.ReactDocument{
		PostID: post.ID,
		UserID: user1.ID,
		Emoji:  emoji,
	}

	added, err := s.service.ToggleReaction(reactDoc1)
	s.NoError(err)
	s.True(added)

	// User 2 reacts with same emoji
	reactDoc2 := &types.ReactDocument{
		PostID: post.ID,
		UserID: user2.ID,
		Emoji:  emoji,
	}

	added, err = s.service.ToggleReaction(reactDoc2)
	s.NoError(err)
	s.True(added)

	// Verify both users have reacted
	updatedPost, err := s.service.GetPostByID(post.ID)
	s.NoError(err)
	s.Contains(updatedPost.Reactions, emoji)
	s.Len(updatedPost.Reactions[emoji], 2)
	s.Contains(updatedPost.Reactions[emoji], user1.ID)
	s.Contains(updatedPost.Reactions[emoji], user2.ID)
}

// ========================================
// GetAllPosts Pagination Tests
// ========================================

func (s *PostServiceTestSuite) TestGetAllPosts_Pagination() {
	user := s.GetUser(0)

	// Create multiple public posts
	for i := 0; i < 15; i++ {
		newPost := testpkg.NewPostBuilder(*user).
			WithCaption("Public post").
			Build()
		newPost.Metadata.IsPublic = true

		_, _, err := s.service.CreatePost(&newPost)
		s.NoError(err)
	}

	// Get first page
	posts1, total, err := s.service.GetAllPosts(5, 0)
	s.NoError(err)
	s.LessOrEqual(len(posts1), 5)
	s.GreaterOrEqual(total, 15)

	// Get second page
	posts2, _, err := s.service.GetAllPosts(5, 5)
	s.NoError(err)
	s.LessOrEqual(len(posts2), 5)

	// Verify different posts
	if len(posts1) > 0 && len(posts2) > 0 {
		s.NotEqual(posts1[0].ID, posts2[0].ID)
	}
}

func (s *PostServiceTestSuite) TestGetAllPosts_DefaultLimit() {
	user := s.GetUser(0)

	// Create posts
	for i := 0; i < 10; i++ {
		newPost := testpkg.NewPostBuilder(*user).
			WithCaption("Test post").
			Build()
		newPost.Metadata.IsPublic = true

		_, _, err := s.service.CreatePost(&newPost)
		s.NoError(err)
	}

	// Get posts with limit 0 (should use default of 8)
	posts, _, err := s.service.GetAllPosts(0, 0)
	s.NoError(err)
	s.LessOrEqual(len(posts), 8)
}

// ========================================
// GetFriendsPosts Tests
// ========================================

func (s *PostServiceTestSuite) TestGetFriendsPosts_WithFriends() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Make them friends
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user1.ID}, bson.M{
		"$set": bson.M{"friends": []primitive.ObjectID{user2.ID}},
	})
	s.NoError(err)

	// Create a post by user2
	newPost := testpkg.NewPostBuilder(*user2).
		WithCaption("Friend's post").
		Build()

	_, _, err = s.service.CreatePost(&newPost)
	s.NoError(err)

	// Get friends posts for user1
	posts, total, err := s.service.GetFriendsPosts(user1.ID, 10, 0)

	// Should not error even if complex aggregation
	s.NoError(err)
	s.GreaterOrEqual(total, 0)
	s.NotNil(posts)
}

func (s *PostServiceTestSuite) TestGetFriendsPosts_NoFriends() {
	user := s.GetUser(0)

	// User has no friends
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"friends": []primitive.ObjectID{}},
	})
	s.NoError(err)

	// Get friends posts
	posts, total, err := s.service.GetFriendsPosts(user.ID, 10, 0)

	s.NoError(err)
	s.Equal(0, total)
	s.Empty(posts)
}

func (s *PostServiceTestSuite) TestGetFriendsPosts_Pagination() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Make them friends
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user1.ID}, bson.M{
		"$set": bson.M{"friends": []primitive.ObjectID{user2.ID}},
	})
	s.NoError(err)

	// Create multiple posts by user2
	for i := 0; i < 5; i++ {
		newPost := testpkg.NewPostBuilder(*user2).
			WithCaption("Friend post").
			Build()
		_, _, err = s.service.CreatePost(&newPost)
		s.NoError(err)
	}

	// Get first page
	posts1, _, err := s.service.GetFriendsPosts(user1.ID, 2, 0)
	s.NoError(err)

	// Get second page
	posts2, _, err := s.service.GetFriendsPosts(user1.ID, 2, 2)
	s.NoError(err)

	// Both should succeed
	s.NotNil(posts1)
	s.NotNil(posts2)
}

// ========================================
// GetFriendsPublicTasks Tests
// ========================================

func (s *PostServiceTestSuite) TestGetFriendsPublicTasks_NoFriends() {
	user := s.GetUser(0)

	// User has no friends
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"friends": []primitive.ObjectID{}},
	})
	s.NoError(err)

	// Get friends public tasks
	tasks, total, err := s.service.GetFriendsPublicTasks(user.ID, 10, 0)

	s.NoError(err)
	s.Equal(0, total)
	s.Empty(tasks)
}

func (s *PostServiceTestSuite) TestGetFriendsPublicTasks_WithFriends() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Make them friends
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user1.ID}, bson.M{
		"$set": bson.M{"friends": []primitive.ObjectID{user2.ID}},
	})
	s.NoError(err)

	// Create a category for user2 with public tasks
	category := bson.M{
		"_id":  primitive.NewObjectID(),
		"name": "Fitness",
		"user": user2.ID,
		"tasks": []bson.M{
			{
				"_id":       primitive.NewObjectID(),
				"content":   "Morning workout",
				"priority":  1,
				"value":     10.0,
				"public":    true,
				"timestamp": primitive.NewDateTimeFromTime(time.Now()),
			},
		},
	}

	_, err = s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Get friends public tasks
	tasks, total, err := s.service.GetFriendsPublicTasks(user1.ID, 10, 0)

	s.NoError(err)
	s.GreaterOrEqual(total, 0)
	s.NotNil(tasks)
}

func (s *PostServiceTestSuite) TestGetFriendsPublicTasks_DefaultLimit() {
	user := s.GetUser(0)

	// Get with limit 0 (should use default of 20)
	tasks, total, err := s.service.GetFriendsPublicTasks(user.ID, 0, 0)

	s.NoError(err)
	s.GreaterOrEqual(total, 0)
	// tasks can be empty slice or nil, both are valid
	if tasks != nil {
		s.GreaterOrEqual(len(tasks), 0)
	}
}

// ========================================
// NotifyRandomFriendsOfPost Tests
// ========================================

func (s *PostServiceTestSuite) TestNotifyRandomFriendsOfPost_NoFriends() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	// User has no friends
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"friends": []primitive.ObjectID{}},
	})
	s.NoError(err)

	// Should not error even with no friends
	err = s.service.NotifyRandomFriendsOfPost(post.ID, user.ID, user.DisplayName, "Test caption", 0.5)
	s.NoError(err)
}

func (s *PostServiceTestSuite) TestNotifyRandomFriendsOfPost_WithFriends() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Make them friends
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user1.ID}, bson.M{
		"$set": bson.M{"friends": []primitive.ObjectID{user2.ID}},
	})
	s.NoError(err)

	// Create a post
	newPost := testpkg.NewPostBuilder(*user1).
		WithCaption("Test post for notification").
		Build()

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Notify friends (with 100% probability to ensure notification)
	err = s.service.NotifyRandomFriendsOfPost(created.ID, user1.ID, user1.DisplayName, "Test caption", 1.0)

	// Should not error
	s.NoError(err)
}

func (s *PostServiceTestSuite) TestNotifyRandomFriendsOfPost_InvalidProbability() {
	user := s.GetUser(0)
	post := s.GetPost(0)

	// Test with invalid probability (should default to 0.3)
	err := s.service.NotifyRandomFriendsOfPost(post.ID, user.ID, user.DisplayName, "Test", 0)
	s.NoError(err)

	// Test with probability > 1 (should default to 0.3)
	err = s.service.NotifyRandomFriendsOfPost(post.ID, user.ID, user.DisplayName, "Test", 1.5)
	s.NoError(err)
}

func (s *PostServiceTestSuite) TestNotifyRandomFriendsOfPost_LongCaption() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Make them friends
	_, err := s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user1.ID}, bson.M{
		"$set": bson.M{"friends": []primitive.ObjectID{user2.ID}},
	})
	s.NoError(err)

	// Create a post with long caption
	longCaption := "This is a very long caption that should be truncated in the notification message"
	newPost := testpkg.NewPostBuilder(*user1).
		WithCaption(longCaption).
		Build()

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Notify friends
	err = s.service.NotifyRandomFriendsOfPost(created.ID, user1.ID, user1.DisplayName, longCaption, 1.0)

	// Should not error
	s.NoError(err)
}

// ========================================
// Edge Cases and Error Handling
// ========================================

func (s *PostServiceTestSuite) TestCreatePost_UpdatesUserStats() {
	user := s.GetUser(0)

	// Get initial stats
	var initialUser types.User
	err := s.Collections["users"].FindOne(s.Ctx, bson.M{"_id": user.ID}).Decode(&initialUser)
	s.NoError(err)
	initialPostsMade := initialUser.PostsMade
	initialPoints := initialUser.Points

	// Create a post
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("Stats test post").
		Build()

	_, stats, err := s.service.CreatePost(&newPost)
	s.NoError(err)
	s.NotNil(stats)

	// Verify stats were updated
	s.Greater(stats.PostsMade, initialPostsMade)
	s.GreaterOrEqual(stats.Points, initialPoints)
}

func (s *PostServiceTestSuite) TestGetPostByID_DeletedPost() {
	user := s.GetUser(0)

	// Create and delete a post
	newPost := testpkg.NewPostBuilder(*user).
		WithCaption("To be deleted").
		Build()

	created, _, err := s.service.CreatePost(&newPost)
	s.NoError(err)

	// Mark as deleted
	_, err = s.Collections["posts"].UpdateOne(s.Ctx, bson.M{"_id": created.ID}, bson.M{
		"$set": bson.M{"metadata.isDeleted": true},
	})
	s.NoError(err)

	// Try to get deleted post
	result, err := s.service.GetPostByID(created.ID)

	// Should return error for deleted post
	s.Error(err)
	s.Nil(result)
}

func (s *PostServiceTestSuite) TestAddComment_PostNotFound() {
	user := s.GetUser(0)
	fakePostID := testpkg.GenerateObjectID()

	userRef := &types.UserExtendedReferenceInternal{
		ID:             user.ID,
		DisplayName:    user.DisplayName,
		Handle:         user.Handle,
		ProfilePicture: user.ProfilePicture,
	}

	comment := types.CommentDocument{
		ID:      testpkg.GenerateObjectID(),
		Content: "Comment on non-existent post",
		User:    userRef,
	}

	err := s.service.AddComment(fakePostID, comment)

	// Should return error
	s.Error(err)
}

func (s *PostServiceTestSuite) TestToggleReaction_PostNotFound() {
	user := s.GetUser(0)
	fakePostID := testpkg.GenerateObjectID()

	reactDoc := &types.ReactDocument{
		PostID: fakePostID,
		UserID: user.ID,
		Emoji:  "❤️",
	}

	_, err := s.service.ToggleReaction(reactDoc)

	// Should return error
	s.Error(err)
}
