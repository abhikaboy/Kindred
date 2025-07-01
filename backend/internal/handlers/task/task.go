package task

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var validator = xvalidator.Validator

type Handler struct {
	service *Service
}

func (h *Handler) GetTasksByUser(ctx context.Context, input *GetTasksByUserInput) (*GetTasksByUserOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Construct bson.D for sorting based on input parameters
	var sortDocument bson.D
	if input.SortBy != "" {
		sortDir := 1
		if input.SortDir == "desc" {
			sortDir = -1
		}
		sortDocument = bson.D{{Key: input.SortBy, Value: sortDir}}
	} else {
		// Default sort by timestamp descending
		sortDocument = bson.D{{Key: "timestamp", Value: -1}}
	}

	tasks, err := h.service.GetTasksByUser(user_id_obj, sortDocument)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch tasks", err)
	}

	return &GetTasksByUserOutput{Body: tasks}, nil
}

// parseTimesToUTC parses deadline, startTime, and startDate to UTC format
func parseTimesToUTC(params *CreateTaskParams) (*time.Time, *time.Time, *time.Time, error) {
	var deadline, startTime, startDate *time.Time

	if params.Deadline != nil {
		parsedDeadline, err := xutils.ParseTimeToUTC(*params.Deadline)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("invalid deadline format: %w", err)
		}
		deadline = &parsedDeadline
	}

	if params.StartTime != nil {
		parsedStartTime, err := xutils.ParseTimeToUTC(*params.StartTime)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("invalid start time format: %w", err)
		}
		startTime = &parsedStartTime
	}

	if params.StartDate != nil {
		parsedStartDate, err := xutils.ParseTimeToUTC(*params.StartDate)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("invalid start date format: %w", err)
		}
		startDate = &parsedStartDate
	}

	return deadline, startTime, startDate, nil
}

func (h *Handler) CreateTask(ctx context.Context, input *CreateTaskInput) (*CreateTaskOutput, error) {
	errs := validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	categoryIDFromPath := input.Category
	categoryID, err := primitive.ObjectIDFromHex(categoryIDFromPath)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID", err)
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	taskParams := input.Body

	// Create task document using fields from CreateTaskParams
	task := TaskDocument{
		ID:             primitive.NewObjectID(),
		Priority:       taskParams.Priority,
		Content:        taskParams.Content,
		Value:          taskParams.Value,
		Recurring:      taskParams.Recurring,
		RecurFrequency: taskParams.RecurFrequency,
		RecurDetails:   taskParams.RecurDetails,
		Public:         taskParams.Public,
		Active:         taskParams.Active,
		UserID:         userObjID,
		CategoryID:     categoryID,
		Deadline:       taskParams.Deadline,
		StartTime:      taskParams.StartTime,
		StartDate:      taskParams.StartDate,
		Notes:          taskParams.Notes,
		Checklist:      taskParams.Checklist,
		Reminders:      taskParams.Reminders,
		Timestamp:      time.Now(),
		LastEdited:     time.Now(),
	}

	// Set default StartDate to today if not provided
	if task.StartDate == nil {
		now := time.Now()
		task.StartDate = &now
	}

	doc, err := h.service.CreateTask(categoryID, &task)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create task", err)
	}

	return &CreateTaskOutput{Body: *doc}, nil
}

func (h *Handler) GetTasks(ctx context.Context, input *GetTasksInput) (*GetTasksOutput, error) {
	tasks, err := h.service.GetAllTasks()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch tasks", err)
	}

	return &GetTasksOutput{Body: tasks}, nil
}

func (h *Handler) GetTask(ctx context.Context, input *GetTaskInput) (*GetTaskOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	task, err := h.service.GetTaskByID(id, user_id_obj)
	if err != nil {
		return nil, huma.Error404NotFound("Task not found", err)
	}

	return &GetTaskOutput{Body: *task}, nil
}

/*
*

	@TODO - Add a verification to check if the user is the owner of the task
*/
func (h *Handler) UpdateTask(ctx context.Context, input *UpdateTaskInput) (*UpdateTaskOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}

	categoryID, err := primitive.ObjectIDFromHex(input.Category)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID format", err)
	}

	// Extract user_id from context (set by auth middleware)
	_, err = auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	updateData := input.Body

	// Use the UpdatePartialTask service method which matches the available service signature
	_, err = h.service.UpdatePartialTask(id, categoryID, updateData)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update task", err)
	}

	resp := &UpdateTaskOutput{}
	resp.Body.Message = "Task updated successfully"
	return resp, nil
}

