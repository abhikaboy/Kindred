package Post

import (
	"context"
	"fmt"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreatePostHuma(ctx context.Context, input *CreatePostInput) (*CreatePostOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert string to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Get user info to populate the User field
	var user types.User
	err = h.service.Users.FindOne(context.Background(), bson.M{"_id": userObjID}).Decode(&user)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get user info", err)
	}

	doc := types.PostDocument{
		ID: primitive.NewObjectID(),
		User: types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
		Images:    input.Body.Images,
		Caption:   input.Body.Caption,
		Size:      input.Body.Size,
		Task:      input.Body.Task,
		Comments:  []types.CommentDocument{},
		Reactions: make(map[string][]primitive.ObjectID),
		Metadata:  types.NewPostMetadata(),
	}

	// Handle blueprint with isPublic flag
	if input.Body.BlueprintID != nil {
		blueprintID, err := primitive.ObjectIDFromHex(*input.Body.BlueprintID)
		if err != nil {
			return nil, huma.Error500InternalServerError("Invalid blueprint id", err)
		}

		blueprintIsPublic := false
		if input.Body.BlueprintIsPublic != nil {
			blueprintIsPublic = *input.Body.BlueprintIsPublic
		}

		doc.Blueprint = types.NewEnhancedBlueprintReference(blueprintID, blueprintIsPublic)
	}

	// Handle groups
	if len(input.Body.Groups) > 0 {
		var groupIDs []primitive.ObjectID
		for _, groupIDStr := range input.Body.Groups {
			groupID, err := primitive.ObjectIDFromHex(groupIDStr)
			if err != nil {
				return nil, huma.Error400BadRequest("Invalid group ID format", err)
			}
			groupIDs = append(groupIDs, groupID)
		}
		doc.Groups = groupIDs
	}

	doc.Metadata.IsPublic = input.Body.IsPublic

	createdPost, userStats, err := h.service.CreatePost(&doc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create post", err)
	}

	// Prepare response with user stats
	response := &CreatePostOutput{Body: *createdPost.ToAPI()}

	// Include user stats if available
	if userStats != nil {
		response.UserStats.PostsMade = userStats.PostsMade
		response.UserStats.Points = userStats.Points
	}

	return response, nil
}

func (h *Handler) GetPostsHuma(ctx context.Context, input *GetPostsInput) (*GetPostsOutput, error) {
	// Set defaults if not provided
	limit := input.Limit
	if limit <= 0 {
		limit = 8
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	posts, total, err := h.service.GetAllPosts(limit, offset)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get posts", err)
	}

	var apiPosts []types.PostDocumentAPI
	for _, post := range posts {
		apiPosts = append(apiPosts, *post.ToAPI())
	}

	output := &GetPostsOutput{}
	output.Body.Posts = apiPosts
	output.Body.Total = total
	output.Body.HasMore = offset+len(apiPosts) < total
	output.Body.NextOffset = offset + len(apiPosts)

	return output, nil
}

func (h *Handler) GetFriendsPostsHuma(ctx context.Context, input *GetFriendsPostsInput) (*GetFriendsPostsOutput, error) {
	// Extract user_id from context for authorization
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Set defaults if not provided
	limit := input.Limit
	if limit <= 0 {
		limit = 8
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	posts, total, err := h.service.GetFriendsPosts(userID, limit, offset)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get friends posts", err)
	}

	var apiPosts []types.PostDocumentAPI
	for _, post := range posts {
		apiPosts = append(apiPosts, *post.ToAPI())
	}

	output := &GetFriendsPostsOutput{}
	output.Body.Posts = apiPosts
	output.Body.Total = total
	output.Body.HasMore = offset+len(apiPosts) < total
	output.Body.NextOffset = offset + len(apiPosts)

	return output, nil
}

