package Category

import (
	"context"
	"log/slog"
	"net/url"

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

	// Extract user_id from context (set by auth middleware)
	user_id_str, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id, err := primitive.ObjectIDFromHex(user_id_str)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format for UserId", err)
	}

	_, err = h.service.UpdatePartialCategory(id, input.Body, user_id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update category", err)
	}

	// Return a simple success response
	resp := &UpdateCategoryOutput{}
	resp.Body.Message = "Category updated successfully"
	return resp, nil
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
	// URL decode the workspace name since it comes from the path parameter
	workspaceName, err := url.QueryUnescape(input.Name)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid workspace name encoding", err)
	}

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

func (h *Handler) RenameWorkspace(ctx context.Context, input *RenameWorkspaceInput) (*RenameWorkspaceOutput, error) {
	// URL decode the old workspace name since it comes from the path parameter
	oldWorkspaceName, err := url.QueryUnescape(input.OldName)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid workspace name encoding", err)
	}
	newWorkspaceName := input.Body.NewName

	// Extract user_id from context (set by auth middleware)
	user_id_str, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id, err := primitive.ObjectIDFromHex(user_id_str)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format for UserId", err)
	}

	slog.Info("Renaming workspace from " + oldWorkspaceName + " to " + newWorkspaceName)

	err = h.service.RenameWorkspace(oldWorkspaceName, newWorkspaceName, user_id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to rename workspace", err)
	}

	resp := &RenameWorkspaceOutput{}
	resp.Body.Message = "Workspace renamed successfully"
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

func (h *Handler) SetupDefaultWorkspace(ctx context.Context, input *SetupDefaultWorkspaceInput) (*SetupDefaultWorkspaceOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Create the Kindred Guide workspace with multiple categories
	workspaceName := "🌺 Kindred Guide"
	now := xutils.NowUTC()

	// Define categories with their respective tasks
	categories := []struct {
		name  string
		tasks []task.TaskDocument
	}{
		{
			name: "Starting",
			tasks: []task.TaskDocument{
				{
					ID:         primitive.NewObjectID(),
					Content:    "Swipe to mark a task as complete",
					Priority:   1,
					Value:      1,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     user_id_obj,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Tap to view details about a task",
					Priority:   1,
					Value:      1,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     user_id_obj,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Click the plus sign next to category to create a new task",
					Priority:   1,
					Value:      1,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     user_id_obj,
				},
			},
		},
		{
			name: "Tasks",
			tasks: []task.TaskDocument{
				{
					ID:         primitive.NewObjectID(),
					Content:    "Swipe to make your first post",
					Priority:   2,
					Value:      2,
					Active:     true,
					Public:     true,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     user_id_obj,
				},
			},
		},
		{
			name: "Social",
			tasks: []task.TaskDocument{
				{
					ID:         primitive.NewObjectID(),
					Content:    "Add your closest friends! 🫶🫶",
					Priority:   2,
					Value:      3,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     user_id_obj,
				},
				{
					ID:         primitive.NewObjectID(),
					Content:    "Share Kindred! 💜",
					Priority:   2,
					Value:      3,
					Active:     true,
					Public:     false,
					Recurring:  false,
					Timestamp:  now,
					LastEdited: now,
					StartDate:  &now,
					UserID:     user_id_obj,
				},
			},
		},
	}

	// Create each category with its tasks
	var createdCategories []CategoryDocument
	totalTasks := 0

	for _, cat := range categories {
		categoryDoc := CategoryDocument{
			ID:            primitive.NewObjectID(),
			Name:          cat.name,
			WorkspaceName: workspaceName,
			User:          user_id_obj,
			Tasks:         cat.tasks,
			LastEdited:    now,
		}

		// Set CategoryID for all tasks in this category
		for i := range categoryDoc.Tasks {
			categoryDoc.Tasks[i].CategoryID = categoryDoc.ID
		}

		_, err = h.service.CreateCategory(&categoryDoc)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to create category",
				slog.String("categoryName", cat.name),
				slog.String("error", err.Error()))
			continue // Continue creating other categories even if one fails
		}

		createdCategories = append(createdCategories, categoryDoc)
		totalTasks += len(cat.tasks)
	}

	if len(createdCategories) == 0 {
		return nil, huma.Error500InternalServerError("Failed to create any categories", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Default workspace created with multiple categories",
		slog.String("userId", user_id),
		slog.String("workspace", workspaceName),
		slog.Int("categoriesCreated", len(createdCategories)),
		slog.Int("totalTasks", totalTasks))

	// Return the first category as the response
	return &SetupDefaultWorkspaceOutput{Body: createdCategories[0]}, nil
}
