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

// RegisterUpdatePersonalizationOperation registers the PATCH /v1/user/settings/personalization endpoint
func RegisterUpdatePersonalizationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-personalization-settings",
		Method:      http.MethodPatch,
		Path:        "/v1/user/settings/personalization",
		Summary:     "Update personalization settings",
		Description: "Turn personalization on or off, pause it until a given time, or opt in to letting friends be prompted when you are stuck. An omitted field is left unchanged; enabling also clears any active pause, but never turns struggle sharing on.",
		Tags:        []string{"settings", "user", "personalization"},
	}, handler.UpdatePersonalizationHuma)
}

// RegisterExportPersonalizationOperation registers the GET /v1/user/settings/personalization/export endpoint
func RegisterExportPersonalizationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "export-personalization-data",
		Method:      http.MethodGet,
		Path:        "/v1/user/settings/personalization/export",
		Summary:     "Export personalization data",
		Description: "Download everything Kindred has learned about the authenticated user. Prompt text is excluded; the structured evidence behind every fact is not.",
		Tags:        []string{"settings", "user", "personalization"},
	}, handler.ExportPersonalizationHuma)
}

// RegisterDeletePersonalizationOperation registers the DELETE /v1/user/settings/personalization/data endpoint
func RegisterDeletePersonalizationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-personalization-data",
		Method:      http.MethodDelete,
		Path:        "/v1/user/settings/personalization/data",
		Summary:     "Delete personalization data",
		Description: "Erase everything Kindred has learned about the authenticated user and turn personalization off, so it is not rebuilt overnight.",
		Tags:        []string{"settings", "user", "personalization"},
	}, handler.DeletePersonalizationHuma)
}

// RegisterSaveStatedPreferencesOperation registers the PUT /v1/user/settings/personalization/stated endpoint
func RegisterSaveStatedPreferencesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "save-stated-preferences",
		Method:      http.MethodPut,
		Path:        "/v1/user/settings/personalization/stated",
		Summary:     "Save stated preferences",
		Description: "Persist the answers collected during onboarding. These always win over what the nightly worker observes.",
		Tags:        []string{"settings", "user", "personalization"},
	}, handler.SaveStatedPreferencesHuma)
}

// RegisterUpdateStatedFactOperation registers the PATCH /v1/user/settings/personalization/stated/{key} endpoint
func RegisterUpdateStatedFactOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-stated-preference",
		Method:      http.MethodPatch,
		Path:        "/v1/user/settings/personalization/stated/{key}",
		Summary:     "Correct one stated preference",
		Description: "Change a single onboarding answer from the settings screen.",
		Tags:        []string{"settings", "user", "personalization"},
	}, handler.UpdateStatedFactHuma)
}

// RegisterSettingsOperations registers all settings operations
func RegisterSettingsOperations(api huma.API, handler *Handler) {
	RegisterGetUserSettingsOperation(api, handler)
	RegisterUpdateUserSettingsOperation(api, handler)
	RegisterUpdatePersonalizationOperation(api, handler)
	RegisterExportPersonalizationOperation(api, handler)
	RegisterDeletePersonalizationOperation(api, handler)
	RegisterSaveStatedPreferencesOperation(api, handler)
	RegisterUpdateStatedFactOperation(api, handler)
}
