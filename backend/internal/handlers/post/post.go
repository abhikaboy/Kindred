package Post

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
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
		slog.Error("failed to get user info for post creation", "userId", user_id, "error", err)
		return nil, huma.Error500InternalServerError("Unable to get user info. Please try again.", err)
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
		Dual:      input.Body.Dual,
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
			return nil, huma.Error400BadRequest("Invalid blueprint ID format", err)
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

	// Collect tag candidates: explicit + encourager auto-tag.
	var tagCandidates []primitive.ObjectID
	for _, m := range input.Body.TaggedUsers {
		if objID, err := primitive.ObjectIDFromHex(m.ID); err == nil {
			tagCandidates = append(tagCandidates, objID)
		}
	}
	if input.Body.Task != nil && h.service.EncouragementService != nil {
		taskID := input.Body.Task.ID
		encs, encErr := h.service.EncouragementService.GetEncouragementsByTaskAndReceiver(taskID, userObjID)
		if encErr != nil {
			slog.Warn("Failed to fetch encouragements for auto-tag", "task_id", taskID, "err", encErr)
		} else {
			for _, e := range encs {
				tagCandidates = append(tagCandidates, e.Sender.ID)
			}
		}
	}
	if len(tagCandidates) > 0 {
		resolved, resolveErr := h.service.ResolveTaggedUsers(ctx, userObjID, tagCandidates)
		if resolveErr != nil {
			slog.Warn("Failed to resolve tagged users", "err", resolveErr)
		} else {
			doc.TaggedUsers = resolved
		}
	}

	createdPost, userStats, err := h.service.CreatePost(&doc)
	if err != nil {
		slog.Error("failed to create post", "userId", user_id, "error", err)
		return nil, huma.Error500InternalServerError("Unable to create post. Please try again.", err)
	}

	// Increment Share ring synchronously so the response carries the delta.
	// NotifyAllRingsClosed is already async (2-minute delayed).
	var ringDelta *rings.RingDelta
	if h.service.RingService != nil {
		tz := auth.GetTimezoneOrDefault(ctx)
		_, delta, err := h.service.RingService.IncrementRing(ctx, userObjID, tz, rings.RingShare)
		if err != nil {
			slog.Error("Failed to increment Share ring on post creation", "user_id", userObjID.Hex(), "error", err)
		} else {
			ringDelta = delta
			if delta.JustClosedAll {
				h.service.RingService.NotifyAllRingsClosed(userObjID)
			}
		}
	}

	// Prepare response with user stats
	response := &CreatePostOutput{}
	response.Body.PostDocumentAPI = *createdPost.ToAPI()
	response.Body.RingDelta = ringDelta

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
		slog.Error("failed to get posts", "limit", limit, "offset", offset, "error", err)
		return nil, huma.Error500InternalServerError("Unable to get posts. Please try again.", err)
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
		slog.Error("failed to get friends posts", "userId", userIDStr, "error", err)
		return nil, huma.Error500InternalServerError("Unable to get friends posts. Please try again.", err)
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

	// Fetch more items than requested to account for interleaving
	// We want to interleave 1 task per 5 posts, so we need roughly 83% posts and 17% tasks
	postsNeeded := int(float64(limit) * 0.83)
	if postsNeeded < 1 {
		postsNeeded = 1
	}
	tasksNeeded := limit - postsNeeded

	// Get friends posts
	posts, postsTotal, err := h.service.GetFriendsPosts(userID, postsNeeded, offset)
	if err != nil {
		slog.Error("failed to get feed posts", "userId", userIDStr, "error", err)
		return nil, huma.Error500InternalServerError("Unable to get feed. Please try again.", err)
	}

	// Get friends' public tasks (with user data from aggregation pipeline)
	tasks, tasksTotal, err := h.service.GetFriendsPublicTasks(userID, tasksNeeded, offset)
	if err != nil {
		tasks = []bson.M{} // Empty tasks if there's an error
	}

	// Adaptive fetching: if we got fewer posts than expected, fetch more tasks to fill the feed
	if len(posts) < postsNeeded && len(tasks) < limit {
		additionalTasksNeeded := limit - len(posts) - len(tasks)
		if additionalTasksNeeded > 0 {
			moreTasks, _, err := h.service.GetFriendsPublicTasks(userID, additionalTasksNeeded, len(tasks))
			if err == nil {
				tasks = append(tasks, moreTasks...)
			}
		}
	}

	// Adaptive fetching: if we got fewer tasks than expected, fetch more posts to fill the feed
	if len(tasks) < tasksNeeded && len(posts) < limit {
		additionalPostsNeeded := limit - len(posts) - len(tasks)
		if additionalPostsNeeded > 0 {
			morePosts, _, err := h.service.GetFriendsPosts(userID, additionalPostsNeeded, len(posts))
			if err == nil {
				posts = append(posts, morePosts...)
			}
		}
	}

	// Get friends' ring closure events
	ringClosures, ringsTotal, err := h.service.GetFriendsRingClosures(userID, 5, offset/4)
	if err != nil {
		ringClosures = []FeedRingsClosedData{}
		ringsTotal = 0
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
			if id, ok := userDoc["_id"].(primitive.ObjectID); ok {
				if handle, ok := userDoc["handle"].(string); ok {
					if displayName, ok := userDoc["display_name"].(string); ok {
						if profilePicture, ok := userDoc["profile_picture"].(string); ok {
							taskUser = &types.UserExtendedReference{
								ID:             id.Hex(),
								Handle:         handle,
								DisplayName:    displayName,
								ProfilePicture: profilePicture,
							}
						}
					}
				}
			}
		}

		// Extract task fields with type assertions
		taskID, ok := task["_id"].(primitive.ObjectID)
		if !ok {
			continue
		}
		content, ok := task["content"].(string)
		if !ok {
			continue
		}
		priority, ok := task["priority"].(int32)
		if !ok {
			continue
		}
		value, ok := task["value"].(float64)
		if !ok {
			continue
		}
		public, ok := task["public"].(bool)
		if !ok {
			continue
		}
		timestamp, ok := task["timestamp"].(primitive.DateTime)
		if !ok {
			continue
		}
		categoryID, ok := task["categoryId"].(primitive.ObjectID)
		if !ok {
			continue
		}
		categoryName, ok := task["categoryName"].(string)
		if !ok {
			continue
		}
		workspaceName, ok := task["workspaceName"].(string)
		if !ok {
			continue
		}

		feedTask := FeedTaskData{
			ID:            taskID.Hex(),
			Content:       content,
			Priority:      int(priority),
			Value:         value,
			Public:        public,
			Timestamp:     timestamp.Time().Format(time.RFC3339),
			CategoryID:    categoryID.Hex(),
			CategoryName:  categoryName,
			WorkspaceName: workspaceName,
			User:          taskUser,
		}
		feedTasks = append(feedTasks, feedTask)
	}

	// Build timestamped items for chronological merge
	type timestampedItem struct {
		feedItem FeedItem
		time     time.Time
	}

	var allItems []timestampedItem

	for i := range apiPosts {
		post := apiPosts[i]
		allItems = append(allItems, timestampedItem{
			feedItem: FeedItem{Type: "post", Post: &post},
			time:     post.Metadata.CreatedAt,
		})
	}

	for i := range feedTasks {
		task := feedTasks[i]
		t, _ := time.Parse(time.RFC3339, task.Timestamp)
		allItems = append(allItems, timestampedItem{
			feedItem: FeedItem{Type: "task", Task: &task},
			time:     t,
		})
	}

	for i := range ringClosures {
		rc := ringClosures[i]
		t, _ := time.Parse(time.RFC3339, rc.Timestamp)
		allItems = append(allItems, timestampedItem{
			feedItem: FeedItem{Type: "rings_closed", RingsClosed: &rc},
			time:     t,
		})
	}

	// Sort by time descending (newest first)
	sort.Slice(allItems, func(i, j int) bool {
		return allItems[i].time.After(allItems[j].time)
	})

	// Take up to limit items
	var feedItems []FeedItem
	for i := 0; i < len(allItems) && i < limit; i++ {
		feedItems = append(feedItems, allItems[i].feedItem)
	}

	// Calculate total items and pagination
	totalItems := postsTotal + tasksTotal + ringsTotal
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
		slog.Error("failed to get user groups", "userId", userIDStr, "error", err)
		return nil, huma.Error500InternalServerError("Unable to get user groups. Please try again.", err)
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
		slog.Error("failed to get posts by blueprint", "blueprintId", input.BlueprintID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to get posts by blueprint. Please try again.", err)
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
		slog.Error("failed to check relationship", "viewerId", viewerIDStr, "profileUserId", input.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to check relationship. Please try again.", err)
	}

	// If not authorized to view, return empty paginated response (similar to tasks behavior)
	if !canView {
		output := &GetUserPostsOutput{}
		output.Body.Posts = []types.PostDocumentAPI{}
		output.Body.Total = 0
		output.Body.HasMore = false
		output.Body.NextOffset = 0
		return output, nil
	}

	// Set defaults if not provided
	limit := input.Limit
	if limit <= 0 {
		limit = 18
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	// User is authorized (friend or self), fetch their posts
	posts, total, err := h.service.GetUserPosts(profileUserID, limit, offset)
	if err != nil {
		return nil, huma.Error404NotFound("Posts not found", err)
	}

	var apiPosts []types.PostDocumentAPI
	for _, post := range posts {
		apiPosts = append(apiPosts, *post.ToAPI())
	}

	output := &GetUserPostsOutput{}
	output.Body.Posts = apiPosts
	output.Body.Total = total
	output.Body.HasMore = offset+len(apiPosts) < total
	output.Body.NextOffset = offset + len(apiPosts)

	return output, nil
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
		slog.Error("failed to update post", "userId", user_id, "postId", input.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to update post. Please try again.", err)
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
		slog.Error("failed to delete post", "userId", user_id, "postId", input.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to delete post. Please try again.", err)
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
		slog.Error("failed to get user info for comment", "userId", user_id, "postId", input.PostID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to get user info. Please try again.", err)
	}

	// Parse mentions
	var mentions []types.MentionReference
	if input.Body.Mentions != nil {
		for _, m := range input.Body.Mentions {
			mentionID, err := primitive.ObjectIDFromHex(m.ID)
			if err != nil {
				continue // Skip invalid IDs
			}
			mentions = append(mentions, types.MentionReference{
				ID:     mentionID,
				Handle: m.Handle,
			})
		}
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
		Mentions: mentions,
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
		slog.Error("failed to add comment", "userId", user_id, "postId", input.PostID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to add comment. Please try again.", err)
	}

	output := &AddCommentOutput{}
	output.Body.Message = "Comment added successfully"
	output.Body.Comment = *doc.ToAPI()
	return output, nil
}

func (h *Handler) ToggleReactionHuma(ctx context.Context, input *AddReactionInput) (*AddReactionOutput, error) {
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
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
		slog.Error("failed to process reaction", "userId", user_id, "postId", input.PostID, "emoji", input.Body.Emoji, "error", err)
		return nil, huma.Error500InternalServerError("Unable to process reaction. Please try again.", err)
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
		slog.Error("failed to delete comment", "userId", user_id, "postId", input.PostID, "commentId", input.CommentID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to delete comment. Please try again.", err)
	}

	resp := &DeleteCommentOutput{}
	resp.Body.Message = "Comment deleted successfully"
	return resp, nil
}
