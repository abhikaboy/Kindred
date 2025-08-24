package Blueprint

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

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

func RegisterSearchBlueprintsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "search-blueprints",
		Method:      http.MethodGet,
		Path:        "/v1/blueprints/search",
		Summary:     "Search blueprints",
		Description: "Search for blueprints by name, description, tags, or owner handle",
		Tags:        []string{"blueprints"},
	}, handler.SearchBlueprintsHuma)
}

func RegisterGetUserSubscribedBlueprintsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-user-subscribed-blueprints",
		Method:      http.MethodGet,
		Path:        "/v1/user/blueprints/subscribed",
		Summary:     "Get user's subscribed blueprints",
		Description: "Retrieve all blueprints that the authenticated user is subscribed to",
		Tags:        []string{"blueprints"},
	}, handler.GetUserSubscribedBlueprintsHuma)
}

func RegisterGetBlueprintByCategoryOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-blueprints-by-category",
		Method:      http.MethodGet,
		Path:        "/v1/blueprints/by-category",
		Summary:     "Get blueprints grouped by category",
		Description: "Retrieve all blueprints grouped by their category field",
		Tags:        []string{"blueprints"},
	}, handler.GetBlueprintByCategoryHuma)
}

// Register all blueprint operations
func RegisterBlueprintOperations(api huma.API, handler *Handler) {
	RegisterSearchBlueprintsOperation(api, handler)
	RegisterCreateBlueprintOperation(api, handler)
	RegisterGetBlueprintsOperation(api, handler)
	RegisterGetBlueprintOperation(api, handler)
	RegisterUpdateBlueprintOperation(api, handler)
	RegisterDeleteBlueprintOperation(api, handler)
	RegisterSubscribeToBlueprintOperation(api, handler)
	RegisterUnsubscribeFromBlueprintOperation(api, handler)
	RegisterGetUserSubscribedBlueprintsOperation(api, handler)
	RegisterGetBlueprintByCategoryOperation(api, handler)
}
