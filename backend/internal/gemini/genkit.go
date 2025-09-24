package gemini

import (
	"context"
	"fmt"

	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/firebase/genkit/go/genkit"
	"github.com/firebase/genkit/go/plugins/googlegenai"
)

func InitGenkit() *GeminiService {
	// Initialize Genkit with the Google AI plugin
	g := genkit.Init(context.Background(),
		genkit.WithPlugins(&googlegenai.GoogleAI{}),
		genkit.WithDefaultModel("googleai/gemini-2.5-flash"),
	)

	taskFlow := genkit.DefineFlow(g, "generate-task",
		func(ctx context.Context, input *task.CreateTaskParams) (*task.CreateTaskParams, error) {
			prompt := fmt.Sprintf(`Generate a task based on the following description: %s`, input.Description)
			result, _, err := genkit.Generate[task.CreateTaskParams](prompt)
			if err != nil {
				return nil, err
			}
			return result, nil
		})

	return &GeminiService{
		genkit:   g,
		taskFlow: taskFlow,
	}
}
