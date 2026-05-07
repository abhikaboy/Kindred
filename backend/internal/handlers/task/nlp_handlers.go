package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// QueryTasksNaturalLanguage handles POST /v1/user/tasks/natural-language/query
func (h *Handler) QueryTasksNaturalLanguage(ctx context.Context, input *QueryTasksNaturalLanguageInput) (*QueryTasksNaturalLanguageOutput, error) {
	if input.Body.Text == "" {
		return nil, huma.Error400BadRequest("Text field is required", nil)
	}

	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Consume credit
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

	timezone := input.Body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Starting natural language task query",
		slog.String("userID", userID),
		slog.String("inputText", input.Body.Text),
		slog.String("timezone", timezone))

	// Call Gemini flow with retry
	queryOutput, err := h.callGeminiQueryFlow(ctx, userID, input.Body.Text, timezone)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini query flow failed, retrying",
			slog.String("userID", userID),
			slog.String("error", err.Error()))

		queryOutput, err = h.callGeminiQueryFlow(ctx, userID, input.Body.Text, timezone)
		if err != nil {
			// Refund credit on failure
			refundErr := types.AddCredits(ctx, h.service.Users, userObjID, types.CreditTypeNaturalLanguage, 1)
			if refundErr != nil {
				slog.LogAttrs(ctx, slog.LevelError, "Failed to refund credit after AI failure",
					slog.String("userID", userID),
					slog.String("refundError", refundErr.Error()))
			} else {
				slog.LogAttrs(ctx, slog.LevelInfo, "Credit successfully refunded",
					slog.String("userID", userID))
			}
			return nil, huma.Error500InternalServerError("Failed to process natural language query with AI after retry. Your credit has been refunded.", err)
		}
	}

	// Convert AI output to TaskQueryFilters
	filters, err := convertQueryOutput(queryOutput)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to parse AI query response", err)
	}

	// Execute query
	tasks, err := h.service.QueryTasksByUser(userObjID, filters)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to query tasks. Please try again.", err)
	}

	output := &QueryTasksNaturalLanguageOutput{}
	output.Body.Tasks = tasks
	output.Body.Query = filters
	return output, nil
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
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
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

