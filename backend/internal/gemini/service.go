package gemini

import (
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/firebase/genkit/go/core"
	"github.com/firebase/genkit/go/genkit"
)

type GeminiService struct {
	Genkit   *genkit.Genkit
	TaskFlow *core.Flow[GenerateTaskParams, *task.CreateTaskParams, struct{}]
}
