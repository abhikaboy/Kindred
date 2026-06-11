package task

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type LogTaskEntry struct {
	Content string `json:"content" example:"Went to the gym" doc:"What the user got done"`
}

type LogTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		WorkspaceName string         `json:"workspaceName" example:"Personal" doc:"Workspace whose Logged category receives the tasks"`
		Tasks         []LogTaskEntry `json:"tasks" minItems:"1" maxItems:"50" doc:"Things the user did today"`
	} `json:"body"`
}

type LogTasksOutput struct {
	Body struct {
		Message       string `json:"message" example:"Tasks logged"`
		TasksLogged   int    `json:"tasksLogged" example:"3" doc:"Number of entries created and completed"`
		CurrentStreak int    `json:"currentStreak" example:"5" doc:"The user's current streak count"`
		FailedIndices []int  `json:"failedIndices,omitempty" doc:"Indices of entries that failed"`
	}
}

func (h *Handler) LogTasks(ctx context.Context, input *LogTasksInput) (*LogTasksOutput, error) {
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userObjID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	if strings.TrimSpace(input.Body.WorkspaceName) == "" {
		return nil, huma.Error400BadRequest("Workspace name is required", nil)
	}
	contents := make([]string, 0, len(input.Body.Tasks))
	for i, entry := range input.Body.Tasks {
		content := strings.TrimSpace(entry.Content)
		if content == "" {
			return nil, huma.Error400BadRequest(fmt.Sprintf("Entry %d is empty", i), nil)
		}
		contents = append(contents, content)
	}

	result, err := h.service.LogTasks(userObjID, input.Body.WorkspaceName, contents)
	if err != nil {
		slog.Error("Failed to log tasks", "userId", userObjID.Hex(), "count", len(contents), "error", err)
		return nil, huma.Error500InternalServerError("Unable to log tasks due to a server error. Please try again.", err)
	}

	// Fire-and-forget: each logged task counts as a creation (Plan) and a
	// completion (Do), matching the BulkCompleteTask pattern.
	if h.service.RingService != nil && result.TasksLogged > 0 {
		go func() {
			tz := auth.GetTimezoneOrDefault(ctx)
			for i := 0; i < result.TasksLogged; i++ {
				for _, ring := range []rings.RingType{rings.RingPlan, rings.RingDo} {
					_, delta, err := h.service.RingService.IncrementRing(context.Background(), userObjID, tz, ring)
					if err != nil {
						slog.Error("Failed to increment ring on task log", "user_id", userObjID.Hex(), "ring", ring, "error", err)
						return
					}
					if delta.JustClosedAll {
						h.service.RingService.NotifyAllRingsClosed(userObjID)
						return
					}
				}
			}
		}()
	}

	resp := &LogTasksOutput{}
	resp.Body.Message = "Tasks logged"
	resp.Body.TasksLogged = result.TasksLogged
	resp.Body.CurrentStreak = result.CurrentStreak
	if len(result.FailedIndices) > 0 {
		resp.Body.FailedIndices = result.FailedIndices
	}
	return resp, nil
}

func RegisterLogTasksOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "log-tasks",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/log",
		Summary:     "Log completed tasks",
		Description: "Create and immediately complete tasks in the workspace's Logged category. Used by the end-of-day review card for work that was done but never tracked.",
		Tags:        []string{"tasks"},
	}, handler.LogTasks)
}