// EditTasksNaturalLanguage processes a natural language edit instruction and applies changes to matching tasks.
func (h *Handler) EditTasksNaturalLanguage(ctx context.Context, input *EditTasksNaturalLanguageInput) (*EditTasksNaturalLanguageOutput, error) {
	if input.Body.Text == "" {
		return nil, huma.Error400BadRequest("Text field is required", nil)
	}

	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Consume credit
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

	timezone := input.Body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Starting natural language task edit",
		slog.String("userID", userID),
		slog.String("inputText", input.Body.Text),
		slog.String("timezone", timezone))

	// Call Gemini flow with one retry
	editOutput, err := h.callGeminiEditFlow(ctx, userID, input.Body.Text, timezone)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini edit flow failed, retrying",
			slog.String("userID", userID),
			slog.String("error", err.Error()))

		editOutput, err = h.callGeminiEditFlow(ctx, userID, input.Body.Text, timezone)
		if err != nil {
			// Refund credit on failure
			refundErr := types.AddCredits(ctx, h.service.Users, userObjID, types.CreditTypeNaturalLanguage, 1)
			if refundErr != nil {
				slog.LogAttrs(ctx, slog.LevelError, "Failed to refund credit after AI failure",
					slog.String("userID", userID),
					slog.String("refundError", refundErr.Error()))
			} else {
				slog.LogAttrs(ctx, slog.LevelInfo, "Credit successfully refunded",
					slog.String("userID", userID))
			}
			return nil, huma.Error500InternalServerError("Failed to process natural language edit with AI after retry. Your credit has been refunded.", err)
		}
	}

	if len(editOutput.Instructions) == 0 && len(editOutput.TemplateInstructions) == 0 {
		output := &EditTasksNaturalLanguageOutput{}
		output.Body.Tasks = []TaskDocument{}
		output.Body.Templates = []TemplateTaskDocument{}
		output.Body.EditedCount = 0
		output.Body.Message = "No matching tasks found"
		return output, nil
	}

	var editedTasks []TaskDocument
	for _, instruction := range editOutput.Instructions {
		taskObjID, err := primitive.ObjectIDFromHex(instruction.TaskID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Invalid task ID from AI", slog.String("taskID", instruction.TaskID))
			continue
		}

		categoryObjID, err := primitive.ObjectIDFromHex(instruction.CategoryID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Invalid category ID from AI", slog.String("categoryID", instruction.CategoryID))
			continue
		}

		// Fetch current task to build merge base
		currentTask, err := h.service.GetTaskByID(taskObjID, userObjID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Task not found for edit", slog.String("taskID", instruction.TaskID))
			continue
		}

		// Apply core field updates via UpdatePartialTask
		merged := mergeTaskWithEdits(*currentTask, instruction.Updates)
		if _, err = h.service.UpdatePartialTask(taskObjID, categoryObjID, merged); err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to update task core fields",
				slog.String("taskID", instruction.TaskID),
				slog.String("error", err.Error()))
			continue
		}

		// Handle notes update (UpdatePartialTask skips empty strings)
		if instruction.Updates.Notes != nil {
			notesErr := h.service.UpdateTaskNotes(taskObjID, categoryObjID, userObjID, UpdateTaskNotesDocument{Notes: *instruction.Updates.Notes})
			if notesErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Failed to update task notes",
					slog.String("taskID", instruction.TaskID),
					slog.String("error", notesErr.Error()))
			}
		}

		// Handle deadline update (set, clear, or skip)
		if instruction.Updates.Deadline != nil {
			deadlineDoc := UpdateTaskDeadlineDocument{}
			if *instruction.Updates.Deadline != "" {
				t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.Deadline)
				if parseErr != nil {
					slog.LogAttrs(ctx, slog.LevelWarn, "Invalid deadline ISO8601 from AI",
						slog.String("deadline", *instruction.Updates.Deadline))
				} else {
					deadlineDoc.Deadline = &t
				}
			}
			// deadline == "" leaves deadlineDoc.Deadline as nil → clears it
			if dlErr := h.service.UpdateTaskDeadline(taskObjID, categoryObjID, userObjID, deadlineDoc); dlErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Failed to update task deadline",
					slog.String("taskID", instruction.TaskID),
					slog.String("error", dlErr.Error()))
			}
		}

		// Handle start date / start time update
		if instruction.Updates.StartDate != nil || instruction.Updates.StartTime != nil {
			startDoc := UpdateTaskStartDocument{}

			if instruction.Updates.StartDate != nil && *instruction.Updates.StartDate != "" {
				t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.StartDate)
				if parseErr != nil {
					slog.LogAttrs(ctx, slog.LevelWarn, "Invalid startDate ISO8601 from AI",
						slog.String("startDate", *instruction.Updates.StartDate))
				} else {
					startDoc.StartDate = &t
				}
			}

			if instruction.Updates.StartTime != nil && *instruction.Updates.StartTime != "" {
				t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.StartTime)
				if parseErr != nil {
					slog.LogAttrs(ctx, slog.LevelWarn, "Invalid startTime ISO8601 from AI",
						slog.String("startTime", *instruction.Updates.StartTime))
				} else {
					startDoc.StartTime = &t
				}
			}

			if startErr := h.service.UpdateTaskStart(taskObjID, categoryObjID, userObjID, startDoc); startErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Failed to update task start date/time",
					slog.String("taskID", instruction.TaskID),
					slog.String("error", startErr.Error()))
			}
		}

		// Fetch updated task to include in response
		updatedTask, fetchErr := h.service.GetTaskByID(taskObjID, userObjID)
		if fetchErr != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Failed to fetch updated task",
				slog.String("taskID", instruction.TaskID),
				slog.String("error", fetchErr.Error()))
			continue
		}

		editedTasks = append(editedTasks, *updatedTask)
	}

	if editedTasks == nil {
		editedTasks = []TaskDocument{}
	}

	// Process template edit instructions
	var editedTemplates []TemplateTaskDocument
	for _, instruction := range editOutput.TemplateInstructions {
		templateObjID, err := primitive.ObjectIDFromHex(instruction.TaskID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Invalid template ID from AI", slog.String("templateID", instruction.TaskID))
			continue
		}

		updateDoc := UpdateTemplateDocument{}
		if instruction.Updates.Content != nil {
			updateDoc.Content = instruction.Updates.Content
		}
		if instruction.Updates.Priority != nil {
			updateDoc.Priority = instruction.Updates.Priority
		}
		if instruction.Updates.Value != nil {
			updateDoc.Value = instruction.Updates.Value
		}
		if instruction.Updates.Notes != nil {
			updateDoc.Notes = instruction.Updates.Notes
		}
		if instruction.Updates.RecurFrequency != nil {
			updateDoc.RecurFrequency = instruction.Updates.RecurFrequency
		}
		if instruction.Updates.RecurType != nil {
			updateDoc.RecurType = instruction.Updates.RecurType
		}
		if instruction.Updates.Deadline != nil && *instruction.Updates.Deadline != "" {
			t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.Deadline)
			if parseErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Invalid deadline ISO8601 from AI (template)",
					slog.String("deadline", *instruction.Updates.Deadline))
			} else {
				updateDoc.Deadline = &t
			}
		}
		if instruction.Updates.StartDate != nil && *instruction.Updates.StartDate != "" {
			t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.StartDate)
			if parseErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Invalid startDate ISO8601 from AI (template)",
					slog.String("startDate", *instruction.Updates.StartDate))
			} else {
				updateDoc.StartDate = &t
			}
		}
		if instruction.Updates.StartTime != nil && *instruction.Updates.StartTime != "" {
			t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.StartTime)
			if parseErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Invalid startTime ISO8601 from AI (template)",
					slog.String("startTime", *instruction.Updates.StartTime))
			} else {
				updateDoc.StartTime = &t
			}
		}

		if err := h.service.UpdateTemplateTask(templateObjID, updateDoc); err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to update template task",
				slog.String("templateID", instruction.TaskID),
				slog.String("error", err.Error()))
			continue
		}

		updated, fetchErr := h.service.GetTemplateByID(templateObjID)
		if fetchErr != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Failed to fetch updated template",
				slog.String("templateID", instruction.TaskID),
				slog.String("error", fetchErr.Error()))
			continue
		}
		editedTemplates = append(editedTemplates, *updated)
	}

	if editedTemplates == nil {
		editedTemplates = []TemplateTaskDocument{}
	}

	totalEdited := len(editedTasks) + len(editedTemplates)
	output := &EditTasksNaturalLanguageOutput{}
	output.Body.Tasks = editedTasks
	output.Body.Templates = editedTemplates
	output.Body.EditedCount = totalEdited

	switch totalEdited {
	case 0:
		output.Body.Message = "No matching tasks found"
	case 1:
		output.Body.Message = "Successfully edited 1 task"
	default:
		output.Body.Message = fmt.Sprintf("Successfully edited %d tasks", totalEdited)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Natural language task edit completed",
		slog.String("userID", userID),
		slog.Int("editedTasks", len(editedTasks)),
		slog.Int("editedTemplates", len(editedTemplates)))

	return output, nil
}