/*
*

	@TODO - Add a verification to check if the user is the owner of the task
*/
func (h *Handler) CompleteTask(ctx context.Context, input *CompleteTaskInput) (*CompleteTaskOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}

	categoryID, err := primitive.ObjectIDFromHex(input.Category)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID format", err)
	}

	// Extract user_id from context (set by auth middleware)
	context_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Use the CompleteTask service method instead
	err = h.service.CompleteTask(userObjID, id, categoryID, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to complete task", err)
	}

	resp := &CompleteTaskOutput{}
	resp.Body.Message = "Task completed successfully"
	return resp, nil
}

/**
@TODO - Add a verification to check if the user is the owner of the task
*/

func (h *Handler) DeleteTask(ctx context.Context, input *DeleteTaskInput) (*DeleteTaskOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}

	categoryID, err := primitive.ObjectIDFromHex(input.Category)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID format", err)
	}

	// Extract user_id from context (set by auth middleware)
	_, err = auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	err = h.service.DeleteTask(categoryID, id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete task", err)
	}

	resp := &DeleteTaskOutput{}
	resp.Body.Message = "Task deleted successfully"
	return resp, nil
}

func (h *Handler) ActivateTask(ctx context.Context, input *ActivateTaskInput) (*ActivateTaskOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}

	categoryID, err := primitive.ObjectIDFromHex(input.Category)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID format", err)
	}

	// Extract user_id from context (set by auth middleware)
	context_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	active, err := strconv.ParseBool(input.Active)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid active parameter", err)
	}

	err = h.service.ActivateTask(userObjID, categoryID, id, active)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update task activation status", err)
	}

	resp := &ActivateTaskOutput{}
	resp.Body.Message = "Task activation status updated successfully"
	return resp, nil
}

func (h *Handler) GetActiveTasks(ctx context.Context, input *GetActiveTasksInput) (*GetActiveTasksOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	tasks, err := h.service.GetActiveTasks(id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch active tasks", err)
	}

	return &GetActiveTasksOutput{Body: tasks}, nil
}

func (h *Handler) CreateTaskFromTemplate(ctx context.Context, input *CreateTaskFromTemplateInput) (*CreateTaskFromTemplateOutput, error) {
	templateID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid template ID format", err)
	}

	// Extract user_id from context (set by auth middleware)
	_, err = auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
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
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	tasks, err := h.service.GetTasksWithStartTimesOlderThanOneDay()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch tasks", err)
	}

	return &GetTasksWithStartTimesOlderThanOneDayOutput{Body: tasks}, nil
}

func (h *Handler) GetRecurringTasksWithPastDeadlines(ctx context.Context, input *GetRecurringTasksWithPastDeadlinesInput) (*GetRecurringTasksWithPastDeadlinesOutput, error) {
	// Extract user_id from context (set by auth middleware)
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	tasks, err := h.service.GetRecurringTasksWithPastDeadlines()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch recurring tasks", err)
	}

	return &GetRecurringTasksWithPastDeadlinesOutput{Body: tasks}, nil
}

// UpdateTaskNotes updates the notes field of a task
func (h *Handler) UpdateTaskNotes(ctx context.Context, input *UpdateTaskNotesInput) (*UpdateTaskNotesOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}

	categoryID, err := primitive.ObjectIDFromHex(input.Category)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID format", err)
	}

	// Extract user_id from context (set by auth middleware)
	context_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	err = h.service.UpdateTaskNotes(id, categoryID, userObjID, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update task notes", err)
	}

	resp := &UpdateTaskNotesOutput{}
	resp.Body.Message = "Task notes updated successfully"
	return resp, nil
}

// UpdateTaskChecklist updates the checklist field of a task
func (h *Handler) UpdateTaskChecklist(ctx context.Context, input *UpdateTaskChecklistInput) (*UpdateTaskChecklistOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}

	categoryID, err := primitive.ObjectIDFromHex(input.Category)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID format", err)
	}

	// Extract user_id from context (set by auth middleware)
	context_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	err = h.service.UpdateTaskChecklist(id, categoryID, userObjID, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update task checklist", err)
	}

	resp := &UpdateTaskChecklistOutput{}
	resp.Body.Message = "Task checklist updated successfully"
	return resp, nil
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
