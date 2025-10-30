package Activity

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for activity operations

// Get Activities (all)
type GetActivitiesInput struct{}

type GetActivitiesOutput struct {
	Body []ActivityDocument `json:"body"`
}

// Get Activity by ID
type GetActivityInput struct {
	ID   string `path:"id" example:"507f1f77bcf86cd799439011"`
	Year int    `query:"year" example:"2024"`
}

type GetActivityOutput struct {
	Body ActivityDocument `json:"body"`
}

// Get Activity by User and Period
type GetActivityByUserAndPeriodInput struct {
	UserID string `path:"userID" example:"507f1f77bcf86cd799439011"`
	Year   int    `query:"year" example:"2024"`
	Month  int    `query:"month" example:"12"`
}

type GetActivityByUserAndPeriodOutput struct {
	Body ActivityDocument `json:"body"`
}

// Get Recent Activity
type GetRecentActivityInput struct {
	UserID string `path:"userID" example:"507f1f77bcf86cd799439011"`
}

type GetRecentActivityOutput struct {
	Body []ActivityDocument `json:"body"`
}

// Get Activity by User and Year
type GetActivityByUserAndYearInput struct {
	UserID string `path:"userID" example:"507f1f77bcf86cd799439011"`
	Year   int    `query:"year" example:"2024"`
}

type GetActivityByUserAndYearOutput struct {
	Body []ActivityDocument `json:"body"`
}

// Operation registrations

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

func RegisterGetActivityByUserAndPeriodOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-activity-by-user-and-period",
		Method:      http.MethodGet,
		Path:        "/v1/activity/user/{userID}",
		Summary:     "Get activity by user and period",
		Description: "Retrieve activity for a specific user, year, and month",
		Tags:        []string{"activities"},
	}, handler.GetActivityByUserAndPeriod)
}

func RegisterGetActivityByUserAndYearOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-activity-by-user-and-year",
		Method:      http.MethodGet,
		Path:        "/v1/activity/user/{userID}/year",
		Summary:     "Get activity by user and year",
		Description: "Retrieve all activity for a specific user and year",
		Tags:        []string{"activities"},
	}, handler.GetActivityByUserAndYear)
}

func RegisterGetRecentActivityOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-recent-activity",
		Method:      http.MethodGet,
		Path:        "/v1/activity/user/{userID}/recent",
		Summary:     "Get recent activity",
		Description: "Retrieve the user's activity for the last 8 days",
		Tags:        []string{"activities"},
	}, handler.GetRecentActivity)
}
