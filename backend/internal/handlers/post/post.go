package Post

import (
	"context"
	"fmt"

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
		Task:      input.Body.Task,
		Comments:  []types.CommentDocument{},
		Reactions: make(map[string][]primitive.ObjectID),
		Metadata:  types.NewPostMetadata(),
	}

	if input.Body.BlueprintID != nil {
		blueprintID, err := primitive.ObjectIDFromHex(*input.Body.BlueprintID)
		if err != nil {
			return nil, huma.Error500InternalServerError("Invalid blueprint id", err)
		}
		doc.Blueprint = types.NewBlueprintReference(blueprintID)
	}

	doc.Metadata.IsPublic = input.Body.IsPublic

	createdPost, err := h.service.CreatePost(&doc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create post", err)
	}

	// Return API version
	return &CreatePostOutput{Body: *createdPost.ToAPI()}, nil
}

func (h *Handler) GetPostsHuma(ctx context.Context, input *GetPostsInput) (*GetPostsOutput, error) {
	posts, err := h.service.GetAllPosts()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get posts", err)
	}

	var apiPosts []types.PostDocumentAPI
	for i, post := range posts {
		fmt.Printf("🔄 DEBUG: Converting post %d (ID: %s)\n", i, post.ID.Hex())
		apiPosts = append(apiPosts, *post.ToAPI())
	}

	output := &GetPostsOutput{}
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
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	posts, err := h.service.GetUserPosts(userObjID)
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

	for i, comment := range post.Comments {
		fmt.Printf("    [%d] ID: %s, User: %s, Content: %s\n",
			i, comment.ID.Hex(), comment.User.ID.Hex(), comment.Content)
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
