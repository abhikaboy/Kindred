package Category

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for category operations

// Create Category
type CreateCategoryInput struct {
	Authorization string               `header:"Authorization" required:"true"`
	Body          CreateCategoryParams `json:"body"`
}

type CreateCategoryOutput struct {
	Body CategoryDocument `json:"body"`
}

// Get Categories (all)
type GetCategoriesInput struct{}

type GetCategoriesOutput struct {
	Body []CategoryDocument `json:"body"`
}

// Get Category by ID
type GetCategoryInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetCategoryOutput struct {
	Body CategoryDocument `json:"body"`
}

// Get Categories by User
type GetCategoriesByUserInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetCategoriesByUserOutput struct {
	Body []WorkspaceResult `json:"body"`
}

// Get Workspaces
type GetWorkspacesInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetWorkspacesOutput struct {
	Body []WorkspaceResult `json:"body"`
}

// Update Category
type UpdateCategoryInput struct {
	Authorization string                 `header:"Authorization" required:"true"`
	ID            string                 `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateCategoryDocument `json:"body"`
}

type UpdateCategoryOutput struct {
	Body CategoryDocument `json:"body"`
}

// Delete Category
type DeleteCategoryInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteCategoryOutput struct {
	Body struct {
		Message string `json:"message" example:"Category deleted successfully"`
	}
}

// Delete Workspace
type DeleteWorkspaceInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Name          string `path:"name" example:"workspace1"`
}

type DeleteWorkspaceOutput struct {
	Body struct {
		Message string `json:"message" example:"Workspace deleted successfully"`
	}
}

// Rename Workspace
type RenameWorkspaceInput struct {
	Authorization string `header:"Authorization" required:"true"`
	OldName       string `path:"oldName" example:"old-workspace"`
	Body          struct {
		NewName string `json:"newName" example:"new-workspace"`
	}
}

type RenameWorkspaceOutput struct {
	Body struct {
		Message string `json:"message" example:"Workspace renamed successfully"`
	}
}

// Operation registrations

func RegisterCreateCategoryOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-category",
		Method:      http.MethodPost,
		Path:        "/v1/user/categories",
		Summary:     "Create a new category",
		Description: "Create a new category for the authenticated user",
		Tags:        []string{"categories"},
	}, handler.CreateCategory)
}

func RegisterGetCategoriesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-categories",
		Method:      http.MethodGet,
		Path:        "/v1/categories",
		Summary:     "Get all categories",
		Description: "Retrieve all categories",
		Tags:        []string{"categories"},
	}, handler.GetCategories)
}

func RegisterGetCategoryOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-category",
		Method:      http.MethodGet,
		Path:        "/v1/categories/{id}",
		Summary:     "Get category by ID",
		Description: "Retrieve a specific category by its ID",
		Tags:        []string{"categories"},
	}, handler.GetCategory)
}

func RegisterGetCategoriesByUserOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-categories-by-user",
		Method:      http.MethodGet,
		Path:        "/v1/user/categories/{id}",
		Summary:     "Get categories by user ID",
		Description: "Retrieve all categories for a specific user",
		Tags:        []string{"categories"},
	}, handler.GetCategoriesByUser)
}

func RegisterGetWorkspacesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-workspaces",
		Method:      http.MethodGet,
		Path:        "/v1/user/workspaces",
		Summary:     "Get user workspaces",
		Description: "Retrieve all workspaces for the authenticated user",
		Tags:        []string{"categories"},
	}, handler.GetWorkspaces)
}

func RegisterUpdateCategoryOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-category",
		Method:      http.MethodPatch,
		Path:        "/v1/user/categories/{id}",
		Summary:     "Update category",
		Description: "Update a category for the authenticated user",
		Tags:        []string{"categories"},
	}, handler.UpdatePartialCategory)
}

func RegisterDeleteCategoryOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-category",
		Method:      http.MethodDelete,
		Path:        "/v1/user/categories/{id}",
		Summary:     "Delete category",
		Description: "Delete a category for the authenticated user",
		Tags:        []string{"categories"},
	}, handler.DeleteCategory)
}

func RegisterDeleteWorkspaceOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-workspace",
		Method:      http.MethodDelete,
		Path:        "/v1/user/categories/workspace/{name}",
		Summary:     "Delete workspace",
		Description: "Delete a workspace and all its categories",
		Tags:        []string{"categories"},
	}, handler.DeleteWorkspace)
}

func RegisterRenameWorkspaceOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "rename-workspace",
		Method:      http.MethodPatch,
		Path:        "/v1/user/categories/workspace/{oldName}",
		Summary:     "Rename workspace",
		Description: "Rename a workspace by updating all its categories",
		Tags:        []string{"categories"},
	}, handler.RenameWorkspace)
}