// applyEditInstructions applies a set of edit instructions to tasks and templates,
// returning the edited tasks, edited templates, and total count.
// It is shared between EditTasksNaturalLanguage and IntentTaskNaturalLanguage.
func (h *Handler) applyEditInstructions(ctx context.Context, userObjID primitive.ObjectID, userID string, editOutput *EditTasksFlowOutputLocal) ([]TaskDocument, []TemplateTaskDocument, int) {
	var editedTasks []TaskDocument
	for _, instruction := range editOutput.Instructions {
		taskObjID, err := primitive.ObjectIDFromHex(instruction.TaskID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Invalid task ID from AI", slog.String("taskID", instruction.TaskID))
			continue
		}

		categoryObjID, err := primitive.ObjectIDFromHex(instruction.CategoryID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Invalid category ID from AI", slog.String("categoryID", instruction.CategoryID))
			continue
		}

		currentTask, err := h.service.GetTaskByID(taskObjID, userObjID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Task not found for edit", slog.String("taskID", instruction.TaskID))
			continue
		}

		merged := mergeTaskWithEdits(*currentTask, instruction.Updates)
		if _, err = h.service.UpdatePartialTask(taskObjID, categoryObjID, merged); err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to update task core fields",
				slog.String("taskID", instruction.TaskID),
				slog.String("error", err.Error()))
			continue
		}

		if instruction.Updates.Notes != nil {
			if notesErr := h.service.UpdateTaskNotes(taskObjID, categoryObjID, userObjID, UpdateTaskNotesDocument{Notes: *instruction.Updates.Notes}); notesErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Failed to update task notes",
					slog.String("taskID", instruction.TaskID),
					slog.String("error", notesErr.Error()))
			}
		}

		if instruction.Updates.Deadline != nil {
			deadlineDoc := UpdateTaskDeadlineDocument{}
			if *instruction.Updates.Deadline != "" {
				t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.Deadline)
				if parseErr == nil {
					deadlineDoc.Deadline = &t
				}
			}
			if dlErr := h.service.UpdateTaskDeadline(taskObjID, categoryObjID, userObjID, deadlineDoc); dlErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Failed to update task deadline",
					slog.String("taskID", instruction.TaskID),
					slog.String("error", dlErr.Error()))
			}
		}

		if instruction.Updates.StartDate != nil || instruction.Updates.StartTime != nil {
			startDoc := UpdateTaskStartDocument{}
			if instruction.Updates.StartDate != nil && *instruction.Updates.StartDate != "" {
				t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.StartDate)
				if parseErr == nil {
					startDoc.StartDate = &t
				}
			}
			if instruction.Updates.StartTime != nil && *instruction.Updates.StartTime != "" {
				t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.StartTime)
				if parseErr == nil {
					startDoc.StartTime = &t
				}
			}
			if startErr := h.service.UpdateTaskStart(taskObjID, categoryObjID, userObjID, startDoc); startErr != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Failed to update task start date/time",
					slog.String("taskID", instruction.TaskID),
					slog.String("error", startErr.Error()))
			}
		}

		updatedTask, fetchErr := h.service.GetTaskByID(taskObjID, userObjID)
		if fetchErr != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Failed to fetch updated task",
				slog.String("taskID", instruction.TaskID),
				slog.String("error", fetchErr.Error()))
			continue
		}
		editedTasks = append(editedTasks, *updatedTask)
	}

	if editedTasks == nil {
		editedTasks = []TaskDocument{}
	}

	var editedTemplates []TemplateTaskDocument
	for _, instruction := range editOutput.TemplateInstructions {
		templateObjID, err := primitive.ObjectIDFromHex(instruction.TaskID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Invalid template ID from AI", slog.String("templateID", instruction.TaskID))
			continue
		}

		updateDoc := UpdateTemplateDocument{}
		if instruction.Updates.Content != nil {
			updateDoc.Content = instruction.Updates.Content
		}
		if instruction.Updates.Priority != nil {
			updateDoc.Priority = instruction.Updates.Priority
		}
		if instruction.Updates.Value != nil {
			updateDoc.Value = instruction.Updates.Value
		}
		if instruction.Updates.Notes != nil {
			updateDoc.Notes = instruction.Updates.Notes
		}
		if instruction.Updates.RecurFrequency != nil {
			updateDoc.RecurFrequency = instruction.Updates.RecurFrequency
		}
		if instruction.Updates.RecurType != nil {
			updateDoc.RecurType = instruction.Updates.RecurType
		}
		if instruction.Updates.Deadline != nil && *instruction.Updates.Deadline != "" {
			t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.Deadline)
			if parseErr == nil {
				updateDoc.Deadline = &t
			}
		}
		if instruction.Updates.StartDate != nil && *instruction.Updates.StartDate != "" {
			t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.StartDate)
			if parseErr == nil {
				updateDoc.StartDate = &t
			}
		}
		if instruction.Updates.StartTime != nil && *instruction.Updates.StartTime != "" {
			t, parseErr := time.Parse(time.RFC3339, *instruction.Updates.StartTime)
			if parseErr == nil {
				updateDoc.StartTime = &t
			}
		}

		if err := h.service.UpdateTemplateTask(templateObjID, updateDoc); err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to update template task",
				slog.String("templateID", instruction.TaskID),
				slog.String("error", err.Error()))
			continue
		}

		updated, fetchErr := h.service.GetTemplateByID(templateObjID)
		if fetchErr != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Failed to fetch updated template",
				slog.String("templateID", instruction.TaskID),
				slog.String("error", fetchErr.Error()))
			continue
		}
		editedTemplates = append(editedTemplates, *updated)
	}

	if editedTemplates == nil {
		editedTemplates = []TemplateTaskDocument{}
	}

	return editedTasks, editedTemplates, len(editedTasks) + len(editedTemplates)
}

