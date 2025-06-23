package Post

import (
	"context"
	"fmt"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
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

	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	doc := PostDocument{
		ID:        primitive.NewObjectID(),
		Field1:    input.Body.Field1,
		Field2:    input.Body.Field2,
		Picture:   input.Body.Picture,
		Timestamp: xutils.NowUTC(),
	}

	_, err = h.service.CreatePost(&doc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create post", err)
	}

	return &CreatePostOutput{Body: doc}, nil
}

func (h *Handler) GetPostsHuma(ctx context.Context, input *GetPostsInput) (*GetPostsOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	posts, err := h.service.GetAllPosts()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get posts", err)
	}

	return &GetPostsOutput{Body: posts}, nil
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

	return &GetPostOutput{Body: *post}, nil
}

func (h *Handler) UpdatePostHuma(ctx context.Context, input *UpdatePostInput) (*UpdatePostOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
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
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeletePost(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete post", err)
	}

	resp := &DeletePostOutput{}
	resp.Body.Message = "Post deleted successfully"
	return resp, nil
}
