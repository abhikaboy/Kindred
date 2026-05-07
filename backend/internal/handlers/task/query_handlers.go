package task

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// QueryTasksByUser handles POST /v1/user/tasks/query
func (h *Handler) QueryTasksByUser(ctx context.Context, input *QueryTasksByUserInput) (*QueryTasksByUserOutput, error) {
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	tasks, err := h.service.QueryTasksByUser(user_id_obj, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to query tasks. Please try again.", err)
	}

	return &QueryTasksByUserOutput{Body: tasks}, nil
}

func (h *Handler) GetCompletedTasks(ctx context.Context, input *GetCompletedTasksInput) (*GetCompletedTasksOutput, error) {
	context_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Use default values if not provided
	page := input.Page
	if page < 1 {
		page = 1
	}
	limit := input.Limit
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	tasks, totalCount, err := h.service.GetCompletedTasks(userObjID, page, limit)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch completed tasks", err)
	}

	// Calculate total pages
	totalPages := int(totalCount) / limit
	if int(totalCount)%limit > 0 {
		totalPages++
	}

	output := &GetCompletedTasksOutput{}
	output.Body.Tasks = tasks
	output.Body.Page = page
	output.Body.Limit = limit
	output.Body.Total = totalCount
	output.Body.TotalPages = totalPages

	return output, nil
}

func (h *Handler) GetCompletedTasksByDate(ctx context.Context, input *GetCompletedTasksByDateInput) (*GetCompletedTasksByDateOutput, error) {
	context_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Parse timezone or default to UTC
	loc := time.UTC
	if input.Timezone != "" {
		var err error
		loc, err = time.LoadLocation(input.Timezone)
		if err != nil {
			// Fallback to UTC if timezone is invalid, but log it
			slog.LogAttrs(ctx, slog.LevelWarn, "Invalid timezone provided, defaulting to UTC",
				slog.String("timezone", input.Timezone),
				slog.String("error", err.Error()))
			loc = time.UTC
		}
	}

	// Re-parse date in the correct location to get midnight in that timezone
	dateInLoc, err := time.ParseInLocation("2006-01-02", input.Date, loc)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid date format", err)
	}

	tasks, err := h.service.GetCompletedTasksByDate(userObjID, dateInLoc)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "GetCompletedTasksByDate: service error",
			slog.String("error", err.Error()))
		return nil, huma.Error500InternalServerError("Failed to fetch completed tasks", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "GetCompletedTasksByDate: returning tasks",
		slog.String("date", input.Date),
		slog.String("timezone", input.Timezone),
		slog.Int("taskCount", len(tasks)))

	output := &GetCompletedTasksByDateOutput{}
	output.Body.Tasks = tasks
	return output, nil
}
