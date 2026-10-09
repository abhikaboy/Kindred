package task

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
)

// maxSplitTasks caps how many tasks one quick-capture line can become.
const maxSplitTasks = 6

type SplitTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Text     string `json:"text" minLength:"1" maxLength:"1000" doc:"One line the user typed in quick capture" example:"email the landlord and pay rent by friday"`
		Timezone string `json:"timezone,omitempty" doc:"User's timezone (IANA format). Defaults to America/New_York if not provided" example:"America/New_York"`
	} `json:"body"`
}

type SplitTasksOutput struct {
	Body struct {
		Tasks []string `json:"tasks" doc:"Separate tasks in the order written. A single task comes back as one entry."`
	}
}

// splitTasksDraft mirrors gemini.SplitTasksFlowOutput.
type splitTasksDraft struct {
	Tasks []string `json:"tasks"`
}

// SplitTasks breaks one quick-capture line into separate tasks. It's additive:
// when AI is unavailable the line comes back unchanged, and no credits are used.
func (h *Handler) SplitTasks(ctx context.Context, input *SplitTasksInput) (*SplitTasksOutput, error) {
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	text := strings.TrimSpace(input.Body.Text)
	out := &SplitTasksOutput{}
	out.Body.Tasks = []string{text}
	if text == "" {
		return out, nil
	}

	timezone := input.Body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	var draft splitTasksDraft
	flowInput := map[string]any{"text": text, "timezone": timezone}
	if err := runGeminiFlow(ctx, h.geminiService, "SplitTasksFlow", flowInput, &draft); err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Task split failed", slog.String("userID", userID), slog.String("error", err.Error()))
		return out, nil
	}

	if tasks := CleanSplitTasks(draft.Tasks); len(tasks) > 0 {
		out.Body.Tasks = tasks
	}
	return out, nil
}

// CleanSplitTasks trims the model's entries, drops blanks and caps the count.
func CleanSplitTasks(tasks []string) []string {
	out := make([]string, 0, len(tasks))
	for _, t := range tasks {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		out = append(out, t)
		if len(out) == maxSplitTasks {
			break
		}
	}
	return out
}

func RegisterSplitTasksOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "split-tasks",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/split",
		Summary:     "Split a quick-capture line into tasks",
		Description: "Break one line with several separate tasks into one entry each, copying shared times into each. A single task comes back as one entry. Additive: returns the original line when AI is unavailable, and consumes no credits.",
		Tags:        []string{"tasks", "ai"},
	}, handler.SplitTasks)
}
