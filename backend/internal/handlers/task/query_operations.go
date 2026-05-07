package task

import (
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for query task operations.

// TaskQueryFilters contains filtering options for task queries
type TaskQueryFilters struct {
	CategoryIDs   []string   `json:"categoryIds,omitempty" doc:"Filter by category IDs"`
	Priorities    []int      `json:"priorities,omitempty" doc:"Filter by priority values (1=low, 2=medium, 3=high)"`
	DeadlineFrom  *time.Time `json:"deadlineFrom,omitempty" doc:"Filter tasks with deadline on or after this time (ISO8601)"`
	DeadlineTo    *time.Time `json:"deadlineTo,omitempty" doc:"Filter tasks with deadline on or before this time (ISO8601)"`
	StartTimeFrom *time.Time `json:"startTimeFrom,omitempty" doc:"Filter tasks with start date on or after this time (ISO8601)"`
	StartTimeTo   *time.Time `json:"startTimeTo,omitempty" doc:"Filter tasks with start date on or before this time (ISO8601)"`
	HasDeadline   *bool      `json:"hasDeadline,omitempty" doc:"Filter tasks that have (true) or don't have (false) a deadline"`
	HasStartTime  *bool      `json:"hasStartTime,omitempty" doc:"Filter tasks that have (true) or don't have (false) a start date"`
	Active        *bool      `json:"active,omitempty" doc:"Filter by active status"`
	SortBy        string     `json:"sortBy,omitempty" doc:"Sort field: timestamp, priority, value, or deadline" example:"timestamp"`
	SortDir       int        `json:"sortDir,omitempty" doc:"Sort direction: 1 (ascending) or -1 (descending)" example:"-1"`
}

// Query Tasks by User (structured filter)
type QueryTasksByUserInput struct {
	Authorization string           `header:"Authorization" required:"true"`
	Body          TaskQueryFilters `json:"body"`
}

type QueryTasksByUserOutput struct {
	Body []TaskDocument `json:"body"`
}

// Get Completed Tasks
// Input for fetching completed tasks for a user with pagination
// Output is a list of TaskDocument with pagination metadata

type GetCompletedTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Page          int    `query:"page" default:"1" minimum:"1" doc:"Page number (1-indexed)"`
	Limit         int    `query:"limit" default:"20" minimum:"1" maximum:"100" doc:"Number of tasks per page"`
}

type GetCompletedTasksOutput struct {
	Body struct {
		Tasks      []TaskDocument `json:"tasks" doc:"List of completed tasks"`
		Page       int            `json:"page" doc:"Current page number"`
		Limit      int            `json:"limit" doc:"Tasks per page"`
		Total      int64          `json:"total" doc:"Total number of completed tasks"`
		TotalPages int            `json:"totalPages" doc:"Total number of pages"`
	} `json:"body"`
}

// Get Completed Tasks By Date
type GetCompletedTasksByDateInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Date          string `query:"date" doc:"Date in YYYY-MM-DD format" example:"2024-01-01"`
	Timezone      string `query:"timezone" doc:"User's timezone (IANA format)" example:"America/New_York"`
}

type GetCompletedTasksByDateOutput struct {
	Body struct {
		Tasks []TaskDocument `json:"tasks"`
	} `json:"body"`
}

// Operation registrations

func RegisterQueryTasksByUserOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "query-tasks-by-user",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/query",
		Summary:     "Query tasks with filters",
		Description: "Query tasks for the authenticated user with advanced filtering options",
		Tags:        []string{"tasks"},
	}, handler.QueryTasksByUser)
}

func RegisterGetCompletedTasksOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-completed-tasks",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/completed",
		Summary:     "Get completed tasks",
		Description: "Retrieve all completed tasks for the logged in user",
		Tags:        []string{"tasks"},
	}, handler.GetCompletedTasks)
}

func RegisterGetCompletedTasksByDateOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-completed-tasks-by-date",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/completed/date",
		Summary:     "Get completed tasks by date",
		Description: "Retrieve completed tasks for a specific date",
		Tags:        []string{"tasks"},
	}, handler.GetCompletedTasksByDate)
}
