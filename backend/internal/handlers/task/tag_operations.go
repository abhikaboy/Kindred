package task

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type UpdateTaskTagsInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Category      string `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          struct {
		TaggedUserIDs []string `json:"taggedUserIds"`
	}
}

type UpdateTaskTagsOutput struct {
	Body struct {
		TaggedUsers []types.TaggedTaskUser `json:"taggedUsers"`
	}
}

func (h *Handler) UpdateTaskTags(ctx context.Context, input *UpdateTaskTagsInput) (*UpdateTaskTagsOutput, error) {
	taskID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}
	categoryID, err := primitive.ObjectIDFromHex(input.Category)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID format", err)
	}
	contextID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userObjID, err := primitive.ObjectIDFromHex(contextID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	added, err := h.service.UpdateTaskTags(userObjID, categoryID, taskID, input.Body.TaggedUserIDs)
	if err != nil {
		switch {
		case errors.Is(err, ErrTaskNotFound):
			return nil, huma.Error404NotFound("Task not found in this category", err)
		// verifyCategoryOwnership returns raw mongo.ErrNoDocuments when the
		// category is missing or not owned by the caller — treat as 404
		case errors.Is(err, ErrCategoryNotFound), errors.Is(err, mongo.ErrNoDocuments):
			return nil, huma.Error404NotFound("Category not found", err)
		case errors.Is(err, ErrNotCategoryOwner):
			return nil, huma.Error403Forbidden("You do not have access to this category", err)
		default:
			slog.Error("Failed to update task tags",
				"taskId", taskID.Hex(),
				"categoryId", categoryID.Hex(),
				"userId", userObjID.Hex(),
				"error", err)
			return nil, huma.Error500InternalServerError("Unable to update tags", err)
		}
	}

	task, err := h.service.findTaskInCategory(ctx, categoryID, taskID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to fetch updated task", err)
	}

	// Notify only newly added friends (best-effort)
	if len(added) > 0 {
		notifyTask := *task
		notifyTask.TaggedUsers = added
		go h.service.NotifyTaggedUsers(&notifyTask, userObjID)
	}

	resp := &UpdateTaskTagsOutput{}
	resp.Body.TaggedUsers = task.TaggedUsers
	return resp, nil
}

func RegisterUpdateTaskTagsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-task-tags",
		Method:      http.MethodPatch,
		Path:        "/v1/user/tasks/{category}/{id}/tags",
		Summary:     "Update task tags",
		Description: "Replace the set of friends tagged on a task",
		Tags:        []string{"tasks"},
	}, handler.UpdateTaskTags)
}

type GetPendingTaggedTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetPendingTaggedTasksOutput struct {
	Body []PendingTaggedTask `json:"body"`
}

func (h *Handler) GetPendingTaggedTasks(ctx context.Context, input *GetPendingTaggedTasksInput) (*GetPendingTaggedTasksOutput, error) {
	contextID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userObjID, err := primitive.ObjectIDFromHex(contextID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	pending, err := h.service.GetPendingTaggedTasks(userObjID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to fetch pending tags", err)
	}
	return &GetPendingTaggedTasksOutput{Body: pending}, nil
}

func RegisterGetPendingTaggedTasksOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-pending-tagged-tasks",
		Method:      http.MethodGet,
		Path:        "/v1/user/tagged-tasks",
		Summary:     "Get pending tagged tasks",
		Description: "Tasks the signed-in user has been tagged in and not yet responded to",
		Tags:        []string{"tasks"},
	}, handler.GetPendingTaggedTasks)
}

type RespondToTaskTagInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          struct {
		Status string `json:"status" enum:"watching,copied,untagged"`
	} `json:"body"`
}

type RespondToTaskTagOutput struct {
	Body struct {
		Message string `json:"message" example:"Response recorded"`
	} `json:"body"`
}

func (h *Handler) RespondToTaskTag(ctx context.Context, input *RespondToTaskTagInput) (*RespondToTaskTagOutput, error) {
	taskID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}
	contextID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	responderID, err := primitive.ObjectIDFromHex(contextID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Validate status at handler level (huma enum is schema-level defense; this is defense-in-depth)
	status := types.TagStatus(input.Body.Status)
	if status != types.TagStatusWatching && status != types.TagStatusCopied && status != types.TagStatusUntagged {
		return nil, huma.Error400BadRequest("Status must be one of: watching, copied, untagged", nil)
	}

	if err := h.service.RespondToTaskTag(taskID, responderID, status); err != nil {
		switch {
		case errors.Is(err, mongo.ErrNoDocuments):
			return nil, huma.Error404NotFound("Task not found", err)
		default:
			slog.Error("Failed to respond to task tag",
				"taskId", taskID.Hex(),
				"responderId", responderID.Hex(),
				"error", err)
			return nil, huma.Error500InternalServerError("Unable to record response", err)
		}
	}

	if status == types.TagStatusCopied {
		if task, ownerID := h.service.lookupTaskAndOwner(taskID); task != nil {
			go h.service.notifyTaskCopied(taskID, ownerID, responderID, task.Content)
		}
	}

	resp := &RespondToTaskTagOutput{}
	resp.Body.Message = "Response recorded"
	return resp, nil
}

func RegisterRespondToTaskTagOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "respond-to-task-tag",
		Method:      http.MethodPost,
		Path:        "/v1/user/tagged-tasks/{id}/respond",
		Summary:     "Respond to a task tag",
		Description: "Watch, copy, or untag yourself from a task you were tagged in",
		Tags:        []string{"tasks"},
	}, handler.RespondToTaskTag)
}
