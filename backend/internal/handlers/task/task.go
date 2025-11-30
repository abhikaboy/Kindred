package task

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var validator = xvalidator.Validator

// CategoryTaskPairLocal is a local definition to avoid circular import with gemini package
type CategoryTaskPairLocal struct {
	CategoryID   string           `json:"categoryId"`
	CategoryName string           `json:"categoryName,omitempty"`
	Task         CreateTaskParams `json:"task"`
}

// NewCategoryWithTasksLocal represents a new category to create with its tasks
type NewCategoryWithTasksLocal struct {
	Name          string             `json:"name"`
	WorkspaceName string             `json:"workspaceName"`
	Tasks         []CreateTaskParams `json:"tasks"`
}

// MultiTaskOutputLocal is a local definition to avoid circular import with gemini package
type MultiTaskOutputLocal struct {
	Categories []NewCategoryWithTasksLocal `json:"categories"`
	Tasks      []CategoryTaskPairLocal     `json:"tasks"`
}

type Handler struct {
	service       *Service
	geminiService any // Service interface - using any to avoid circular import
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

	isActive := true
	if taskParams.Active != nil {
		isActive = *taskParams.Active
	}

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
		Active:         isActive,
		UserID:         userObjID,
		CategoryID:     categoryID,
		Deadline:       taskParams.Deadline,
		StartTime:      taskParams.StartTime,
		StartDate:      taskParams.StartDate,
		Notes:          taskParams.Notes,
		Checklist:      taskParams.Checklist,
		Reminders:      taskParams.Reminders,
		Integration:    taskParams.Integration,
		Timestamp:      time.Now(),
		LastEdited:     time.Now(),
	}

	// Combine StartDate and StartTime if both are provided
	// StartTime from the time picker includes the current date, but we want to use the date from StartDate
	if task.StartTime != nil && task.StartDate != nil {
		// Extract time components (hour, minute, second) from StartTime
		hour, min, sec := task.StartTime.Clock()

		// Combine the date from StartDate with the time from StartTime
		combinedDateTime := time.Date(
			task.StartDate.Year(),
			task.StartDate.Month(),
			task.StartDate.Day(),
			hour, min, sec, 0,
			task.StartDate.Location(),
		)

		// Update StartDate to include the time
		task.StartDate = &combinedDateTime
		// Keep StartTime as well for potential future use/display
	} else if task.StartDate == nil {
		// Set default StartDate to today if not provided at all
		now := time.Now()

		// If we have a StartTime, combine it with today's date
		if task.StartTime != nil {
			hour, min, sec := task.StartTime.Clock()
			combinedDateTime := time.Date(
				now.Year(),
				now.Month(),
				now.Day(),
				hour, min, sec, 0,
				now.Location(),
			)
			task.StartDate = &combinedDateTime
		} else {
			// No time specified, just use today's date
			task.StartDate = &now
		}
	}

	// Handle recurring task template creation if this is a recurring task
	if task.Recurring {
		templateID := primitive.NewObjectID()
		task.TemplateID = &templateID

		err := h.handleRecurringTaskCreation(task, taskParams, categoryID, taskParams.Deadline, taskParams.StartTime, taskParams.StartDate, taskParams.Reminders)
		if err != nil {
			return nil, huma.Error500InternalServerError("Failed to create recurring task template", err)
		}
	}

	doc, err := h.service.CreateTask(categoryID, &task)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create task", err)
	}

	return &CreateTaskOutput{Body: *doc}, nil
}

