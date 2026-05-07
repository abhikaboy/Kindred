package task

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for NLP (natural language processing) task operations.

// CategoryMetadata contains basic information about a category for the response
type CategoryMetadata struct {
	ID            string `json:"id" doc:"Category ID"`
	Name          string `json:"name" doc:"Category name"`
	WorkspaceName string `json:"workspaceName" doc:"Workspace name"`
}

// Create Task from Natural Language
type CreateTaskNaturalLanguageInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Text     string `json:"text" minLength:"1" maxLength:"10000" doc:"Natural language description of tasks to create" example:"Buy groceries tomorrow at 3pm, finish project report by Friday"`
		Timezone string `json:"timezone,omitempty" doc:"User's timezone (IANA format). Defaults to America/New_York if not provided" example:"America/New_York"`
	} `json:"body"`
}

type CreateTaskNaturalLanguageOutput struct {
	Body struct {
		CategoriesCreated int                `json:"categoriesCreated" doc:"Number of new categories created"`
		NewCategories     []CategoryMetadata `json:"newCategories" doc:"List of newly created categories with metadata"`
		TasksCreated      int                `json:"tasksCreated" doc:"Total number of tasks created"`
		Tasks             []TaskDocument     `json:"tasks" doc:"List of created tasks"`
		Message           string             `json:"message" example:"Successfully created 3 tasks in 2 categories"`
	}
}

// Preview Task from Natural Language (no creation)
type PreviewTaskNaturalLanguageInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Text     string `json:"text" minLength:"1" maxLength:"10000" doc:"Natural language description of tasks to preview" example:"Buy groceries tomorrow at 3pm, finish project report by Friday"`
		Timezone string `json:"timezone,omitempty" doc:"User's timezone (IANA format). Defaults to America/New_York if not provided" example:"America/New_York"`
	} `json:"body"`
}

type PreviewTaskNaturalLanguageOutput struct {
	Body struct {
		Categories []NewCategoryWithTasksLocal `json:"categories" doc:"New categories and their tasks proposed by AI"`
		Tasks      []CategoryTaskPairLocal     `json:"tasks" doc:"Tasks proposed for existing categories"`
	}
}

// Confirm Task from Natural Language (create using preview payload)
type ConfirmTaskNaturalLanguageInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Categories []NewCategoryWithTasksLocal `json:"categories" doc:"New categories to create with their tasks"`
		Tasks      []CategoryTaskPairLocal     `json:"tasks" doc:"Tasks to create in existing categories"`
	} `json:"body"`
}

// Query Tasks via Natural Language
type QueryTasksNaturalLanguageInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Text     string `json:"text" minLength:"1" maxLength:"10000" doc:"Natural language query to filter tasks" example:"high priority tasks due this week"`
		Timezone string `json:"timezone,omitempty" doc:"User's timezone (IANA format). Defaults to America/New_York if not provided" example:"America/New_York"`
	} `json:"body"`
}

type QueryTasksNaturalLanguageOutput struct {
	Body struct {
		Tasks []TaskDocument   `json:"tasks" doc:"Matching tasks"`
		Query TaskQueryFilters `json:"query" doc:"The structured query generated from natural language"`
	} `json:"body"`
}

// Edit Tasks via Natural Language
type EditTasksNaturalLanguageInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Text     string `json:"text" minLength:"1" maxLength:"10000" doc:"Natural language instruction for editing tasks" example:"move my dentist appointment to next Friday"`
		Timezone string `json:"timezone,omitempty" doc:"User's timezone (IANA format). Defaults to America/New_York if not provided" example:"America/New_York"`
	} `json:"body"`
}

type EditTasksNaturalLanguageOutput struct {
	Body struct {
		Tasks       []TaskDocument         `json:"tasks"      doc:"List of edited regular tasks with their updated state"`
		Templates   []TemplateTaskDocument `json:"templates"  doc:"List of edited recurring template tasks with their updated state"`
		EditedCount int                    `json:"editedCount" doc:"Total number of tasks/templates that were edited"`
		Message     string                 `json:"message" example:"Successfully edited 2 tasks"`
	} `json:"body"`
}

