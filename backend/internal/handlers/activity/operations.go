package Activity

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for activity operations

// Create Activity
type CreateActivityInput struct {
	Body CreateActivityParams `json:"body"`
}

type CreateActivityOutput struct {
	Body ActivityDocument `json:"body"`
}

// Get Activities (all)
type GetActivitiesInput struct{}

type GetActivitiesOutput struct {
	Body []ActivityDocument `json:"body"`
}

// Get Activity by ID
type GetActivityInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetActivityOutput struct {
	Body ActivityDocument `json:"body"`
}

// Update Activity
type UpdateActivityInput struct {
	ID   string                  `path:"id" example:"507f1f77bcf86cd799439011"`
	Body UpdateActivityDocument `json:"body"`
}

type UpdateActivityOutput struct {
	Body struct {
		Message string `json:"message" example:"Activity updated successfully"`
	}
}

// Delete Activity
type DeleteActivityInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteActivityOutput struct {
	Body struct {
		Message string `json:"message" example:"Activity deleted successfully"`
	}
}

// Operation registrations

func RegisterCreateActivityOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-activity",
		Method:      http.MethodPost,
		Path:        "/v1/activity",
		Summary:     "Create a new activity",
		Description: "Create a new activity record",
		Tags:        []string{"activities"},
	}, handler.CreateActivity)
}

func RegisterGetActivitiesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-activities",
		Method:      http.MethodGet,
		Path:        "/v1/activity",
		Summary:     "Get all activities",
		Description: "Retrieve all activity records",
		Tags:        []string{"activities"},
	}, handler.GetActivities)
}

func RegisterGetActivityOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-activity",
		Method:      http.MethodGet,
		Path:        "/v1/activity/{id}",
		Summary:     "Get activity by ID",
		Description: "Retrieve a specific activity by its ID",
		Tags:        []string{"activities"},
	}, handler.GetActivity)
}

func RegisterUpdateActivityOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-activity",
		Method:      http.MethodPatch,
		Path:        "/v1/activity/{id}",
		Summary:     "Update activity",
		Description: "Update an activity record",
		Tags:        []string{"activities"},
	}, handler.UpdatePartialActivity)
}

func RegisterDeleteActivityOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-activity",
		Method:      http.MethodDelete,
		Path:        "/v1/activity/{id}",
		Summary:     "Delete activity",
		Description: "Delete an activity record",
		Tags:        []string{"activities"},
	}, handler.DeleteActivity)
} 