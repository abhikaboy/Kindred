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
