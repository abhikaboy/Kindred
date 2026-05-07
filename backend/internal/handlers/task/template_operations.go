package task

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for template and recurring task operations.

// Create Task from Template
type CreateTaskFromTemplateInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type CreateTaskFromTemplateOutput struct {
	Body TaskDocument `json:"body"`
}

type GetTemplateByIDInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetTemplateByIDOutput struct {
	Body TemplateTaskDocument `json:"body"`
}

type UpdateTemplateInput struct {
	Authorization string                 `header:"Authorization" required:"true"`
	RefreshToken  string                 `header:"refresh_token" required:"true"`
	ID            string                 `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateTemplateDocument `json:"body"`
}

type UpdateTemplateOutput struct {
	Body struct {
		Message string `json:"message" example:"Template task updated successfully"`
	}
}

type ResetTemplateMetricsInput struct {
	Authorization string `header:"Authorization" required:"true"`
	RefreshToken  string `header:"refresh_token" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type ResetTemplateMetricsOutput struct {
	Body struct {
		Message string `json:"message" example:"Template metrics reset successfully"`
	}
}

// Undo Missed Task
type UndoMissedTaskInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type UndoMissedTaskOutput struct {
	Body struct {
		Message       string `json:"message" example:"Missed task successfully marked as completed"`
		Streak        int    `json:"streak" example:"6" doc:"Restored streak value"`
		HighestStreak int    `json:"highestStreak" example:"6" doc:"Current highest streak"`
	}
}

type TemplateWithCategory struct {
	TemplateTaskDocument `bson:",inline"`
	CategoryName         string `bson:"categoryName" json:"categoryName"`
}

type GetUserTemplatesInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetUserTemplatesOutput struct {
	Body struct {
		Templates []TemplateWithCategory `json:"templates"`
	} `json:"body"`
}

// Get Tasks with Start Times Older Than One Day
type GetTasksWithStartTimesOlderThanOneDayInput struct{}

type GetTasksWithStartTimesOlderThanOneDayOutput struct {
	Body []TemplateTaskDocument `json:"body"`
}

// Get Recurring Tasks with Past Deadlines
type GetRecurringTasksWithPastDeadlinesInput struct{}

type GetRecurringTasksWithPastDeadlinesOutput struct {
	Body []TemplateTaskDocument `json:"body"`
}

// Operation registrations

func RegisterCreateTaskFromTemplateOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-task-from-template",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/template/{id}",
		Summary:     "Create task from template",
		Description: "Create a new task based on a template",
		Tags:        []string{"tasks"},
	}, handler.CreateTaskFromTemplate)
}

func RegisterGetTasksWithStartTimesOlderThanOneDayOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-tasks-with-old-start-times",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/template/old",
		Summary:     "Get tasks with old start times",
		Description: "Get all tasks with start times older than one day",
		Tags:        []string{"tasks"},
	}, handler.GetTasksWithStartTimesOlderThanOneDay)
}

func RegisterGetRecurringTasksWithPastDeadlinesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-recurring-tasks-with-past-deadlines",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/template/pastDeadline",
		Summary:     "Get recurring tasks with past deadlines",
		Description: "Get all recurring tasks that have past their deadlines",
		Tags:        []string{"tasks"},
	}, handler.GetRecurringTasksWithPastDeadlines)
}

func RegisterGetTemplateByIDOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-template-by-id",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/template/{id}",
		Summary:     "Get template by ID",
		Description: "Retrieve a template by its ID",
		Tags:        []string{"tasks"},
	}, handler.GetTemplateByID)
}

func RegisterUpdateTemplateOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-template",
		Method:      http.MethodPatch,
		Path:        "/v1/user/tasks/template/{id}",
		Summary:     "Update template task",
		Description: "Update a template task for recurring tasks",
		Tags:        []string{"tasks"},
	}, handler.UpdateTemplate)
}

func RegisterResetTemplateMetricsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "reset-template-metrics",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/template/{id}/reset",
		Summary:     "Reset template metrics",
		Description: "Reset streak, completion, and missed counts for a recurring task template",
		Tags:        []string{"tasks"},
	}, handler.ResetTemplateMetrics)
}

func RegisterUndoMissedTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "undo-missed-task",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/template/{id}/undo-missed",
		Summary:     "Undo a missed recurring task",
		Description: "Retroactively mark a recently missed recurring task as completed, restoring the streak. Must be used within 24 hours of the miss.",
		Tags:        []string{"tasks"},
	}, handler.UndoMissedTask)
}

func RegisterGetUserTemplatesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-user-templates",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/templates",
		Summary:     "Get user's template tasks with category names",
		Description: "Retrieve all template tasks for the authenticated user with their category names",
		Tags:        []string{"tasks"},
	}, handler.GetUserTemplates)
}
