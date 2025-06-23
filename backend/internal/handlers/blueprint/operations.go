package Blueprint

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for blueprint operations

// Create Blueprint
type CreateBlueprintInput struct {
	Authorization string                `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          CreateBlueprintParams `json:"body"`
}

type CreateBlueprintOutput struct {
	Body BlueprintDocument `json:"body"`
}

// Get Blueprints (all)
type GetBlueprintsInput struct{}

type GetBlueprintsOutput struct {
	Body []BlueprintDocument `json:"body"`
}

// Get Blueprint by ID
type GetBlueprintInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetBlueprintOutput struct {
	Body BlueprintDocument `json:"body"`
}

// Update Blueprint
type UpdateBlueprintInput struct {
	Authorization string                    `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                    `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string                    `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateBlueprintDocument `json:"body"`
}

type UpdateBlueprintOutput struct {
	Body struct {
		Message string `json:"message" example:"Blueprint updated successfully"`
	}
}

// Delete Blueprint
type DeleteBlueprintInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteBlueprintOutput struct {
	Body struct {
		Message string `json:"message" example:"Blueprint deleted successfully"`
	}
}

// Subscribe to Blueprint
type SubscribeToBlueprintInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type SubscribeToBlueprintOutput struct {
	Body struct {
		Message string `json:"message" example:"Subscribed to blueprint successfully"`
	}
}

// Unsubscribe from Blueprint
type UnsubscribeFromBlueprintInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type UnsubscribeFromBlueprintOutput struct {
	Body struct {
		Message string `json:"message" example:"Unsubscribed from blueprint successfully"`
	}
}

// Operation registrations

func RegisterCreateBlueprintOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-blueprint",
		Method:      http.MethodPost,
		Path:        "/v1/user/blueprints",
		Summary:     "Create a new blueprint",
		Description: "Create a new blueprint for the authenticated user",
		Tags:        []string{"blueprints"},
	}, handler.CreateBlueprintHuma)
}

func RegisterGetBlueprintsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-blueprints",
		Method:      http.MethodGet,
		Path:        "/v1/blueprints",
		Summary:     "Get all blueprints",
		Description: "Retrieve all blueprints",
		Tags:        []string{"blueprints"},
	}, handler.GetBlueprintsHuma)
}

func RegisterGetBlueprintOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-blueprint",
		Method:      http.MethodGet,
		Path:        "/v1/blueprints/{id}",
		Summary:     "Get blueprint by ID",
		Description: "Retrieve a specific blueprint by its ID",
		Tags:        []string{"blueprints"},
	}, handler.GetBlueprintHuma)
}

func RegisterUpdateBlueprintOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-blueprint",
		Method:      http.MethodPatch,
		Path:        "/v1/user/blueprints/{id}",
		Summary:     "Update blueprint",
		Description: "Update a blueprint for the authenticated user",
		Tags:        []string{"blueprints"},
	}, handler.UpdateBlueprintHuma)
}

func RegisterDeleteBlueprintOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-blueprint",
		Method:      http.MethodDelete,
		Path:        "/v1/user/blueprints/{id}",
		Summary:     "Delete blueprint",
		Description: "Delete a blueprint for the authenticated user",
		Tags:        []string{"blueprints"},
	}, handler.DeleteBlueprintHuma)
}

func RegisterSubscribeToBlueprintOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "subscribe-to-blueprint",
		Method:      http.MethodPatch,
		Path:        "/v1/user/blueprints/{id}/subscribe",
		Summary:     "Subscribe to blueprint",
		Description: "Subscribe to a blueprint",
		Tags:        []string{"blueprints"},
	}, handler.SubscribeToBlueprintHuma)
}

func RegisterUnsubscribeFromBlueprintOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "unsubscribe-from-blueprint",
		Method:      http.MethodPatch,
		Path:        "/v1/user/blueprints/{id}/unsubscribe",
		Summary:     "Unsubscribe from blueprint",
		Description: "Unsubscribe from a blueprint",
		Tags:        []string{"blueprints"},
	}, handler.UnsubscribeFromBlueprintHuma)
}

// Register all blueprint operations
func RegisterBlueprintOperations(api huma.API, handler *Handler) {
	RegisterCreateBlueprintOperation(api, handler)
	RegisterGetBlueprintsOperation(api, handler)
	RegisterGetBlueprintOperation(api, handler)
	RegisterUpdateBlueprintOperation(api, handler)
	RegisterDeleteBlueprintOperation(api, handler)
	RegisterSubscribeToBlueprintOperation(api, handler)
	RegisterUnsubscribeFromBlueprintOperation(api, handler)
} 