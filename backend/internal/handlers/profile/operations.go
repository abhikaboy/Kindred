package Profile

import (
	"net/http"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
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
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Query         string `query:"query" example:"john"`
}

type SearchProfilesOutput struct {
	Body []ProfileDocument `json:"body"`
}

// Autocomplete Profiles
type AutocompleteProfilesInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Query         string `query:"query" example:"joh" minLength:"2"`
}

type AutocompleteProfilesOutput struct {
	Body []ProfileDocument `json:"body"`
}

// Get Suggested Users
type GetSuggestedUsersInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetSuggestedUsersOutput struct {
	Body []types.UserExtendedReference `json:"body"`
}

// Find Users by Phone Numbers
type FindUsersByPhoneNumbersInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          struct {
		Numbers []string `json:"numbers" minItems:"1" maxItems:"1000" doc:"List of phone numbers to search for"`
	}
}

type FindUsersByPhoneNumbersOutput struct {
	Body []types.UserExtendedReferenceWithPhone `json:"body"`
}

// Update Timezone
type UpdateTimezoneInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          struct {
		Timezone string `json:"timezone" example:"America/New_York" doc:"The IANA timezone identifier"`
	}
}

type UpdateTimezoneOutput struct {
	Body struct {
		Message string `json:"message" example:"Timezone updated successfully"`
	}
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
		Path:        "/v1/user/profiles/{id}",
		Summary:     "Get profile by ID",
		Description: "Retrieve a specific user profile by its ID",
		Tags:        []string{"profiles"},
	}, handler.GetProfileHuma)
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
		Path:        "/v1/user/profiles/search",
		Summary:     "Search profiles",
		Description: "Search for user profiles by query string",
		Tags:        []string{"profiles"},
	}, handler.SearchProfilesHuma)
}

func RegisterAutocompleteProfilesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "autocomplete-profiles",
		Method:      http.MethodGet,
		Path:        "/v1/user/profiles/autocomplete",
		Summary:     "Autocomplete profiles",
		Description: "Get autocomplete suggestions for user profiles",
		Tags:        []string{"profiles"},
	}, handler.AutocompleteProfilesHuma)
}

func RegisterGetSuggestedUsersOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-suggested-users",
		Method:      http.MethodGet,
		Path:        "/v1/profiles/suggested",
		Summary:     "Get suggested users",
		Description: "Get up to 8 suggested users with the most friends",
		Tags:        []string{"profiles"},
	}, handler.GetSuggestedUsers)
}

func RegisterFindUsersByPhoneNumbersOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "find-users-by-phone-numbers",
		Method:      http.MethodPost,
		Path:        "/v1/profiles/find-by-phone",
		Summary:     "Find users by phone numbers",
		Description: "Efficiently find users matching any of the provided phone numbers using a single database query",
		Tags:        []string{"profiles"},
	}, handler.FindUsersByPhoneNumbers)
}

func RegisterUpdateTimezoneOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-timezone",
		Method:      http.MethodPost,
		Path:        "/v1/user/timezone",
		Summary:     "Update timezone",
		Description: "Update the authenticated user's timezone",
		Tags:        []string{"profiles", "user"},
	}, handler.UpdateTimezone)
}

// Get User Credits
type GetUserCreditsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
}

type GetUserCreditsOutput struct {
	Body types.UserCredits
}

func RegisterGetUserCreditsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-user-credits",
		Method:      http.MethodGet,
		Path:        "/v1/user/credits",
		Summary:     "Get user credits",
		Description: "Retrieve the current credit balance for the authenticated user",
		Tags:        []string{"profiles", "credits"},
	}, handler.GetUserCredits)
}

// Note: Profile picture upload operations moved to centralized upload service
// Use /v1/uploads/profile/{id}/url and /v1/uploads/profile/{id}/confirm instead
