package task

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"reflect"
	"sync"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// callGeminiFlow uses reflection to call the Genkit flow without circular import
func (h *Handler) callGeminiFlow(ctx context.Context, userID, text, timezone string) (*MultiTaskOutputLocal, error) {
	if h.geminiService == nil {
		return nil, fmt.Errorf("gemini service not available")
	}

	// Use reflection to access the flow
	svcValue := reflect.ValueOf(h.geminiService)
	flowField := svcValue.Elem().FieldByName("MultiTaskFromTextFlowWithContext")
	if !flowField.IsValid() {
		return nil, fmt.Errorf("gemini flow not configured")
	}

	// Get the Run method
	runMethod := flowField.MethodByName("Run")
	if !runMethod.IsValid() {
		return nil, fmt.Errorf("gemini flow Run method not available")
	}

	// Create input value with the correct type
	inputType := runMethod.Type().In(1)
	inputValue := reflect.New(inputType).Elem()
	inputValue.FieldByName("UserID").SetString(userID)
	inputValue.FieldByName("Text").SetString(text)
	inputValue.FieldByName("Timezone").SetString(timezone)

	// Call the Run method
	callResults := runMethod.Call([]reflect.Value{
		reflect.ValueOf(ctx),
		inputValue,
	})

	if len(callResults) != 2 {
		return nil, fmt.Errorf("unexpected gemini flow response structure")
	}

	// Check for error
	if !callResults[1].IsNil() {
		if err, ok := callResults[1].Interface().(error); ok {
			return nil, err
		}
		return nil, fmt.Errorf("unexpected error type from gemini flow")
	}

	// Convert result to local type
	var result MultiTaskOutputLocal
	resultBytes, err := json.Marshal(callResults[0].Interface())
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w", err)
	}

	if err := json.Unmarshal(resultBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse AI response structure: %w", err)
	}

	return &result, nil
}

// validateAndSetTaskDefaults validates and sets default values for task fields
func validateAndSetTaskDefaults(taskParams *CreateTaskParams) {
	// Validate and set priority (1-3)
	if taskParams.Priority < 1 || taskParams.Priority > 3 {
		taskParams.Priority = 2
	}

	// Validate and set value (0-10)
	if taskParams.Value < 0 || taskParams.Value > 10 {
		taskParams.Value = 5
	}
}

// buildTaskDocument creates a TaskDocument from CreateTaskParams
func buildTaskDocument(taskParams CreateTaskParams, userID, categoryID primitive.ObjectID) TaskDocument {
	now := time.Now().UTC()
	return TaskDocument{
		ID:             primitive.NewObjectID(),
		Priority:       taskParams.Priority,
		Content:        taskParams.Content,
		Value:          taskParams.Value,
		Recurring:      taskParams.Recurring,
		RecurFrequency: taskParams.RecurFrequency,
		RecurDetails:   taskParams.RecurDetails,
		Public:         taskParams.Public,
		Active:         true,
		UserID:         userID,
		CategoryID:     categoryID,
		Deadline:       taskParams.Deadline,
		StartTime:      taskParams.StartTime,
		StartDate:      taskParams.StartDate,
		Notes:          taskParams.Notes,
		Checklist:      taskParams.Checklist,
		Reminders:      taskParams.Reminders,
		Timestamp:      now,
		LastEdited:     now,
	}
}

