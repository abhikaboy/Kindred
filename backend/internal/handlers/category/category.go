package Category

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
	"github.com/go-playground/validator/v10"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateCategory(ctx context.Context, input *CreateCategoryInput) (*CreateCategoryOutput, error) {
	validate := validator.New()
	if err := validate.Struct(input.Body); err != nil {
		return nil, huma.Error400BadRequest("Validation failed", err)
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	doc := CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          input.Body.Name,
		WorkspaceName: input.Body.WorkspaceName,
		User:          user_id_obj,
		Tasks:         make([]task.TaskDocument, 0),
		LastEdited:    xutils.NowUTC(),
	}

	_, err = h.service.CreateCategory(&doc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create Category", err)
	}

	return &CreateCategoryOutput{Body: doc}, nil
}

func (h *Handler) GetCategories(ctx context.Context, input *GetCategoriesInput) (*GetCategoriesOutput, error) {
	Categories, err := h.service.GetAllCategories()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch categories", err)
	}

	return &GetCategoriesOutput{Body: Categories}, nil
}

func (h *Handler) GetCategory(ctx context.Context, input *GetCategoryInput) (*GetCategoryOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	Category, err := h.service.GetCategoryByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Category not found", err)
	}

	return &GetCategoryOutput{Body: *Category}, nil
}

func (h *Handler) GetCategoriesByUser(ctx context.Context, input *GetCategoriesByUserInput) (*GetCategoriesByUserOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	categories, err := h.service.GetCategoriesByUser(id)
	if err != nil {
		return nil, huma.Error404NotFound("No categories found", err)
	}

	return &GetCategoriesByUserOutput{Body: categories}, nil
}

func (h *Handler) UpdatePartialCategory(ctx context.Context, input *UpdateCategoryInput) (*UpdateCategoryOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format for CategoryId", err)
	}

	results, err := h.service.UpdatePartialCategory(id, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update category", err)
	}

	return &UpdateCategoryOutput{Body: *results}, nil
}

func (h *Handler) DeleteCategory(ctx context.Context, input *DeleteCategoryInput) (*DeleteCategoryOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format for CategoryId", err)
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format for UserId", err)
	}

	if err := h.service.DeleteCategory(user_id_obj, id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete category", err)
	}

	resp := &DeleteCategoryOutput{}
	resp.Body.Message = "Category deleted successfully"
	return resp, nil
}

func (h *Handler) DeleteWorkspace(ctx context.Context, input *DeleteWorkspaceInput) (*DeleteWorkspaceOutput, error) {
	workspaceName := input.Name

	// Extract user_id from context (set by auth middleware)
	user_id_str, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id, err := primitive.ObjectIDFromHex(user_id_str)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format for UserId", err)
	}

	slog.Info("Deleting " + workspaceName)

	err = h.service.DeleteWorkspace(workspaceName, user_id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete workspace", err)
	}

	resp := &DeleteWorkspaceOutput{}
	resp.Body.Message = "Workspace deleted successfully"
	return resp, nil
}

func (h *Handler) GetWorkspaces(ctx context.Context, input *GetWorkspacesInput) (*GetWorkspacesOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id_str, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id_str)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format for UserId", err)
	}

	workspaces, err := h.service.GetWorkspaces(user_id_obj)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch workspaces", err)
	}

	return &GetWorkspacesOutput{Body: workspaces}, nil
}
