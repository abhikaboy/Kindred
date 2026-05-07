package task

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for CRUD, field update, bulk, and activation task operations.

type GenerateTaskInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Description   string `json:"description"`
}
type GenerateTaskOutput struct {
	Body CreateTaskParams `json:"body"`
}

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

type NextFlexTaskDTO struct {
	Task       TaskDocument `json:"task"`
	CategoryID string       `json:"categoryId"`
}

type CompleteTaskOutput struct {
	Body struct {
		Message       string           `json:"message" example:"Task completed successfully"`
		StreakChanged bool             `json:"streakChanged" example:"true" doc:"Indicates if the user's streak increased"`
		CurrentStreak int              `json:"currentStreak" example:"5" doc:"The user's current streak count"`
		TasksComplete float64          `json:"tasksComplete" example:"42" doc:"Total tasks completed by user"`
		NextFlexTask  *NextFlexTaskDTO `json:"nextFlexTask,omitempty" doc:"If this was a flex task and more instances remain, the next task instance"`
	}
}

// Delete Task
type DeleteTaskInput struct {
	Authorization   string `header:"Authorization" required:"true"`
	ID              string `path:"id" example:"507f1f77bcf86cd799439011"`
	Category        string `path:"category" example:"507f1f77bcf86cd799439011"`
	DeleteRecurring bool   `query:"deleteRecurring" example:"false" doc:"Optional. If true, also delete the recurring template to stop future instances. Defaults to false."`
}

type DeleteTaskOutput struct {
	Body struct {
		Message string `json:"message" example:"Task deleted successfully"`
	}
}

// Bulk Complete Task
type BulkCompleteTaskItem struct {
	TaskID       string               `json:"taskId" example:"507f1f77bcf86cd799439011" doc:"The ID of the task to complete"`
	CategoryID   string               `json:"categoryId" example:"507f1f77bcf86cd799439011" doc:"The ID of the category the task belongs to"`
	CompleteData CompleteTaskDocument `json:"completeData" doc:"The completion data for the task"`
}

type BulkCompleteTaskInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Tasks []BulkCompleteTaskItem `json:"tasks" minItems:"1" maxItems:"100" doc:"Array of tasks to complete"`
	} `json:"body"`
}

type BulkCompleteTaskOutput struct {
	Body struct {
		Message        string   `json:"message" example:"Bulk task completion completed"`
		TotalCompleted int      `json:"totalCompleted" example:"5" doc:"Number of tasks successfully completed"`
		TotalFailed    int      `json:"totalFailed" example:"0" doc:"Number of tasks that failed to complete"`
		StreakChanged  bool     `json:"streakChanged" example:"true" doc:"Indicates if the user's streak increased"`
		CurrentStreak  int      `json:"currentStreak" example:"5" doc:"The user's current streak count"`
		TasksComplete  float64  `json:"tasksComplete" example:"42" doc:"Total tasks completed by user"`
		FailedTaskIDs  []string `json:"failedTaskIds,omitempty" doc:"Array of task IDs that failed to complete"`
	}
}

// Bulk Delete Task
type BulkDeleteTaskItem struct {
	TaskID          string `json:"taskId" example:"507f1f77bcf86cd799439011" doc:"The ID of the task to delete"`
	CategoryID      string `json:"categoryId" example:"507f1f77bcf86cd799439011" doc:"The ID of the category the task belongs to"`
	DeleteRecurring bool   `json:"deleteRecurring,omitempty" example:"false" doc:"Optional. If true, also delete the recurring template. Defaults to false."`
}

type BulkDeleteTaskInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Tasks []BulkDeleteTaskItem `json:"tasks" minItems:"1" maxItems:"100" doc:"Array of tasks to delete"`
	} `json:"body"`
}

type BulkDeleteTaskOutput struct {
	Body struct {
		Message       string   `json:"message" example:"Bulk task deletion completed"`
		TotalDeleted  int      `json:"totalDeleted" example:"5" doc:"Number of tasks successfully deleted"`
		TotalFailed   int      `json:"totalFailed" example:"0" doc:"Number of tasks that failed to delete"`
		FailedTaskIDs []string `json:"failedTaskIds,omitempty" doc:"Array of task IDs that failed to delete"`
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

func RegisterBulkCompleteTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "bulk-complete-tasks",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/bulk/complete",
		Summary:     "Bulk complete tasks",
		Description: "Mark multiple tasks as completed in a single request",
		Tags:        []string{"tasks"},
	}, handler.BulkCompleteTask)
}

func RegisterBulkDeleteTaskOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "bulk-delete-tasks",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/bulk/delete",
		Summary:     "Bulk delete tasks",
		Description: "Delete multiple tasks in a single request",
		Tags:        []string{"tasks"},
	}, handler.BulkDeleteTask)
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