// IntentTaskNaturalLanguage handles POST /v1/user/tasks/natural-language/intent
// It decomposes the user's utterance into an ordered list of create/edit/delete operations.
// Edit operations are applied immediately server-side; create and delete payloads are
// returned for the frontend to handle interactively.
func (h *Handler) IntentTaskNaturalLanguage(ctx context.Context, input *IntentTaskNaturalLanguageInput) (*IntentTaskNaturalLanguageOutput, error) {
	if input.Body.Text == "" {
		return nil, huma.Error400BadRequest("Text field is required", nil)
	}

	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

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

	timezone := input.Body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Starting natural language intent routing",
		slog.String("userID", userID),
		slog.String("inputText", input.Body.Text),
		slog.String("timezone", timezone))

	intentOutput, err := h.callGeminiIntentFlow(ctx, userID, input.Body.Text, timezone)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini intent flow failed, retrying",
			slog.String("userID", userID),
			slog.String("error", err.Error()))

		intentOutput, err = h.callGeminiIntentFlow(ctx, userID, input.Body.Text, timezone)
		if err != nil {
			refundErr := types.AddCredits(ctx, h.service.Users, userObjID, types.CreditTypeNaturalLanguage, 1)
			if refundErr != nil {
				slog.LogAttrs(ctx, slog.LevelError, "Failed to refund credit after AI failure",
					slog.String("userID", userID),
					slog.String("refundError", refundErr.Error()))
			} else {
				slog.LogAttrs(ctx, slog.LevelInfo, "Credit successfully refunded",
					slog.String("userID", userID))
			}
			return nil, huma.Error500InternalServerError("Failed to process natural language intent with AI after retry. Your credit has been refunded.", err)
		}
	}

	var responseOps []IntentOpResponse

	for _, op := range intentOutput.Ops {
		switch op.Type {
		case "edit":
			if op.EditPayload == nil {
				continue
			}
			editedTasks, editedTemplates, totalEdited := h.applyEditInstructions(ctx, userObjID, userID, op.EditPayload)
			responseOps = append(responseOps, IntentOpResponse{
				Type: "edit",
				EditResult: &EditResultResponse{
					Tasks:       editedTasks,
					Templates:   editedTemplates,
					EditedCount: totalEdited,
				},
			})

		case "delete":
			if op.DeletePayload == nil {
				continue
			}
			filters, err := convertQueryOutput(op.DeletePayload)
			if err != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Failed to convert delete query output",
					slog.String("error", err.Error()))
				continue
			}
			tasks, err := h.service.QueryTasksByUser(userObjID, filters)
			if err != nil {
				slog.LogAttrs(ctx, slog.LevelWarn, "Failed to query tasks for delete op",
					slog.String("error", err.Error()))
				continue
			}
			responseOps = append(responseOps, IntentOpResponse{
				Type:        "delete",
				DeleteTasks: tasks,
			})

		case "create":
			if op.CreatePayload == nil {
				continue
			}
			responseOps = append(responseOps, IntentOpResponse{
				Type:          "create",
				CreatePreview: op.CreatePayload,
			})
		}
	}

	if responseOps == nil {
		responseOps = []IntentOpResponse{}
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Natural language intent routing completed",
		slog.String("userID", userID),
		slog.Int("opCount", len(responseOps)))

	output := &IntentTaskNaturalLanguageOutput{}
	output.Body.Ops = responseOps
	return output, nil
}

