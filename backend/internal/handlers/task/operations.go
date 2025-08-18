package task

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for task operations

// Get Tasks by User
type GetTasksByUserInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `query:"id"`
	SortBy        string `query:"sortBy" example:"timestamp" default:"timestamp"`
	SortDir       string `query:"sortDir" example:"-1" default:"-1"`
}

type GetTasksByUserOutput struct {
	Body []TaskDocument `json:"body"`
}

// Create Task
type CreateTaskInput struct {
	Authorization string           `header:"Authorization" required:"true"`
	Category      string           `path:"category" example:"507f1f77bcf86cd799439011"`
	Body          CreateTaskParams `json:"body"`
}

type CreateTaskOutput struct {
	Body TaskDocument `json:"body"`
}

// Get Tasks (all)
type GetTasksInput struct{}

type GetTasksOutput struct {
	Body []TaskDocument `json:"body"`
}

// Get Task by ID
type GetTaskInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetTaskOutput struct {
	Body TaskDocument `json:"body"`
}

// Update Task
type UpdateTaskInput struct {
	Authorization string             `header:"Authorization" required:"true"`
	ID            string             `path:"id" example:"507f1f77bcf86cd799439011"`
	Category      string             `path:"category" example:"507f1f77bcf86cd799439011"`
	Body          UpdateTaskDocument `json:"body"`
}

type UpdateTaskOutput struct {
	Body struct {
		Message string `json:"message" example:"Task updated successfully"`
	}
}

// Complete Task
type CompleteTaskInput struct {
	Authorization string               `header:"Authorization" required:"true"`
	ID            string               `path:"id" example:"507f1f77bcf86cd799439011"`
	Category      string               `path:"category" example:"507f1f77bcf86cd799439011"`
	Body          CompleteTaskDocument `json:"body"`
}

type CompleteTaskOutput struct {
	Body struct {
		Message string `json:"message" example:"Task completed successfully"`
	}
}

// Delete Task
type DeleteTaskInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
	Category      string `path:"category" example:"507f1f77bcf86cd799439011"`
}

type DeleteTaskOutput struct {
	Body struct {
		Message string `json:"message" example:"Task deleted successfully"`
	}
}

// Activate Task
type ActivateTaskInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
	Category      string `path:"category" example:"507f1f77bcf86cd799439011"`
	Active        string `query:"active" example:"true"`
}

type ActivateTaskOutput struct {
	Body struct {
		Message string `json:"message" example:"Task activation status updated successfully"`
	}
}

// Get Active Tasks
type GetActiveTasksInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetActiveTasksOutput struct {
	Body []TaskDocument `json:"body"`
}

// Create Task from Template
type CreateTaskFromTemplateInput struct {
	ID string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetTemplateByIDInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetTemplateByIDOutput struct {
	Body TemplateTaskDocument `json:"body"`
}

type CreateTaskFromTemplateOutput struct {
	Body TaskDocument `json:"body"`
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

// Update Task Notes
type UpdateTaskNotesInput struct {
	Authorization string                  `header:"Authorization" required:"true"`
	ID            string                  `path:"id" example:"507f1f77bcf86cd799439011"`
	Category      string                  `path:"category" example:"507f1f77bcf86cd799439011"`
	Body          UpdateTaskNotesDocument `json:"body"`
}

type UpdateTaskNotesOutput struct {
	Body struct {
		Message string `json:"message" example:"Task notes updated successfully"`
	}
}

// Update Task Checklist
type UpdateTaskChecklistInput struct {
	Authorization string                      `header:"Authorization" required:"true"`
	ID            string                      `path:"id" example:"507f1f77bcf86cd799439011"`
	Category      string                      `path:"category" example:"507f1f77bcf86cd799439011"`
	Body          UpdateTaskChecklistDocument `json:"body"`
}

type UpdateTaskChecklistOutput struct {
	Body struct {
		Message string `json:"message" example:"Task checklist updated successfully"`
	}
}

// Specialized endpoint inputs/outputs

// Update Task Deadline
type UpdateTaskDeadlineInput struct {
	Authorization string                     `header:"Authorization" required:"true"`
	Category      string                     `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string                     `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateTaskDeadlineDocument `json:"body"`
}

type UpdateTaskDeadlineOutput struct {
	Body struct {
		Message string `json:"message" example:"Task deadline updated successfully"`
	}
}

// Update Task Start Date/Time
type UpdateTaskStartInput struct {
	Authorization string                  `header:"Authorization" required:"true"`
	Category      string                  `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string                  `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateTaskStartDocument `json:"body"`
}

type UpdateTaskStartOutput struct {
	Body struct {
		Message string `json:"message" example:"Task start date/time updated successfully"`
	}
}

// Update Task Reminders
type UpdateTaskReminderInput struct {
	Authorization string                     `header:"Authorization" required:"true"`
	Category      string                     `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string                     `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateTaskReminderDocument `json:"body"`
}

type UpdateTaskReminderOutput struct {
	Body struct {
		Message string `json:"message" example:"Task reminders updated successfully"`
	}
}

// Get Completed Tasks
// Input for fetching completed tasks for a user
// Output is a list of TaskDocument

type GetCompletedTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetCompletedTasksOutput struct {
	Body []TaskDocument `json:"body"`
}

// Operation registrations

func RegisterGetTasksByUserOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-tasks-by-user",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/",
		Summary:     "Get tasks by user",
		Description: "Retrieve tasks for a specific user with optional sorting",
		Tags:        []string{"tasks"},
	}, handler.GetTasksByUser)
}

func RegisterCreateTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-task",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}",
		Summary:     "Create a new task",
		Description: "Create a new task in a specific category",
		Tags:        []string{"tasks"},
	}, handler.CreateTask)
}

func RegisterGetTasksOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-tasks",
		Method:      http.MethodGet,
		Path:        "/v1/tasks/",
		Summary:     "Get all tasks",
		Description: "Retrieve all task records",
		Tags:        []string{"tasks"},
	}, handler.GetTasks)
}

func RegisterGetTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-task",
		Method:      http.MethodGet,
		Path:        "/v1/tasks/{id}",
		Summary:     "Get task by ID",
		Description: "Retrieve a specific task by its ID",
		Tags:        []string{"tasks"},
	}, handler.GetTask)
}

func RegisterUpdateTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-task",
		Method:      http.MethodPatch,
		Path:        "/v1/user/tasks/{category}/{id}",
		Summary:     "Update task",
		Description: "Update a task record",
		Tags:        []string{"tasks"},
	}, handler.UpdateTask)
}

func RegisterCompleteTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "complete-task",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/complete/{category}/{id}",
		Summary:     "Complete task",
		Description: "Mark a task as completed",
		Tags:        []string{"tasks"},
	}, handler.CompleteTask)
}

func RegisterDeleteTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-task",
		Method:      http.MethodDelete,
		Path:        "/v1/user/tasks/{category}/{id}",
		Summary:     "Delete task",
		Description: "Delete a task record",
		Tags:        []string{"tasks"},
	}, handler.DeleteTask)
}

func RegisterActivateTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "activate-task",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/active/{category}/{id}",
		Summary:     "Activate/deactivate task",
		Description: "Change the active status of a task",
		Tags:        []string{"tasks"},
	}, handler.ActivateTask)
}

func RegisterGetActiveTasksOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-active-tasks",
		Method:      http.MethodGet,
		Path:        "/v1/tasks/active/{id}",
		Summary:     "Get active tasks",
		Description: "Retrieve all active tasks for a user",
		Tags:        []string{"tasks"},
	}, handler.GetActiveTasks)
}

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

func RegisterUpdateTaskNotesOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-task-notes",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}/{id}/notes",
		Summary:     "Update task notes",
		Description: "Update the notes field of a task",
		Tags:        []string{"tasks"},
	}, handler.UpdateTaskNotes)
}

func RegisterUpdateTaskChecklistOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-task-checklist",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}/{id}/checklist",
		Summary:     "Update task checklist",
		Description: "Update the checklist field of a task",
		Tags:        []string{"tasks"},
	}, handler.UpdateTaskChecklist)
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

// Specialized endpoint registrations

func RegisterUpdateTaskDeadlineOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-task-deadline",
		Method:      http.MethodPatch,
		Path:        "/v1/user/category/{category}/task/{id}/deadline",
		Summary:     "Update task deadline",
		Description: "Update the deadline for a specific task",
		Tags:        []string{"tasks"},
	}, handler.UpdateTaskDeadline)
}

func RegisterUpdateTaskStartOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-task-start",
		Method:      http.MethodPatch,
		Path:        "/v1/user/category/{category}/task/{id}/start",
		Summary:     "Update task start date/time",
		Description: "Update the start date and time for a specific task",
		Tags:        []string{"tasks"},
	}, handler.UpdateTaskStart)
}

func RegisterUpdateTaskReminderOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-task-reminder",
		Method:      http.MethodPatch,
		Path:        "/v1/user/category/{category}/task/{id}/reminders",
		Summary:     "Update task reminders",
		Description: "Update the reminders for a specific task",
		Tags:        []string{"tasks"},
	}, handler.UpdateTaskReminders)
}
