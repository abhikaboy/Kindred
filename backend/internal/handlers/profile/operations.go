package Profile

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for profile operations

// Get Profiles (all)
type GetProfilesInput struct{}

type GetProfilesOutput struct {
	Body []ProfileDocument `json:"body"`
}

// Get Profile by ID
type GetProfileInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetProfileOutput struct {
	Body ProfileDocument `json:"body"`
}

// Update Profile
type UpdateProfileInput struct {
	ID   string                `path:"id" example:"507f1f77bcf86cd799439011"`
	Body UpdateProfileDocument `json:"body"`
}

type UpdateProfileOutput struct {
	Body struct {
		Message string `json:"message" example:"Profile updated successfully"`
	}
}

// Delete Profile
type DeleteProfileInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteProfileOutput struct {
	Body struct {
		Message string `json:"message" example:"Profile deleted successfully"`
	}
}

// Get Profile by Email
type GetProfileByEmailInput struct {
	Email string `path:"email" example:"user@example.com"`
}

type GetProfileByEmailOutput struct {
	Body ProfileDocument `json:"body"`
}

// Get Profile by Phone
type GetProfileByPhoneInput struct {
	Phone string `path:"phone" example:"+1234567890"`
}

type GetProfileByPhoneOutput struct {
	Body ProfileDocument `json:"body"`
}

// Search Profiles
type SearchProfilesInput struct {
	Query string `query:"query" example:"john"`
}

type SearchProfilesOutput struct {
	Body []ProfileDocument `json:"body"`
}

// Note: Image upload functionality moved to centralized /v1/uploads endpoints
// Use /v1/uploads/profile/{id}/url and /v1/uploads/profile/{id}/confirm instead

// Operation registrations

func RegisterGetProfilesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-profiles",
		Method:      http.MethodGet,
		Path:        "/v1/profiles",
		Summary:     "Get all profiles",
		Description: "Retrieve all user profiles",
		Tags:        []string{"profiles"},
	}, handler.GetProfiles)
}

func RegisterGetProfileOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-profile",
		Method:      http.MethodGet,
		Path:        "/v1/profiles/{id}",
		Summary:     "Get profile by ID",
		Description: "Retrieve a specific user profile by its ID",
		Tags:        []string{"profiles"},
	}, handler.GetProfile)
}

func RegisterUpdateProfileOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-profile",
		Method:      http.MethodPatch,
		Path:        "/v1/profiles/{id}",
		Summary:     "Update profile",
		Description: "Update a user profile",
		Tags:        []string{"profiles"},
	}, handler.UpdatePartialProfile)
}

func RegisterDeleteProfileOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-profile",
		Method:      http.MethodDelete,
		Path:        "/v1/profiles/{id}",
		Summary:     "Delete profile",
		Description: "Delete a user profile",
		Tags:        []string{"profiles"},
	}, handler.DeleteProfile)
}

func RegisterGetProfileByEmailOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-profile-by-email",
		Method:      http.MethodGet,
		Path:        "/v1/profiles/email/{email}",
		Summary:     "Get profile by email",
		Description: "Retrieve a user profile by email address",
		Tags:        []string{"profiles"},
	}, handler.GetProfileByEmail)
}

func RegisterGetProfileByPhoneOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-profile-by-phone",
		Method:      http.MethodGet,
		Path:        "/v1/profiles/phone/{phone}",
		Summary:     "Get profile by phone",
		Description: "Retrieve a user profile by phone number",
		Tags:        []string{"profiles"},
	}, handler.GetProfileByPhone)
}

func RegisterSearchProfilesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "search-profiles",
		Method:      http.MethodGet,
		Path:        "/v1/profiles/search",
		Summary:     "Search profiles",
		Description: "Search for user profiles by query string",
		Tags:        []string{"profiles"},
	}, handler.SearchProfiles)
}

// Note: Profile picture upload operations moved to centralized upload service
// Use /v1/uploads/profile/{id}/url and /v1/uploads/profile/{id}/confirm instead 