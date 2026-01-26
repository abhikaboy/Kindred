package settings

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// RegisterGetUserSettingsOperation registers the GET /v1/user/settings endpoint
func RegisterGetUserSettingsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-user-settings",
		Method:      http.MethodGet,
		Path:        "/v1/user/settings",
		Summary:     "Get user settings",
		Description: "Retrieve all settings for the authenticated user",
		Tags:        []string{"settings", "user"},
	}, handler.GetUserSettingsHuma)
}

// RegisterUpdateUserSettingsOperation registers the PATCH /v1/user/settings endpoint
func RegisterUpdateUserSettingsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-user-settings",
		Method:      http.MethodPatch,
		Path:        "/v1/user/settings",
		Summary:     "Update user settings",
		Description: "Update settings for the authenticated user (partial updates supported)",
		Tags:        []string{"settings", "user"},
	}, handler.UpdateUserSettingsHuma)
}

// RegisterSettingsOperations registers all settings operations
func RegisterSettingsOperations(api huma.API, handler *Handler) {
	RegisterGetUserSettingsOperation(api, handler)
	RegisterUpdateUserSettingsOperation(api, handler)
}