// processNewCategories creates categories with their tasks from AI response
func (h *Handler) processNewCategories(ctx context.Context, categories []NewCategoryWithTasksLocal, userID primitive.ObjectID) ([]TaskDocument, []CategoryMetadata, int, int, error) {
	slog.LogAttrs(ctx, slog.LevelInfo, "Processing new categories from AI",
		slog.Int("categoryCount", len(categories)),
		slog.String("userID", userID.Hex()))

	// Use channels to collect results from concurrent processing
	type categoryResult struct {
		tasks    []TaskDocument
		metadata CategoryMetadata
		count    int
		err      error
	}

	results := make(chan categoryResult, len(categories))
	var wg sync.WaitGroup

	// Process each category concurrently
	for _, categoryInput := range categories {
		if categoryInput.Name == "" {
			slog.LogAttrs(ctx, slog.LevelWarn, "Skipping category with empty name")
			continue
		}

		wg.Add(1)
		go func(catInput NewCategoryWithTasksLocal) {
			defer wg.Done()

			workspaceName := catInput.WorkspaceName
			if workspaceName == "" {
				workspaceName = "General"
			}

			newCategory := types.CategoryDocument{
				ID:            primitive.NewObjectID(),
				Name:          catInput.Name,
				WorkspaceName: workspaceName,
				User:          userID,
				Tasks:         make([]TaskDocument, 0),
				LastEdited:    time.Now().UTC(),
			}

			slog.LogAttrs(ctx, slog.LevelInfo, "Creating new category",
				slog.String("categoryID", newCategory.ID.Hex()),
				slog.String("categoryName", newCategory.Name),
				slog.String("workspace", workspaceName),
				slog.Int("tasksInCategory", len(catInput.Tasks)))

			var categoryTasks []TaskDocument

			// Process tasks for this category
			for _, taskParams := range catInput.Tasks {
				if taskParams.Content == "" {
					continue
				}

				validateAndSetTaskDefaults(&taskParams)
				task := buildTaskDocument(taskParams, userID, newCategory.ID)

				slog.LogAttrs(ctx, slog.LevelInfo, "Adding task to new category",
					slog.String("taskID", task.ID.Hex()),
					slog.String("taskContent", task.Content),
					slog.String("categoryID", newCategory.ID.Hex()),
					slog.String("categoryName", newCategory.Name),
					slog.Int("priority", task.Priority),
					slog.Float64("value", task.Value))

				newCategory.Tasks = append(newCategory.Tasks, task)
				categoryTasks = append(categoryTasks, task)
			}

			// Only create category if it has tasks
			if len(newCategory.Tasks) > 0 {
				_, err := h.service.Tasks.InsertOne(ctx, newCategory)
				if err != nil {
					slog.LogAttrs(ctx, slog.LevelError, "Failed to create category",
						slog.String("categoryName", newCategory.Name),
						slog.String("error", err.Error()))
					results <- categoryResult{err: fmt.Errorf("failed to create category %s: %w", catInput.Name, err)}
					return
				}

				slog.LogAttrs(ctx, slog.LevelInfo, "Successfully created category",
					slog.String("categoryID", newCategory.ID.Hex()),
					slog.String("categoryName", newCategory.Name),
					slog.Int("tasksCreated", len(newCategory.Tasks)))

				results <- categoryResult{
					tasks: categoryTasks,
					metadata: CategoryMetadata{
						ID:            newCategory.ID.Hex(),
						Name:          newCategory.Name,
						WorkspaceName: workspaceName,
					},
					count: len(categoryTasks),
					err:   nil,
				}
			}
		}(categoryInput)
	}

	// Close results channel when all goroutines complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	var allTasks []TaskDocument
	var categoryMetadataList []CategoryMetadata
	categoriesCreated := 0
	tasksCreated := 0

	for result := range results {
		if result.err != nil {
			return nil, nil, 0, 0, result.err
		}
		allTasks = append(allTasks, result.tasks...)
		categoryMetadataList = append(categoryMetadataList, result.metadata)
		tasksCreated += result.count
		categoriesCreated++
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Completed processing new categories",
		slog.Int("categoriesCreated", categoriesCreated),
		slog.Int("tasksCreated", tasksCreated))

	return allTasks, categoryMetadataList, categoriesCreated, tasksCreated, nil
}

// processExistingCategoryTasks creates tasks in existing categories from AI response (with concurrency)
func (h *Handler) processExistingCategoryTasks(ctx context.Context, taskPairs []CategoryTaskPairLocal, userID primitive.ObjectID) ([]TaskDocument, int, error) {
	slog.LogAttrs(ctx, slog.LevelInfo, "Processing tasks for existing categories",
		slog.Int("taskPairCount", len(taskPairs)),
		slog.String("userID", userID.Hex()))

	// Use channels to collect results from concurrent processing
	type taskResult struct {
		task TaskDocument
		err  error
	}

	results := make(chan taskResult, len(taskPairs))
	var wg sync.WaitGroup

	// Process each task concurrently
	for _, taskPair := range taskPairs {
		if taskPair.CategoryID == "" || taskPair.Task.Content == "" {
			slog.LogAttrs(ctx, slog.LevelWarn, "Skipping task with missing data",
				slog.String("categoryID", taskPair.CategoryID),
				slog.String("taskContent", taskPair.Task.Content))
			continue
		}

		// Convert string CategoryID to ObjectID
		categoryObjID, err := primitive.ObjectIDFromHex(taskPair.CategoryID)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Skipping task with invalid category ID",
				slog.String("categoryID", taskPair.CategoryID),
				slog.String("error", err.Error()))
			continue
		}

		wg.Add(1)
		go func(pair CategoryTaskPairLocal, catID primitive.ObjectID) {
			defer wg.Done()

			validateAndSetTaskDefaults(&pair.Task)
			taskDoc := buildTaskDocument(pair.Task, userID, catID)

			categoryName := pair.CategoryName
			if categoryName == "" {
				categoryName = catID.Hex()
			}

			slog.LogAttrs(ctx, slog.LevelInfo, "Adding task to existing category",
				slog.String("taskID", taskDoc.ID.Hex()),
				slog.String("taskContent", taskDoc.Content),
				slog.String("categoryID", catID.Hex()),
				slog.String("categoryName", categoryName),
				slog.Int("priority", taskDoc.Priority),
				slog.Float64("value", taskDoc.Value))

			createdTask, err := h.service.CreateTask(catID, &taskDoc)
			if err != nil {
				slog.LogAttrs(ctx, slog.LevelError, "Failed to create task in existing category",
					slog.String("categoryID", catID.Hex()),
					slog.String("categoryName", categoryName),
					slog.String("taskContent", taskDoc.Content),
					slog.String("error", err.Error()))
				results <- taskResult{err: fmt.Errorf("failed to create task in existing category %s: %w", categoryName, err)}
				return
			}

			results <- taskResult{task: *createdTask, err: nil}
		}(taskPair, categoryObjID)
	}

	// Close results channel when all goroutines complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	var createdTasks []TaskDocument
	for result := range results {
		if result.err != nil {
			return nil, 0, result.err
		}
		createdTasks = append(createdTasks, result.task)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Completed processing tasks for existing categories",
		slog.Int("tasksCreated", len(createdTasks)))

	return createdTasks, len(createdTasks), nil
}