// PreviewTaskNaturalLanguage processes natural language text with AI and returns a preview payload
// without creating any tasks or consuming credits.
func (h *Handler) PreviewTaskNaturalLanguage(ctx context.Context, input *PreviewTaskNaturalLanguageInput) (*PreviewTaskNaturalLanguageOutput, error) {
	// Validate input
	if input.Body.Text == "" {
		return nil, huma.Error400BadRequest("Text field is required", nil)
	}

	// Extract and validate user ID
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Check credits without consuming
	hasCredit, err := types.CheckCredits(ctx, h.service.Users, userObjID, types.CreditTypeNaturalLanguage)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to check credits", err)
	}
	if !hasCredit {
		return nil, huma.Error403Forbidden("Insufficient credits. You need at least 1 natural language credit to use this feature.", types.ErrInsufficientCredits)
	}

	// Default to EST if no timezone provided
	timezone := input.Body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Starting natural language preview",
		slog.String("userID", userID),
		slog.String("inputText", input.Body.Text),
		slog.String("timezone", timezone))

	// Call Genkit flow to process natural language with retry logic (no credit consumption)
	result, err := h.callGeminiFlow(ctx, userID, input.Body.Text, timezone)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "First attempt to call Gemini flow failed, retrying once",
			slog.String("userID", userID),
			slog.String("error", err.Error()))

		// Retry once
		result, err = h.callGeminiFlow(ctx, userID, input.Body.Text, timezone)
		if err != nil {
			return nil, huma.Error500InternalServerError("Failed to process natural language with AI after retry.", err)
		}
	}

	output := &PreviewTaskNaturalLanguageOutput{}
	output.Body.Categories = result.Categories
	output.Body.Tasks = result.Tasks
	return output, nil
}