// handleRecurringTaskCreation creates a template task for recurring tasks
func (h *Handler) handleRecurringTaskCreation(task TaskDocument, params CreateTaskParams, categoryId primitive.ObjectID, deadline *time.Time, startTime *time.Time, startDate *time.Time, reminders []*Reminder) error {
	if !task.Recurring {
		return nil
	}

	if params.RecurFrequency == "" {
		return fmt.Errorf("invalid recurring frequency")
	}
	if params.RecurDetails == nil {
		return fmt.Errorf("recurring details are required")
	}

	recurType := "OCCURRENCE"

	// if we have a deadline with no start information
	if params.Deadline != nil {
		recurType = "DEADLINE"
		if params.StartTime != nil || params.StartDate != nil {
			recurType = "WINDOW"
		}
	}

	baseTime := xutils.NowUTC()
	if params.Deadline != nil {
		baseTime = *params.Deadline
	} else if params.StartTime != nil {
		baseTime = *params.StartTime
	}

	// filter out non relative reminders
	relativeReminders := make([]*Reminder, 0)
	for _, reminder := range reminders {
		if reminder.Type == "RELATIVE" {
			relativeReminders = append(relativeReminders, reminder)
		}
	}

	// Create a template for the recurring task
	template_doc := TemplateTaskDocument{
		UserID:         task.UserID,
		CategoryID:     categoryId,
		ID:             *task.TemplateID, // Use the template ID that was set
		Content:        params.Content,
		Priority:       params.Priority,
		Value:          params.Value,
		Public:         params.Public,
		RecurType:      recurType,
		RecurFrequency: params.RecurFrequency,
		RecurDetails:   params.RecurDetails,

		Deadline:      deadline,
		StartTime:     startTime,
		StartDate:     startDate,
		LastGenerated: &baseTime,
		Reminders:     relativeReminders,
	}

	var next_occurence time.Time
	var err error

	if recurType == "OCCURRENCE" {
		next_occurence, err = h.service.ComputeNextOccurrence(&template_doc)
		if err != nil {
			return fmt.Errorf("error creating OCCURRENCE template task: %w", err)
		}
	} else if recurType == "DEADLINE" {
		next_occurence, err = h.service.ComputeNextDeadline(&template_doc)
		if err != nil {
			return fmt.Errorf("error creating DEADLINE template task: %w", err)
		}
	} else if recurType == "WINDOW" {
		next_occurence, err = h.service.ComputeNextOccurrence(&template_doc)
		if err != nil {
			return fmt.Errorf("error creating WINDOW template task: %w", err)
		}
	}

	template_doc.NextGenerated = &next_occurence

	_, err = h.service.CreateTemplateTask(categoryId, &template_doc)
	if err != nil {
		return fmt.Errorf("error creating template task: %w", err)
	}

	return nil
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

	// Use the CompleteTask service method and get streak info
	result, err := h.service.CompleteTask(userObjID, id, categoryID, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to complete task", err)
	}

	// Delete the task from the tasks collection
	_, err = h.DeleteTask(ctx, &DeleteTaskInput{
		ID:       input.ID,
		Category: input.Category,
	})
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete task", err)
	}

	resp := &CompleteTaskOutput{}
	resp.Body.Message = "Task completed successfully"
	resp.Body.StreakChanged = result.StreakChanged
	resp.Body.CurrentStreak = result.CurrentStreak
	resp.Body.TasksComplete = result.TasksComplete
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
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// If deleteRecurring is true, get the task first to retrieve its template ID
	var templateID *primitive.ObjectID
	if input.DeleteRecurring {
		task, err := h.service.GetTaskByID(id, userID)
		if err != nil {
			return nil, huma.Error404NotFound("Task not found", err)
		}

		if task.TemplateID != nil {
			templateID = task.TemplateID
		}
	}

	// Delete the task
	err = h.service.DeleteTask(categoryID, id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete task", err)
	}

	// If requested and template exists, delete the recurring template as well
	if templateID != nil {
		err = h.service.DeleteTemplateTask(*templateID)
		if err != nil {
			// Log the error but don't fail the entire operation since the task was already deleted
			fmt.Printf("Warning: Failed to delete template task %s: %v\n", templateID.Hex(), err)
		}
	}

	resp := &DeleteTaskOutput{}
	message := "Task deleted successfully"
	if templateID != nil {
		message = "Task and recurring template deleted successfully"
	}
	resp.Body.Message = message
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
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	tasks, err := h.service.GetTasksWithStartTimesOlderThanOneDay(userObjID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch tasks", err)
	}

	return &GetTasksWithStartTimesOlderThanOneDayOutput{Body: tasks}, nil
}