func (h *Handler) GetFeedHuma(ctx context.Context, input *GetFeedInput) (*GetFeedOutput, error) {
	// Extract user_id from context for authorization
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Set defaults if not provided
	limit := input.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	// New interleaving strategy: 14 posts + 3 profiles + 3 tasks per 20 items
	// This gives us 70% posts, 15% profiles, 15% tasks
	postsNeeded := int(float64(limit) * 0.70)
	if postsNeeded < 1 {
		postsNeeded = 1
	}
	profilesNeeded := int(float64(limit) * 0.15)
	tasksNeeded := limit - postsNeeded - profilesNeeded

	// Get friends posts
	posts, postsTotal, err := h.service.GetFriendsPosts(userID, postsNeeded, offset)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get feed", err)
	}

	// Get friends' public tasks (with user data from aggregation pipeline)
	tasks, tasksTotal, err := h.service.GetFriendsPublicTasks(userID, tasksNeeded, offset)
	if err != nil {
		tasks = []bson.M{} // Empty tasks if there's an error
	}

	// Get friends for profile encouragements
	profiles, profilesTotal, err := h.service.GetFriendsForProfileEncouragement(userID, profilesNeeded, offset)
	if err != nil {
		profiles = []types.SafeUser{} // Empty profiles if there's an error
	}

	// Adaptive fetching: balance posts, tasks, and profiles to fill the feed
	totalFetched := len(posts) + len(tasks) + len(profiles)
	if totalFetched < limit {
		shortage := limit - totalFetched
		
		// Try to fetch more posts first
		if len(posts) < postsNeeded {
			additionalPostsNeeded := shortage
			if additionalPostsNeeded > 0 {
				morePosts, _, err := h.service.GetFriendsPosts(userID, additionalPostsNeeded, len(posts))
				if err == nil {
					posts = append(posts, morePosts...)
					totalFetched = len(posts) + len(tasks) + len(profiles)
					shortage = limit - totalFetched
				}
			}
		}
		
		// Then try tasks if still short
		if shortage > 0 && len(tasks) < tasksNeeded {
			moreTasks, _, err := h.service.GetFriendsPublicTasks(userID, shortage, len(tasks))
			if err == nil {
				tasks = append(tasks, moreTasks...)
				totalFetched = len(posts) + len(tasks) + len(profiles)
				shortage = limit - totalFetched
			}
		}
		
		// Finally try profiles if still short
		if shortage > 0 && len(profiles) < profilesNeeded {
			moreProfiles, _, err := h.service.GetFriendsForProfileEncouragement(userID, shortage, len(profiles))
			if err == nil {
				profiles = append(profiles, moreProfiles...)
			}
		}
	}

	// Convert posts to API format
	var apiPosts []types.PostDocumentAPI
	for _, post := range posts {
		apiPosts = append(apiPosts, *post.ToAPI())
	}

	// Convert tasks to FeedTaskData
	var feedTasks []FeedTaskData
	for _, task := range tasks {
		// Extract user data from the task document
		var taskUser *types.UserExtendedReference
		if userDoc, ok := task["user"].(bson.M); ok {
			taskUser = &types.UserExtendedReference{
				ID:             userDoc["_id"].(primitive.ObjectID).Hex(),
				Handle:         userDoc["handle"].(string),
				DisplayName:    userDoc["display_name"].(string),
				ProfilePicture: userDoc["profile_picture"].(string),
			}
		}

		feedTask := FeedTaskData{
			ID:            task["_id"].(primitive.ObjectID).Hex(),
			Content:       task["content"].(string),
			Priority:      int(task["priority"].(int32)),
			Value:         task["value"].(float64),
			Public:        task["public"].(bool),
			Timestamp:     task["timestamp"].(primitive.DateTime).Time().Format(time.RFC3339),
			CategoryID:    task["categoryId"].(primitive.ObjectID).Hex(),
			CategoryName:  task["categoryName"].(string),
			WorkspaceName: task["workspaceName"].(string),
			User:          taskUser,
		}
		feedTasks = append(feedTasks, feedTask)
	}

	// Convert profiles to FeedProfileData
	var feedProfiles []FeedProfileData
	for _, profile := range profiles {
		feedProfile := FeedProfileData{
			User: &types.UserExtendedReference{
				ID:             profile.ID.Hex(),
				Handle:         profile.Handle,
				DisplayName:    profile.DisplayName,
				ProfilePicture: profile.ProfilePicture,
			},
			TasksComplete: profile.TasksComplete,
			Streak:        profile.Streak,
			Points:        profile.Points,
		}
		feedProfiles = append(feedProfiles, feedProfile)
	}

	// Interleave posts, profiles, and tasks
	// Pattern: Post → Profile (2nd position) → Posts and Tasks/Profiles interspersed
	var feedItems []FeedItem
	postIdx := 0
	taskIdx := 0
	profileIdx := 0

	// Add first post if available
	if postIdx < len(apiPosts) && len(feedItems) < limit {
		post := apiPosts[postIdx]
		feedItems = append(feedItems, FeedItem{
			Type: "post",
			Post: &post,
		})
		postIdx++
	}

	// Add first profile as 2nd item if available (per user requirement)
	if profileIdx < len(feedProfiles) && len(feedItems) < limit {
		profile := feedProfiles[profileIdx]
		feedItems = append(feedItems, FeedItem{
			Type:    "profile",
			Profile: &profile,
		})
		profileIdx++
	}

	// Continue interleaving: prioritize posts, then alternate tasks and profiles
	// Pattern after first 2: Posts (4-5) → Task → Posts (4-5) → Profile → repeat
	postsInBatch := 0
	for len(feedItems) < limit && (postIdx < len(apiPosts) || taskIdx < len(feedTasks) || profileIdx < len(feedProfiles)) {
		// Add posts (4-5 at a time)
		for i := 0; i < 5 && postIdx < len(apiPosts) && len(feedItems) < limit; i++ {
			post := apiPosts[postIdx]
			feedItems = append(feedItems, FeedItem{
				Type: "post",
				Post: &post,
			})
			postIdx++
			postsInBatch++
		}

		// After a batch of posts, alternate between adding a task and a profile
		if postsInBatch >= 4 {
			// Add task if available
			if taskIdx < len(feedTasks) && len(feedItems) < limit {
				task := feedTasks[taskIdx]
				feedItems = append(feedItems, FeedItem{
					Type: "task",
					Task: &task,
				})
				taskIdx++
			}
			
			// Reset batch counter
			postsInBatch = 0
			
			// Add profile if available after another small batch
			if profileIdx < len(feedProfiles) && len(feedItems) < limit && postIdx < len(apiPosts) {
				// Add a few more posts first
				for i := 0; i < 3 && postIdx < len(apiPosts) && len(feedItems) < limit; i++ {
					post := apiPosts[postIdx]
					feedItems = append(feedItems, FeedItem{
						Type: "post",
						Post: &post,
					})
					postIdx++
				}
				
				// Then add profile
				profile := feedProfiles[profileIdx]
				feedItems = append(feedItems, FeedItem{
					Type:    "profile",
					Profile: &profile,
				})
				profileIdx++
			}
		}
	}

	// Fill remaining slots if we haven't reached the limit
	for len(feedItems) < limit {
		added := false
		
		if postIdx < len(apiPosts) {
			post := apiPosts[postIdx]
			feedItems = append(feedItems, FeedItem{
				Type: "post",
				Post: &post,
			})
			postIdx++
			added = true
		} else if taskIdx < len(feedTasks) {
			task := feedTasks[taskIdx]
			feedItems = append(feedItems, FeedItem{
				Type: "task",
				Task: &task,
			})
			taskIdx++
			added = true
		} else if profileIdx < len(feedProfiles) {
			profile := feedProfiles[profileIdx]
			feedItems = append(feedItems, FeedItem{
				Type:    "profile",
				Profile: &profile,
			})
			profileIdx++
			added = true
		}
		
		if !added {
			break
		}
	}

	// Calculate total items and pagination
	totalItems := postsTotal + tasksTotal + profilesTotal
	hasMore := offset+len(feedItems) < totalItems

	output := &GetFeedOutput{}
	output.Body.Items = feedItems
	output.Body.Total = totalItems
	output.Body.HasMore = hasMore
	output.Body.NextOffset = offset + len(feedItems)

	return output, nil
}

