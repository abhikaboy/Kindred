package gemini

import (
	Category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/handlers/task"
)

type GenerateTaskParams struct {
	Description string `json:"description"`
}

type GenerateTaskFromImageParams struct {
	Image string `json:"image"`
}

type GenerateTaskFromImageOutput struct {
	Categories []Category.CreateCategoryParams `json:"categories"`
	Tasks      []task.CreateTaskParams         `json:"tasks"`
}

type MultiTaskFromTextInput struct {
	Text string `json:"text"`
}

type MultiTaskFromTextOutput struct {
	Categories []Category.CreateCategoryParams `json:"categories"`
	Tasks      []task.CreateTaskParams         `json:"tasks"`
}

// Input for getUserCategories tool
type GetUserCategoriesInput struct {
	UserID string `json:"userId" jsonschema_description:"The user's ObjectID as a hex string (e.g., '507f1f77bcf86cd799439011')"`
}

// Output containing user's categories grouped by workspace
type GetUserCategoriesOutput struct {
	UserID     string          `json:"userId"`
	Workspaces []WorkspaceInfo `json:"workspaces"`
}

type WorkspaceInfo struct {
	Name       string         `json:"name"`
	Categories []CategoryInfo `json:"categories"`
}

type CategoryInfo struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	WorkspaceName string `json:"workspaceName"`
	TaskCount     int    `json:"taskCount"`
}

// Enhanced input that includes user ID for context
type MultiTaskFromTextInputWithUser struct {
	UserID string `json:"userId"`
	Text   string `json:"text"`
}