// ConfirmTaskNaturalLanguage creates tasks from a preview payload, consuming credits.
func (h *Handler) ConfirmTaskNaturalLanguage(ctx context.Context, input *ConfirmTaskNaturalLanguageInput) (*CreateTaskNaturalLanguageOutput, error) {
	// Validate input
	if len(input.Body.Categories) == 0 && len(input.Body.Tasks) == 0 {
		return nil, huma.Error400BadRequest("Preview payload is required", nil)
	}

	// Extract and validate user ID
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Consume credit atomically
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

	// Process new categories with their tasks
	newCategoryTasks, newCategoryMetadata, categoriesCreated, newCategoryTaskCount, err := h.processNewCategories(ctx, input.Body.Categories, userObjID)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to process new categories",
			slog.String("userID", userID),
			slog.String("error", err.Error()))
		return nil, huma.Error500InternalServerError(err.Error(), err)
	}

	// Process tasks for existing categories
	existingCategoryTasks, existingCategoryTaskCount, err := h.processExistingCategoryTasks(ctx, input.Body.Tasks, userObjID)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to process existing category tasks",
			slog.String("userID", userID),
			slog.String("error", err.Error()))
		return nil, huma.Error500InternalServerError(err.Error(), err)
	}

	// Combine all created tasks
	allTasks := append(newCategoryTasks, existingCategoryTasks...)
	totalTasks := newCategoryTaskCount + existingCategoryTaskCount

	// Build response
	output := &CreateTaskNaturalLanguageOutput{}
	output.Body.CategoriesCreated = categoriesCreated
	output.Body.NewCategories = newCategoryMetadata
	output.Body.TasksCreated = totalTasks
	output.Body.Tasks = allTasks

	if totalTasks == 0 {
		output.Body.Message = "No valid tasks could be created from the provided preview"
	} else if categoriesCreated > 0 {
		output.Body.Message = fmt.Sprintf("Successfully created %d tasks in %d new categories", totalTasks, categoriesCreated)
	} else {
		output.Body.Message = fmt.Sprintf("Successfully created %d tasks in existing categories", totalTasks)
	}

	return output, nil
}