func (h *Handler) GetUserGroupsHuma(ctx context.Context, input *GetUserGroupsInput) (*GetUserGroupsOutput, error) {
	// Extract user_id from context for authorization
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	groups, err := h.service.GetUserGroups(userID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get user groups", err)
	}

	var apiGroups []types.GroupDocumentAPI
	for _, group := range groups {
		apiGroups = append(apiGroups, *group.ToAPI())
	}

	output := &GetUserGroupsOutput{}
	output.Body.Groups = apiGroups

	return output, nil
}

func (h *Handler) GetPostsByBlueprintHuma(ctx context.Context, input *GetPostsByBlueprintInput) (*GetPostsByBlueprintOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	blueprintID, err := primitive.ObjectIDFromHex(input.BlueprintID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid blueprint ID format", err)
	}

	posts, err := h.service.GetPostsByBlueprint(blueprintID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get posts by blueprint", err)
	}

	var apiPosts []types.PostDocumentAPI
	for _, post := range posts {
		apiPosts = append(apiPosts, *post.ToAPI())
	}

	output := &GetPostsByBlueprintOutput{}
	output.Body.Posts = apiPosts

	return output, nil
}

func (h *Handler) GetPostHuma(ctx context.Context, input *GetPostInput) (*GetPostOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	post, err := h.service.GetPostByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Post not found", err)
	}

	return &GetPostOutput{Body: *post.ToAPI()}, nil
}

func (h *Handler) GetUserPostsHuma(ctx context.Context, input *GetUserPostsInput) (*GetUserPostsOutput, error) {
	// Extract user_id from context for authorization
	viewerIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert viewer ID to ObjectID
	viewerID, err := primitive.ObjectIDFromHex(viewerIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid viewer ID format", err)
	}

	// Convert profile user ID to ObjectID
	profileUserID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Check relationship between viewer and profile user
	canView, err := h.service.CheckRelationship(viewerID, profileUserID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to check relationship", err)
	}

	// If not authorized to view, return empty posts array (similar to tasks behavior)
	if !canView {
		return &GetUserPostsOutput{Body: []types.PostDocument{}}, nil
	}

	// User is authorized (friend or self), fetch their posts
	posts, err := h.service.GetUserPosts(profileUserID)
	if err != nil {
		return nil, huma.Error404NotFound("Posts not found", err)
	}

	return &GetUserPostsOutput{Body: posts}, nil
}