func (h *Handler) GetRecurringTasksWithPastDeadlines(ctx context.Context, input *GetRecurringTasksWithPastDeadlinesInput) (*GetRecurringTasksWithPastDeadlinesOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	tasks, err := h.service.GetRecurringTasksWithPastDeadlines(userObjID)
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

func (h *Handler) UpdateTemplate(ctx context.Context, input *UpdateTemplateInput) (*UpdateTemplateOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
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

func (h *Handler) GetCompletedTasks(ctx context.Context, input *GetCompletedTasksInput) (*GetCompletedTasksOutput, error) {
	context_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
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
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(context_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	date, err := time.Parse("2006-01-02", input.Date)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid date format (use YYYY-MM-DD)", err)
	}

	tasks, err := h.service.GetCompletedTasksByDate(userObjID, date)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch completed tasks", err)
	}

	output := &GetCompletedTasksByDateOutput{}
	output.Body.Tasks = tasks
	return output, nil
}

// Specialized update handlers

// UpdateTaskDeadline updates the deadline field of a task
func (h *Handler) UpdateTaskDeadline(ctx context.Context, input *UpdateTaskDeadlineInput) (*UpdateTaskDeadlineOutput, error) {
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

	err = h.service.UpdateTaskDeadline(id, categoryID, userObjID, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update task deadline", err)
	}

	resp := &UpdateTaskDeadlineOutput{}
	resp.Body.Message = "Task deadline updated successfully"
	return resp, nil
}

// UpdateTaskStart updates the start date and time fields of a task
func (h *Handler) UpdateTaskStart(ctx context.Context, input *UpdateTaskStartInput) (*UpdateTaskStartOutput, error) {
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

	err = h.service.UpdateTaskStart(id, categoryID, userObjID, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update task start date/time", err)
	}

	resp := &UpdateTaskStartOutput{}
	resp.Body.Message = "Task start date/time updated successfully"
	return resp, nil
}

// UpdateTaskReminders updates the reminders field of a task
func (h *Handler) UpdateTaskReminders(ctx context.Context, input *UpdateTaskReminderInput) (*UpdateTaskReminderOutput, error) {
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

	err = h.service.UpdateTaskReminders(id, categoryID, userObjID, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update task reminders", err)
	}

	resp := &UpdateTaskReminderOutput{}
	resp.Body.Message = "Task reminders updated successfully"
	return resp, nil
}

// CreateTaskNaturalLanguage processes natural language text to create tasks and categories using AI
func (h *Handler) CreateTaskNaturalLanguage(ctx context.Context, input *CreateTaskNaturalLanguageInput) (*CreateTaskNaturalLanguageOutput, error) {
	// Validate input
	if input.Body.Text == "" {
		return nil, huma.Error400BadRequest("Text field is required", nil)
	}

	// Extract and validate user ID
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Consume credit atomically - this checks and decrements in one operation
	err = types.ConsumeCredit(ctx, h.service.Users, userObjID, types.CreditTypeNaturalLanguage)
	if err != nil {
		if err == types.ErrInsufficientCredits {
			return nil, huma.Error403Forbidden("Insufficient credits. You need at least 1 natural language credit to use this feature.", err)
		}
		slog.LogAttrs(ctx, slog.LevelError, "Failed to consume credit",
			slog.String("userID", userID),
			slog.String("error", err.Error()))
		return nil, huma.Error500InternalServerError("Failed to process credit", err)
	}

	// Default to EST if no timezone provided
	timezone := input.Body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Starting natural language task creation",
		slog.String("userID", userID),
		slog.String("inputText", input.Body.Text),
		slog.String("timezone", timezone))

	// Call Genkit flow to process natural language with retry logic
	result, err := h.callGeminiFlow(ctx, userID, input.Body.Text, timezone)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini flow failed, retrying once",
			slog.String("userID", userID),
			slog.String("error", err.Error()))

		// Retry once
		result, err = h.callGeminiFlow(ctx, userID, input.Body.Text, timezone)
		if err != nil {
			// Both attempts failed - refund the credit
			slog.LogAttrs(ctx, slog.LevelError, "Both attempts to call Gemini flow failed, refunding credit",
				slog.String("userID", userID),
				slog.String("error", err.Error()))

			// Refund the credit that was consumed earlier
			refundErr := types.AddCredits(ctx, h.service.Users, userObjID, types.CreditTypeNaturalLanguage, 1)
			if refundErr != nil {
				slog.LogAttrs(ctx, slog.LevelError, "Failed to refund credit after AI failure",
					slog.String("userID", userID),
					slog.String("refundError", refundErr.Error()))
				// Continue with error response even if refund fails - user should contact support
			} else {
				slog.LogAttrs(ctx, slog.LevelInfo, "Credit successfully refunded",
					slog.String("userID", userID))
			}

			return nil, huma.Error500InternalServerError("Failed to process natural language with AI after retry. Your credit has been refunded.", err)
		}

		slog.LogAttrs(ctx, slog.LevelInfo, "Retry successful after initial failure",
			slog.String("userID", userID))
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "AI response received",
		slog.Int("newCategories", len(result.Categories)),
		slog.Int("existingCategoryTasks", len(result.Tasks)))

	// Process new categories with their tasks
	newCategoryTasks, newCategoryMetadata, categoriesCreated, newCategoryTaskCount, err := h.processNewCategories(ctx, result.Categories, userObjID)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to process new categories",
			slog.String("userID", userID),
			slog.String("error", err.Error()))
		return nil, huma.Error500InternalServerError(err.Error(), err)
	}

	// Process tasks for existing categories
	existingCategoryTasks, existingCategoryTaskCount, err := h.processExistingCategoryTasks(ctx, result.Tasks, userObjID)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to process existing category tasks",
			slog.String("userID", userID),
			slog.String("error", err.Error()))
		return nil, huma.Error500InternalServerError(err.Error(), err)
	}

	// Combine all created tasks
	allTasks := append(newCategoryTasks, existingCategoryTasks...)
	totalTasks := newCategoryTaskCount + existingCategoryTaskCount

	slog.LogAttrs(ctx, slog.LevelInfo, "Natural language task creation completed",
		slog.String("userID", userID),
		slog.Int("totalTasks", totalTasks),
		slog.Int("categoriesCreated", categoriesCreated),
		slog.Int("tasksInNewCategories", newCategoryTaskCount),
		slog.Int("tasksInExistingCategories", existingCategoryTaskCount))

	// Build response
	output := &CreateTaskNaturalLanguageOutput{}
	output.Body.CategoriesCreated = categoriesCreated
	output.Body.NewCategories = newCategoryMetadata
	output.Body.TasksCreated = totalTasks
	output.Body.Tasks = allTasks

	if totalTasks == 0 {
		output.Body.Message = "No valid tasks could be created from the provided text"
	} else if categoriesCreated > 0 {
		output.Body.Message = fmt.Sprintf("Successfully created %d tasks in %d new categories", totalTasks, categoriesCreated)
	} else {
		output.Body.Message = fmt.Sprintf("Successfully created %d tasks in existing categories", totalTasks)
	}

	return output, nil
}