// EditResultResponse holds the result of an applied edit operation.
type EditResultResponse struct {
	Tasks       []TaskDocument         `json:"tasks"       doc:"Edited regular tasks"`
	Templates   []TemplateTaskDocument `json:"templates"   doc:"Edited recurring template tasks"`
	EditedCount int                    `json:"editedCount" doc:"Total number of tasks/templates edited"`
}

// IntentOpResponse is the response shape for a single decomposed operation.
// For "edit": EditResult is populated (applied server-side).
// For "delete": DeleteTasks is populated (frontend shows confirmation modal).
// For "create": CreatePreview is populated (frontend shows preview before confirming).
type IntentOpResponse struct {
	Type          string                `json:"type" doc:"Operation type: 'create', 'edit', or 'delete'"`
	EditResult    *EditResultResponse   `json:"editResult,omitempty"    doc:"Populated for edit ops — tasks already updated server-side"`
	DeleteTasks   []TaskDocument        `json:"deleteTasks,omitempty"   doc:"Populated for delete ops — tasks matching the delete query"`
	CreatePreview *MultiTaskOutputLocal `json:"createPreview,omitempty" doc:"Populated for create ops — preview payload to pass to /confirm"`
}

// Intent Task from Natural Language
type IntentTaskNaturalLanguageInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Text     string `json:"text" minLength:"1" maxLength:"10000" doc:"Natural language instruction (may contain create, edit, and/or delete operations)" example:"delete my grocery tasks and add a dentist appointment tomorrow"`
		Timezone string `json:"timezone,omitempty" doc:"User's timezone (IANA format). Defaults to America/New_York if not provided" example:"America/New_York"`
	} `json:"body"`
}

type IntentTaskNaturalLanguageOutput struct {
	Body struct {
		Ops []IntentOpResponse `json:"ops" doc:"Ordered list of decomposed operations. Edits are already applied; deletes and creates need frontend confirmation."`
	} `json:"body"`
}

// Operation registrations

func RegisterCreateTaskNaturalLanguageOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-task-natural-language",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/natural-language",
		Summary:     "Create tasks from natural language",
		Description: "Process natural language text to create multiple tasks and categories using AI",
		Tags:        []string{"tasks", "ai"},
	}, handler.CreateTaskNaturalLanguage)
}

func RegisterPreviewTaskNaturalLanguageOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "preview-task-natural-language",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/natural-language/preview",
		Summary:     "Preview tasks from natural language",
		Description: "Process natural language text and return a preview without creating tasks",
		Tags:        []string{"tasks", "ai"},
	}, handler.PreviewTaskNaturalLanguage)
}

func RegisterConfirmTaskNaturalLanguageOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "confirm-task-natural-language",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/natural-language/confirm",
		Summary:     "Create tasks from preview payload",
		Description: "Create tasks and categories using a previously generated preview payload",
		Tags:        []string{"tasks", "ai"},
	}, handler.ConfirmTaskNaturalLanguage)
}

func RegisterQueryTasksNaturalLanguageOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "query-tasks-natural-language",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/natural-language/query",
		Summary:     "Query tasks using natural language",
		Description: "Convert natural language to structured filters and return matching tasks using AI",
		Tags:        []string{"tasks", "ai"},
	}, handler.QueryTasksNaturalLanguage)
}

func RegisterEditTasksNaturalLanguageOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "edit-tasks-natural-language",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/natural-language/edit",
		Summary:     "Edit tasks using natural language",
		Description: "Use AI to find and edit one or more tasks based on a natural language instruction",
		Tags:        []string{"tasks", "ai"},
	}, handler.EditTasksNaturalLanguage)
}

func RegisterIntentTaskNaturalLanguageOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "intent-task-natural-language",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/natural-language/intent",
		Summary:     "Unified natural language intent router",
		Description: "Decompose a natural language utterance into create/edit/delete operations. Edit ops are applied immediately; create and delete payloads are returned for frontend confirmation.",
		Tags:        []string{"tasks", "ai"},
	}, handler.IntentTaskNaturalLanguage)
}
