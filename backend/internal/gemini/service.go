package gemini

import (
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/firebase/genkit/go/genkit"
)

type GeminiService struct {
	genkit   *genkit.Genkit
	taskFlow *genkit.Flow[task.CreateTaskParams]
}