func (h *Handler) UpdatePostHuma(ctx context.Context, input *UpdatePostInput) (*UpdatePostOutput, error) {
	// Extract user_id from context for authorization
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	post, err := h.service.GetPostByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Post not found", err)
	}

	if post.User.ID != userObjID {
		return nil, huma.Error403Forbidden("You can only edit your own posts")
	}

	if err := h.service.UpdatePartialPost(id, input.Body); err != nil {
		return nil, huma.Error500InternalServerError("Failed to update post", err)
	}

	resp := &UpdatePostOutput{}
	resp.Body.Message = "Post updated successfully"
	return resp, nil
}

func (h *Handler) DeletePostHuma(ctx context.Context, input *DeletePostInput) (*DeletePostOutput, error) {
	// Extract user_id from context for authorization
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid post ID format", err)
	}

	post, err := h.service.GetPostByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Post not found", err)
	}

	if post.User.ID != userObjID {
		return nil, huma.Error403Forbidden("You can only delete your own posts")
	}

	if err := h.service.DeletePost(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete post", err)
	}

	resp := &DeletePostOutput{}
	resp.Body.Message = "Post deleted successfully"
	return resp, nil
}

func (h *Handler) AddCommentHuma(ctx context.Context, input *AddCommentInput) (*AddCommentOutput, error) {
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	postID, err := primitive.ObjectIDFromHex(input.PostID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid post ID format", err)
	}

	var user types.User
	err = h.service.Users.FindOne(context.Background(), bson.M{"_id": userObjID}).Decode(&user)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get user info", err)
	}

	doc := types.CommentDocument{
		ID: primitive.NewObjectID(),
		User: &types.UserExtendedReferenceInternal{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
		Content:  input.Body.Content,
		Metadata: types.NewCommentMetadata(),
	}

	if input.Body.ParentID != nil {
		parentID, err := primitive.ObjectIDFromHex(*input.Body.ParentID)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid parent id", err)
		}
		doc.ParentID = &parentID
	}

	if err := h.service.AddComment(postID, doc); err != nil {
		return nil, huma.Error500InternalServerError("Failed to add comment", err)
	}

	output := &AddCommentOutput{}
	output.Body.Message = "Comment added successfully"
	output.Body.Comment = *doc.ToAPI()
	return output, nil
}

func (h *Handler) ToggleReactionHuma(ctx context.Context, input *AddReactionInput) (*AddReactionOutput, error) {
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Unauthorized", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	postObjID, err := primitive.ObjectIDFromHex(input.PostID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid post ID", err)
	}

	reaction := &types.ReactDocument{
		UserID: userObjID,
		PostID: postObjID,
		Emoji:  input.Body.Emoji,
	}

	wasAdded, err := h.service.ToggleReaction(reaction)

	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to process reaction", err)
	}

	var message string
	if wasAdded {
		message = "Reaction added successfully"
	} else {
		message = "Reaction removed successfully"
	}

	response := &AddReactionOutput{}
	response.Body.Message = message
	response.Body.Added = wasAdded

	return response, nil

}
func (h *Handler) DeleteCommentHuma(ctx context.Context, input *DeleteCommentInput) (*DeleteCommentOutput, error) {
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	postID, err := primitive.ObjectIDFromHex(input.PostID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid post ID format", err)
	}

	commentID, err := primitive.ObjectIDFromHex(input.CommentID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid comment ID format", err)
	}

	post, err := h.service.GetPostByID(postID)
	if err != nil {
		return nil, huma.Error404NotFound("Post not found", err)
	}

	var canDelete bool
	var foundComment *types.CommentDocument
	for _, comment := range post.Comments {
		if comment.ID == commentID {
			foundComment = &comment

			canDelete = comment.User.ID == userObjID || post.User.ID == userObjID
			break
		}
	}

	if foundComment == nil {
		return nil, huma.Error404NotFound("Comment not found")
	}

	if !canDelete {
		return nil, huma.Error403Forbidden("You can only delete your own comments or comments on your posts")
	}

	if err := h.service.DeleteComment(postID, commentID); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete comment", err)
	}

	resp := &DeleteCommentOutput{}
	resp.Body.Message = "Comment deleted successfully"
	return resp, nil
}
