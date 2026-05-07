package task

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func (h *Handler) CreateTaskFromTemplate(ctx context.Context, input *CreateTaskFromTemplateInput) (*CreateTaskFromTemplateOutput, error) {
	templateID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid template ID format", err)
	}

	// Extract user_id from context (set by auth middleware)
	_, err = auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	doc, err := h.service.CreateTaskFromTemplate(templateID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create task from template", err)
	}

	return &CreateTaskFromTemplateOutput{Body: *doc}, nil
}

/*
Get all the tasks with start times that are at least a day older than the current time
*/
func (h *Handler) GetTasksWithStartTimesOlderThanOneDay(ctx context.Context, input *GetTasksWithStartTimesOlderThanOneDayInput) (*GetTasksWithStartTimesOlderThanOneDayOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	tasks, err := h.service.GetTasksWithStartTimesOlderThanOneDay(userObjID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to load tasks. Please try again.", err)
	}

	return &GetTasksWithStartTimesOlderThanOneDayOutput{Body: tasks}, nil
}

func (h *Handler) GetRecurringTasksWithPastDeadlines(ctx context.Context, input *GetRecurringTasksWithPastDeadlinesInput) (*GetRecurringTasksWithPastDeadlinesOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	tasks, err := h.service.GetRecurringTasksWithPastDeadlines(userObjID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch recurring tasks", err)
	}

	return &GetRecurringTasksWithPastDeadlinesOutput{Body: tasks}, nil
}

func (h *Handler) GetTemplateByID(ctx context.Context, input *GetTemplateByIDInput) (*GetTemplateByIDOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid template ID format", err)
	}

	template, err := h.service.GetTemplateByID(id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch template", err)
	}

	return &GetTemplateByIDOutput{Body: *template}, nil
}

func (h *Handler) UpdateTemplate(ctx context.Context, input *UpdateTemplateInput) (*UpdateTemplateOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid template ID format", err)
	}

	err = h.service.UpdateTemplateTask(id, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update template task", err)
	}

	resp := &UpdateTemplateOutput{}
	resp.Body.Message = "Template task updated successfully"
	return resp, nil
}

func (h *Handler) ResetTemplateMetrics(ctx context.Context, input *ResetTemplateMetricsInput) (*ResetTemplateMetricsOutput, error) {
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid template ID format", err)
	}

	err = h.service.ResetTemplateMetrics(id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to reset template metrics", err)
	}

	resp := &ResetTemplateMetricsOutput{}
	resp.Body.Message = "Template metrics reset successfully"
	return resp, nil
}

func (h *Handler) UndoMissedTask(ctx context.Context, input *UndoMissedTaskInput) (*UndoMissedTaskOutput, error) {
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid template ID format", err)
	}

	result, err := h.service.UndoMissedTask(id)
	if err != nil {
		if err.Error() == "undo window has expired (must be within 24 hours of the miss)" {
			return nil, huma.Error409Conflict("Undo window has expired", err)
		}
		if err.Error() == "no recent miss to undo" {
			return nil, huma.Error409Conflict("No recent miss to undo for this template", err)
		}
		return nil, huma.Error500InternalServerError("Failed to undo missed task", err)
	}

	resp := &UndoMissedTaskOutput{}
	resp.Body.Message = "Missed task successfully marked as completed"
	resp.Body.Streak = result.Streak
	resp.Body.HighestStreak = result.HighestStreak
	return resp, nil
}

func (h *Handler) GetUserTemplates(ctx context.Context, input *GetUserTemplatesInput) (*GetUserTemplatesOutput, error) {
	userId, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "GetUserTemplates handler called",
		slog.String("userId", userId))

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	templates, err := h.service.GetTemplatesByUserWithCategory(userObjID)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to fetch templates",
			slog.String("error", err.Error()))
		return nil, huma.Error500InternalServerError("Failed to fetch templates", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "GetUserTemplates handler returning",
		slog.Int("templateCount", len(templates)))

	output := &GetUserTemplatesOutput{}
	output.Body.Templates = templates
	return output, nil
}
