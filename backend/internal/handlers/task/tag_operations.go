package task

import (
	"context"
	"net/http"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
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
		return nil, huma.Error500InternalServerError("Unable to update tags", err)
	}

	// Notify only newly added friends (best-effort)
	if len(added) > 0 {
		if task, err := h.service.findTaskInCategory(ctx, categoryID, taskID); err == nil {
			notifyTask := *task
			notifyTask.TaggedUsers = added
			go h.service.NotifyTaggedUsers(&notifyTask, userObjID)
		}
	}

	task, err := h.service.findTaskInCategory(ctx, categoryID, taskID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to fetch updated task", err)
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
