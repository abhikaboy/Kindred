package task

//nolint:unkeyed
//nolint:composites

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/encouragement"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func getTasksByUserPipeline(userId primitive.ObjectID) []bson.D {
	var pipeline []bson.D = []bson.D{
		{
			{Key: "$match", Value: bson.M{"user": userId}},
		},
		{
			{Key: "$unwind", Value: "$tasks"},
		},
		{
			{Key: "$replaceRoot", Value: bson.M{
				"newRoot": "$tasks",
			}},
		},
	}
	return pipeline
}

func getBaseTaskPipeline() []bson.D {
	return []bson.D{
		{{Key: "$unwind", Value: "$tasks"}},
		{{Key: "$set", Value: bson.M{"tasks.userID": "$user", "tasks.categoryID": "$_id"}}},
		{{Key: "$replaceRoot", Value: bson.M{"newRoot": "$tasks"}}},
	}
}

func getTaskArrayFilterOptions(taskId primitive.ObjectID) *options.UpdateOptions {
	return &options.UpdateOptions{
		ArrayFilters: &options.ArrayFilters{
			Filters: bson.A{
				bson.M{"t._id": taskId},
			},
		},
	}
}

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Tasks:               collections["categories"],
		Users:               collections["users"],
		CompletedTasks:      collections["completed-tasks"],
		TemplateTasks:       collections["template-tasks"],
		EncouragementHelper: encouragement.NewEncouragementService(collections),
	}
}

// NewService is the exported version of newService for external packages
func NewService(collections map[string]*mongo.Collection) *Service {
	return newService(collections)
}

// GetAllTasks fetches all Task documents from MongoDB
func (s *Service) GetAllTasks() ([]TaskDocument, error) {
	ctx := context.Background()
	cursor, err := s.Tasks.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *Service) GetTasksByUser(id primitive.ObjectID, sort bson.D) ([]TaskDocument, error) {
	ctx := context.Background()

	fmt.Println(sort)

	pipeline := getTasksByUserPipeline(id)
	pipeline = append(pipeline, sort)
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}
func (s *Service) GetPublicTasks(id primitive.ObjectID, sort bson.D) ([]TaskDocument, error) {
	ctx := context.Background()

	fmt.Println(sort)

	pipeline := getTasksByUserPipeline(id)
	pipeline = append(pipeline, bson.D{
		{Key: "$match", Value: bson.M{"public": true}},
	})
	pipeline = append(pipeline, sort)
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetTaskByID returns a single Task document by its ObjectID
func (s *Service) GetTaskByID(id primitive.ObjectID, user primitive.ObjectID) (*TaskDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Task = make([]TaskDocument, 0)
	var pipeline = getTasksByUserPipeline(user)
	pipeline = append(pipeline, bson.D{
		{Key: "$match", Value: filter},
	})
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	if err = cursor.All(ctx, &Task); err != nil {
		return nil, err
	}
	if len(Task) == 0 {
		return nil, mongo.ErrNoDocuments
	}

	return &Task[0], nil
}

// InsertTask adds a new Task document
func (s *Service) CreateTask(categoryId primitive.ObjectID, r *TaskDocument) (*TaskDocument, error) {
	ctx := context.Background()
	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{
			"_id": categoryId,
		},
		bson.M{"$push": bson.M{"tasks": r}},
	)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	slog.LogAttrs(ctx, slog.LevelInfo, "Task inserted")

	return r, nil
}

func (s *Service) CreateTemplateTask(categoryId primitive.ObjectID, r *TemplateTaskDocument) (*TemplateTaskDocument, error) {
	ctx := context.Background()

	_, err := s.TemplateTasks.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	return r, nil
}

// UpdatePartialTask updates only specified fields of a Task document by ObjectID.
func (s *Service) UpdatePartialTask(
	id primitive.ObjectID,
	categoryId primitive.ObjectID,
	updated UpdateTaskDocument) (*TaskDocument, error) {

	ctx := context.Background()

	options := options.UpdateOptions{
		ArrayFilters: &options.ArrayFilters{
			Filters: bson.A{
				bson.M{
					"t._id": id,
				},
			},
		},
	}

	// Build the update fields dynamically
	updateFields := bson.D{
		{Key: "tasks.$[t].priority", Value: updated.Priority},
		{Key: "tasks.$[t].lastEdited", Value: xutils.NowUTC()},
		{Key: "tasks.$[t].content", Value: updated.Content},
		{Key: "tasks.$[t].value", Value: updated.Value},
		{Key: "tasks.$[t].recurring", Value: updated.Recurring},
		{Key: "tasks.$[t].recurDetails", Value: updated.RecurDetails},
		{Key: "tasks.$[t].public", Value: updated.Public},
	}

	if updated.RecurFrequency != "" {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].recurFrequency", Value: updated.RecurFrequency})
	}
	if updated.RecurType != "" {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].recurType", Value: updated.RecurType})
	}

	if updated.Active != nil {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].active", Value: updated.Active})
	}

	// Add the new fields conditionally
	if updated.TemplateID != nil {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].templateID", Value: updated.TemplateID})
	}
	if updated.Deadline != nil {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].deadline", Value: updated.Deadline})
	}
	if updated.StartTime != nil {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].startTime", Value: updated.StartTime})
	}
	if updated.StartDate != nil {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].startDate", Value: updated.StartDate})
	}
	if updated.Reminders != nil {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].reminders", Value: updated.Reminders})
	}
	if updated.Notes != "" {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].notes", Value: updated.Notes})
	}
	if updated.Checklist != nil {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].checklist", Value: updated.Checklist})
	}
	if updated.Integration != "" {
		updateFields = append(updateFields, bson.E{Key: "tasks.$[t].integration", Value: updated.Integration})
	}

	_, err := s.Tasks.UpdateOne(ctx,
		bson.M{
			"_id": categoryId,
		},
		bson.D{{
			Key: "$set", Value: updateFields,
		}},
		&options,
	)

	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to update Category", slog.String("error", err.Error()))
		return nil, err
	}

	return nil, err
}

// TaskCompletionResult contains information about the task completion
type TaskCompletionResult struct {
	StreakChanged bool
	CurrentStreak int
	TasksComplete float64
}

func (s *Service) CompleteTask(
	userId primitive.ObjectID,
	id primitive.ObjectID,
	categoryId primitive.ObjectID,
	completed CompleteTaskDocument) (*TaskCompletionResult, error) {

	ctx := context.Background()

	// Get the task details before completing (for encourager notifications)
	var taskToComplete TaskDocument
	taskPipeline := getTasksByUserPipeline(userId)
	taskPipeline = append(taskPipeline, bson.D{
		{Key: "$match", Value: bson.M{"_id": id}},
	})
	taskCursor, err := s.Tasks.Aggregate(ctx, taskPipeline)
	if err != nil {
		return nil, err
	}
	defer taskCursor.Close(ctx)

	var tasks []TaskDocument
	if err := taskCursor.All(ctx, &tasks); err != nil {
		return nil, err
	}

	if len(tasks) > 0 {
		taskToComplete = tasks[0]
	}

	// Get user's current streak and tasks_complete before completion
	var userBefore types.User
	err = s.Users.FindOne(ctx, bson.M{"_id": userId}).Decode(&userBefore)
	if err != nil {
		return nil, err
	}

	// Move task to completed-tasks collection
	pipeline := getTasksByUserPipeline(userId)
	pipeline = append(pipeline,
		bson.D{
			{Key: "$match", Value: bson.M{"_id": id}},
		},
		bson.D{
			{Key: "$set", Value: bson.M{
				"active":        false,
				"timeTaken":     completed.TimeTaken,
				"timeCompleted": xutils.NowUTC(),
				"category":      categoryId,
				"user":          userId,
			}},
		},
		bson.D{
			{Key: "$unset", Value: bson.A{
				"recurDetails",
			},
			},
		},
		bson.D{
			{Key: "$merge", Value: bson.M{
				"into":           "completed-tasks",
				"on":             "_id",
				"whenMatched":    "keepExisting",
				"whenNotMatched": "insert",
			}},
		},
	)
	_, err = s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}

	// Update recurring template stats if this was a recurring task
	if taskToComplete.TemplateID != nil {
		_, err = s.TemplateTasks.UpdateOne(ctx,
			bson.M{"_id": *taskToComplete.TemplateID},
			mongo.Pipeline{
				{{Key: "$set", Value: bson.M{
					"streak":         bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$streak", 0}}, 1}},
					"timesCompleted": bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$timesCompleted", 0}}, 1}},
				}}},
				{{Key: "$set", Value: bson.M{
					"highestStreak": bson.M{"$max": bson.A{"$streak", bson.M{"$ifNull": bson.A{"$highestStreak", 0}}}},
				}}},
				{{Key: "$push", Value: bson.M{
					"completionDates": xutils.NowUTC(),
				}}},
			},
		)
		if err != nil {
			slog.Error("Failed to update template stats", "error", err, "templateID", *taskToComplete.TemplateID)
			// Don't fail the completion
		}
	}

	// Update user's tasks_complete count
	_, err = s.Users.UpdateOne(ctx,
		bson.M{"_id": userId},
		bson.M{"$inc": bson.M{"tasks_complete": 1}},
	)
	if err != nil {
		return nil, err
	}

	// Get user's current streak and tasks_complete after completion
	var userAfter types.User
	err = s.Users.FindOne(ctx, bson.M{"_id": userId}).Decode(&userAfter)
	if err != nil {
		return nil, err
	}

	// Check if user was streak eligible (first task of the day)
	// This indicates the streak would increase, even though we don't update it here
	streakChanged := userBefore.StreakEligible

	if streakChanged {
		userAfter.Streak = userAfter.Streak + 1
	}

	// Notify encouragers of task completion (non-blocking - errors are logged)
	if s.EncouragementHelper != nil && taskToComplete.ID != primitive.NilObjectID {
		go func() {
			err := s.EncouragementHelper.NotifyEncouragersOfCompletion(
				taskToComplete.ID,
				userId,
				taskToComplete.Content,
			)
			if err != nil {
				slog.Error("Failed to notify encouragers of task completion",
					"task_id", taskToComplete.ID,
					"user_id", userId,
					"error", err)
			}
		}()
	}

	return &TaskCompletionResult{
		StreakChanged: streakChanged,
		CurrentStreak: userAfter.Streak,
		TasksComplete: userAfter.TasksComplete,
	}, nil
}

func (s *Service) BulkCompleteTask(userId primitive.ObjectID, tasks []BulkCompleteTaskItem) (*BulkCompleteTaskOutput, error) {
	ctx := context.Background()

	output := &BulkCompleteTaskOutput{}
	output.Body.FailedTaskIDs = []string{}

	// Get user's initial state
	var userBefore types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": userId}).Decode(&userBefore)
	if err != nil {
		return nil, err
	}

	// Parse and validate all task IDs and category IDs upfront
	type taskMapping struct {
		taskID        primitive.ObjectID
		categoryID    primitive.ObjectID
		completeData  CompleteTaskDocument
		originalIndex int
	}

	validTasks := make([]taskMapping, 0, len(tasks))
	taskIDMap := make(map[primitive.ObjectID]taskMapping) // For quick lookup
	taskIDs := make([]primitive.ObjectID, 0, len(tasks))

	for i, taskItem := range tasks {
		taskID, err := primitive.ObjectIDFromHex(taskItem.TaskID)
		if err != nil {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, taskItem.TaskID)
			slog.Warn("Invalid task ID in bulk complete", "taskID", taskItem.TaskID, "error", err)
			continue
		}

		categoryID, err := primitive.ObjectIDFromHex(taskItem.CategoryID)
		if err != nil {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, taskItem.TaskID)
			slog.Warn("Invalid category ID in bulk complete", "categoryID", taskItem.CategoryID, "error", err)
			continue
		}

		mapping := taskMapping{
			taskID:        taskID,
			categoryID:    categoryID,
			completeData:  taskItem.CompleteData,
			originalIndex: i,
		}
		validTasks = append(validTasks, mapping)
		taskIDMap[taskID] = mapping
		taskIDs = append(taskIDs, taskID)
	}

	if len(validTasks) == 0 {
		output.Body.TotalCompleted = 0
		output.Body.TotalFailed = len(tasks)
		output.Body.Message = fmt.Sprintf("Failed to complete all %d tasks", len(tasks))
		return output, nil
	}

	// Fetch all tasks in one query using aggregation with $in
	taskPipeline := getTasksByUserPipeline(userId)
	taskPipeline = append(taskPipeline, bson.D{
		{Key: "$match", Value: bson.M{"_id": bson.M{"$in": taskIDs}}},
	})
	taskCursor, err := s.Tasks.Aggregate(ctx, taskPipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tasks: %w", err)
	}
	defer taskCursor.Close(ctx)

	var fetchedTasks []TaskDocument
	if err := taskCursor.All(ctx, &fetchedTasks); err != nil {
		return nil, fmt.Errorf("failed to decode tasks: %w", err)
	}

	// Create a map of fetched tasks by ID
	fetchedTaskMap := make(map[primitive.ObjectID]TaskDocument)
	for _, task := range fetchedTasks {
		fetchedTaskMap[task.ID] = task
	}

	// Track which tasks were successfully found
	successfulTaskIDs := make([]primitive.ObjectID, 0)
	templateIDsToUpdate := make(map[primitive.ObjectID]bool) // Track unique template IDs

	// Group tasks by category for efficient deletion
	tasksByCategory := make(map[primitive.ObjectID][]primitive.ObjectID)
	completionDataByTask := make(map[primitive.ObjectID]CompleteTaskDocument)

	for _, mapping := range validTasks {
		task, exists := fetchedTaskMap[mapping.taskID]
		if !exists {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, mapping.taskID.Hex())
			continue
		}

		// Verify the task belongs to the user
		if task.UserID != userId {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, mapping.taskID.Hex())
			continue
		}

		successfulTaskIDs = append(successfulTaskIDs, mapping.taskID)
		tasksByCategory[mapping.categoryID] = append(tasksByCategory[mapping.categoryID], mapping.taskID)
		completionDataByTask[mapping.taskID] = mapping.completeData

		// Track template IDs for bulk update
		if task.TemplateID != nil {
			templateIDsToUpdate[*task.TemplateID] = true
		}
	}

	if len(successfulTaskIDs) == 0 {
		output.Body.TotalCompleted = 0
		output.Body.TotalFailed = len(tasks)
		output.Body.Message = fmt.Sprintf("Failed to complete all %d tasks", len(tasks))
		return output, nil
	}

	// Move all tasks to completed-tasks collection using bulk aggregation
	// We'll process each task individually since $merge doesn't support bulk operations easily
	// But we can optimize by grouping operations
	nowUTC := xutils.NowUTC()
	for _, taskID := range successfulTaskIDs {
		mapping := taskIDMap[taskID]
		completeData := completionDataByTask[taskID]

		pipeline := getTasksByUserPipeline(userId)
		pipeline = append(pipeline,
			bson.D{
				{Key: "$match", Value: bson.M{"_id": taskID}},
			},
			bson.D{
				{Key: "$set", Value: bson.M{
					"active":        false,
					"timeTaken":     completeData.TimeTaken,
					"timeCompleted": nowUTC,
					"category":      mapping.categoryID,
					"user":          userId,
				}},
			},
			bson.D{
				{Key: "$unset", Value: bson.A{"recurDetails"}},
			},
			bson.D{
				{Key: "$merge", Value: bson.M{
					"into":           "completed-tasks",
					"on":             "_id",
					"whenMatched":    "keepExisting",
					"whenNotMatched": "insert",
				}},
			},
		)
		_, err = s.Tasks.Aggregate(ctx, pipeline)
		if err != nil {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, taskID.Hex())
			slog.Warn("Failed to move task to completed-tasks", "taskID", taskID.Hex(), "error", err)
			continue
		}
	}

	// Create a set of failed task IDs for efficient lookup
	failedTaskIDSet := make(map[primitive.ObjectID]bool)
	for _, failedIDStr := range output.Body.FailedTaskIDs {
		if failedID, err := primitive.ObjectIDFromHex(failedIDStr); err == nil {
			failedTaskIDSet[failedID] = true
		}
	}

	// Bulk delete tasks from categories using $pull with $in
	for categoryID, taskIDsInCategory := range tasksByCategory {
		// Filter out failed task IDs
		successfulTaskIDsInCategory := make([]primitive.ObjectID, 0)
		for _, taskID := range taskIDsInCategory {
			if !failedTaskIDSet[taskID] {
				successfulTaskIDsInCategory = append(successfulTaskIDsInCategory, taskID)
			}
		}

		if len(successfulTaskIDsInCategory) == 0 {
			continue
		}

		// Use $pullAll to remove multiple tasks at once
		_, err = s.Tasks.UpdateOne(
			ctx,
			bson.M{"_id": categoryID},
			bson.M{"$pull": bson.M{"tasks": bson.M{"_id": bson.M{"$in": successfulTaskIDsInCategory}}}},
		)
		if err != nil {
			slog.Warn("Failed to delete tasks from category", "categoryID", categoryID.Hex(), "error", err)
			// Add these task IDs to failed list
			for _, taskID := range successfulTaskIDsInCategory {
				output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, taskID.Hex())
			}
		}
	}

	// Calculate successful completions
	successfulCount := len(successfulTaskIDs) - len(output.Body.FailedTaskIDs)
	if successfulCount < 0 {
		successfulCount = 0
	}

	// Bulk update template stats
	if len(templateIDsToUpdate) > 0 {
		templateIDList := make([]primitive.ObjectID, 0, len(templateIDsToUpdate))
		for templateID := range templateIDsToUpdate {
			templateIDList = append(templateIDList, templateID)
		}

		// Update all templates in one operation
		_, err = s.TemplateTasks.UpdateMany(ctx,
			bson.M{"_id": bson.M{"$in": templateIDList}},
			mongo.Pipeline{
				{{Key: "$set", Value: bson.M{
					"streak":         bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$streak", 0}}, 1}},
					"timesCompleted": bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$timesCompleted", 0}}, 1}},
				}}},
				{{Key: "$set", Value: bson.M{
					"highestStreak": bson.M{"$max": bson.A{"$streak", bson.M{"$ifNull": bson.A{"$highestStreak", 0}}}},
				}}},
				{{Key: "$push", Value: bson.M{
					"completionDates": xutils.NowUTC(),
				}}},
			},
		)
		if err != nil {
			slog.Error("Failed to bulk update template stats", "error", err)
			// Don't fail the operation
		}
	}

	// Update user's tasks_complete count once
	if successfulCount > 0 {
		_, err = s.Users.UpdateOne(ctx,
			bson.M{"_id": userId},
			bson.M{"$inc": bson.M{"tasks_complete": float64(successfulCount)}},
		)
		if err != nil {
			slog.Error("Failed to update user tasks_complete count", "error", err)
		}
	}

	// Get final user state
	var userAfter types.User
	err = s.Users.FindOne(ctx, bson.M{"_id": userId}).Decode(&userAfter)
	if err != nil {
		// Use before state as fallback
		output.Body.CurrentStreak = userBefore.Streak
		output.Body.TasksComplete = userBefore.TasksComplete
	} else {
		output.Body.CurrentStreak = userAfter.Streak
		output.Body.TasksComplete = userAfter.TasksComplete
		// Check if streak changed
		output.Body.StreakChanged = userAfter.Streak > userBefore.Streak
	}

	// Send encourager notifications (non-blocking)
	if s.EncouragementHelper != nil {
		for _, taskID := range successfulTaskIDs {
			task, exists := fetchedTaskMap[taskID]
			if exists && task.ID != primitive.NilObjectID {
				go func(t TaskDocument) {
					err := s.EncouragementHelper.NotifyEncouragersOfCompletion(
						t.ID,
						userId,
						t.Content,
					)
					if err != nil {
						slog.Error("Failed to notify encouragers of task completion",
							"task_id", t.ID,
							"user_id", userId,
							"error", err)
					}
				}(task)
			}
		}
	}

	output.Body.TotalCompleted = successfulCount
	output.Body.TotalFailed = len(tasks) - successfulCount

	if output.Body.TotalCompleted == 0 && output.Body.TotalFailed > 0 {
		output.Body.Message = fmt.Sprintf("Failed to complete all %d tasks", output.Body.TotalFailed)
	} else if output.Body.TotalFailed == 0 {
		output.Body.Message = fmt.Sprintf("Successfully completed %d task(s)", output.Body.TotalCompleted)
	} else {
		output.Body.Message = fmt.Sprintf("Completed %d task(s), %d failed", output.Body.TotalCompleted, output.Body.TotalFailed)
	}

	return output, nil
}

func (s *Service) BulkDeleteTask(userId primitive.ObjectID, tasks []BulkDeleteTaskItem) (*BulkDeleteTaskOutput, error) {
	ctx := context.Background()

	output := &BulkDeleteTaskOutput{}
	output.Body.FailedTaskIDs = []string{}

	// Parse and validate all task IDs and category IDs upfront
	type taskMapping struct {
		taskID          primitive.ObjectID
		categoryID      primitive.ObjectID
		deleteRecurring bool
		originalIndex   int
	}

	validTasks := make([]taskMapping, 0, len(tasks))
	taskIDs := make([]primitive.ObjectID, 0, len(tasks))

	for i, taskItem := range tasks {
		taskID, err := primitive.ObjectIDFromHex(taskItem.TaskID)
		if err != nil {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, taskItem.TaskID)
			slog.Warn("Invalid task ID in bulk delete", "taskID", taskItem.TaskID, "error", err)
			continue
		}

		categoryID, err := primitive.ObjectIDFromHex(taskItem.CategoryID)
		if err != nil {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, taskItem.TaskID)
			slog.Warn("Invalid category ID in bulk delete", "categoryID", taskItem.CategoryID, "error", err)
			continue
		}

		mapping := taskMapping{
			taskID:          taskID,
			categoryID:      categoryID,
			deleteRecurring: taskItem.DeleteRecurring,
			originalIndex:   i,
		}
		validTasks = append(validTasks, mapping)
		taskIDs = append(taskIDs, taskID)
	}

	if len(validTasks) == 0 {
		output.Body.TotalDeleted = 0
		output.Body.TotalFailed = len(tasks)
		output.Body.Message = fmt.Sprintf("Failed to delete all %d tasks", len(tasks))
		return output, nil
	}

	// Fetch all tasks in one query to verify they exist and belong to the user
	taskPipeline := getTasksByUserPipeline(userId)
	taskPipeline = append(taskPipeline, bson.D{
		{Key: "$match", Value: bson.M{"_id": bson.M{"$in": taskIDs}}},
	})
	taskCursor, err := s.Tasks.Aggregate(ctx, taskPipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tasks: %w", err)
	}
	defer taskCursor.Close(ctx)

	var fetchedTasks []TaskDocument
	if err := taskCursor.All(ctx, &fetchedTasks); err != nil {
		return nil, fmt.Errorf("failed to decode tasks: %w", err)
	}

	fetchedTaskMap := make(map[primitive.ObjectID]TaskDocument)
	templateIDsToDelete := make(map[primitive.ObjectID]bool)

	for _, task := range fetchedTasks {
		fetchedTaskMap[task.ID] = task
		// Check if this task needs template deletion
		for _, mapping := range validTasks {
			if mapping.taskID == task.ID && mapping.deleteRecurring && task.TemplateID != nil {
				templateIDsToDelete[*task.TemplateID] = true
			}
		}
	}

	// Group tasks by category for efficient deletion
	tasksByCategory := make(map[primitive.ObjectID][]primitive.ObjectID)
	successfulTaskIDs := make([]primitive.ObjectID, 0)

	for _, mapping := range validTasks {
		// Verify the task exists and belongs to the user
		task, exists := fetchedTaskMap[mapping.taskID]
		if !exists {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, mapping.taskID.Hex())
			continue
		}
		if task.UserID != userId {
			output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, mapping.taskID.Hex())
			continue
		}

		tasksByCategory[mapping.categoryID] = append(tasksByCategory[mapping.categoryID], mapping.taskID)
		successfulTaskIDs = append(successfulTaskIDs, mapping.taskID)
	}

	if len(successfulTaskIDs) == 0 {
		output.Body.TotalDeleted = 0
		output.Body.TotalFailed = len(tasks)
		output.Body.Message = fmt.Sprintf("Failed to delete all %d tasks", len(tasks))
		return output, nil
	}

	// Bulk delete tasks from categories using $pull with $in
	for categoryID, taskIDsInCategory := range tasksByCategory {
		// Use $pullAll to remove multiple tasks at once
		result, err := s.Tasks.UpdateOne(
			ctx,
			bson.M{"_id": categoryID},
			bson.M{"$pull": bson.M{"tasks": bson.M{"_id": bson.M{"$in": taskIDsInCategory}}}},
		)
		if err != nil {
			slog.Warn("Failed to delete tasks from category", "categoryID", categoryID.Hex(), "error", err)
			// Add these task IDs to failed list
			for _, taskID := range taskIDsInCategory {
				output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, taskID.Hex())
			}
			continue
		}

		// Check if the update actually modified anything
		if result.ModifiedCount == 0 {
			// Tasks might not exist, add to failed list
			for _, taskID := range taskIDsInCategory {
				output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, taskID.Hex())
			}
		}
	}

	// Calculate successful deletions
	successfulCount := len(successfulTaskIDs) - len(output.Body.FailedTaskIDs)
	if successfulCount < 0 {
		successfulCount = 0
	}

	// Bulk delete templates if needed
	if len(templateIDsToDelete) > 0 {
		templateIDList := make([]primitive.ObjectID, 0, len(templateIDsToDelete))
		for templateID := range templateIDsToDelete {
			templateIDList = append(templateIDList, templateID)
		}

		// Delete all templates in one operation
		_, err := s.TemplateTasks.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": templateIDList}})
		if err != nil {
			slog.Warn("Failed to bulk delete template tasks", "error", err)
			// Don't fail the operation since tasks were already deleted
		}
	}

	output.Body.TotalDeleted = successfulCount
	output.Body.TotalFailed = len(tasks) - successfulCount

	if output.Body.TotalDeleted == 0 && output.Body.TotalFailed > 0 {
		output.Body.Message = fmt.Sprintf("Failed to delete all %d tasks", output.Body.TotalFailed)
	} else if output.Body.TotalFailed == 0 {
		output.Body.Message = fmt.Sprintf("Successfully deleted %d task(s)", output.Body.TotalDeleted)
	} else {
		output.Body.Message = fmt.Sprintf("Deleted %d task(s), %d failed", output.Body.TotalDeleted, output.Body.TotalFailed)
	}

	return output, nil
}

func (s *Service) IncrementTaskCompletedAndDelete(userId primitive.ObjectID, categoryId primitive.ObjectID, id primitive.ObjectID) error {
	ctx := context.Background()

	// TODO: find a way better way to do this
	cursor, err := s.Tasks.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: bson.M{"_id": categoryId}},
		},
		{
			{Key: "$unwind", Value: "$tasks"},
		},
		{
			{Key: "$replaceRoot", Value: bson.M{
				"newRoot": "$tasks",
			}},
		},
		{
			{Key: "$match", Value: bson.M{
				"_id": id,
			}},
		}})
	if err != nil {
		return err
	}
	if cursor.RemainingBatchLength() == 0 {
		return fiber.ErrNotFound // 404
	}

	result, err := s.Users.UpdateOne(ctx,
		bson.M{
			"_id": userId,
		},
		bson.M{
			"$inc": bson.M{"tasks_complete": 1},
			"$set": bson.M{"last_completed": xutils.NowUTC()},
		},
	)

	if err != nil {
		return err
	}

	resultDecoded := *result
	if resultDecoded.ModifiedCount == 0 {
		return errors.New("No tasks found")
	}

	err = s.DeleteTask(categoryId, id)

	return err
}

// DeleteCategory removes a Category document by ObjectID.
func (s *Service) DeleteTask(categoryId primitive.ObjectID, id primitive.ObjectID) error {
	ctx := context.Background()
	result, err := s.Tasks.UpdateOne(
		ctx, bson.M{
			"_id": categoryId,
		},
		bson.M{"$pull": bson.M{"tasks": bson.M{"_id": id}}},
	)
	if err != nil {
		return err
	}

	resultDecoded := *result
	if resultDecoded.ModifiedCount != resultDecoded.MatchedCount {
		fmt.Println("found, not didn't modify task must not exist " + id.Hex() + " " + categoryId.Hex())
	}
	return err

}

// DeleteTemplateTask removes a template task by ID from the TemplateTasks collection
func (s *Service) DeleteTemplateTask(templateID primitive.ObjectID) error {
	ctx := context.Background()
	result, err := s.TemplateTasks.DeleteOne(ctx, bson.M{"_id": templateID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("template task not found")
	}

	return nil
}

// DeleteCategory removes a Category document by ObjectID.
func (s *Service) ActivateTask(userId primitive.ObjectID, categoryId primitive.ObjectID, id primitive.ObjectID, newStatus bool) error {
	ctx := context.Background()
	options := options.UpdateOptions{
		ArrayFilters: &options.ArrayFilters{
			Filters: bson.A{
				bson.M{
					"t._id": id,
				},
			},
		},
	}

	result, err := s.Tasks.UpdateOne(ctx,
		bson.M{
			"_id":        userId,
			"categories": bson.M{"$elemMatch": bson.M{"_id": categoryId}},
		},
		bson.D{{
			Key: "$set", Value: bson.D{
				{Key: "categories.$.tasks.$[t].lastEdited", Value: xutils.NowUTC()},
				{Key: "categories.$.tasks.$[t].active", Value: newStatus}},
		}},
		&options,
	)

	if err != nil {
		return err
	}

	resultDecoded := *result
	fmt.Println(resultDecoded)
	return err

}

func (s *Service) GetActiveTasks(userId primitive.ObjectID) ([]TaskDocument, error) {
	ctx := context.Background()

	pipeline := getTasksByUserPipeline(userId)
	pipeline = append(pipeline, bson.D{
		{Key: "$match", Value: bson.M{
			"active": true,
		}},
	})
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results = make([]TaskDocument, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *Service) CreateTaskFromTemplate(templateId primitive.ObjectID) (*TaskDocument, error) {
	ctx := context.Background()

	template := s.TemplateTasks.FindOne(ctx, bson.M{"_id": templateId})

	// make sure the template exists
	if template.Err() != nil {
		slog.Error("Couldn't find template", "error", template.Err())
		return nil, template.Err()
	}

	var templateDoc TemplateTaskDocument
	err := template.Decode(&templateDoc)
	if err != nil {
		return nil, err
	}

	// construct a task document from the template
	task := constructTaskFromTemplate(&templateDoc)

	//
	templateDoc.LastGenerated = templateDoc.NextGenerated
	thisGeneration := *templateDoc.LastGenerated
	var nextGeneration time.Time
	var deletedCount int

	// Catch-up loop: skip past occurrences
	now := xutils.NowUTC()
	catchUpLimit := 100 // Prevent infinite loops
	iterations := 0

	for {
		iterations++
		if iterations > catchUpLimit {
			slog.Warn("Catch-up limit reached for recurring task", "templateID", templateId)
			break
		}

		if templateDoc.RecurType == "OCCURRENCE" {
			nextGeneration, err = s.ComputeNextOccurrence(&templateDoc)
			if err != nil {
				return nil, err
			}
		} else if templateDoc.RecurType == "DEADLINE" {
			nextGeneration, err = s.ComputeNextDeadline(&templateDoc)
			if err != nil {
				return nil, err
			}
		} else if templateDoc.RecurType == "WINDOW" {
			// Window logic (placeholder)
			nextGeneration, err = s.ComputeNextOccurrence(&templateDoc)
			if err != nil {
				return nil, err
			}
		}

		// Check if the calculated nextGeneration is still in the past
		// If so, update LastGenerated and try again (skip this occurrence)
		if nextGeneration.Before(now) {
			slog.Info("Skipping past recurrence", "templateID", templateId, "skippedTime", nextGeneration)
			templateDoc.LastGenerated = &nextGeneration
			continue
		}

		// Found a future or current occurrence
		break
	}

	// Apply the correct fields to the task based on the type
	if templateDoc.RecurType == "OCCURRENCE" {
		deletedCount, err = s.DeleteTaskFromTemplateID(templateDoc)
		if err != nil {
			return nil, err
		}
		task.StartDate = &nextGeneration
	} else if templateDoc.RecurType == "DEADLINE" {
		if templateDoc.RecurDetails.Behavior == "" || templateDoc.RecurDetails.Behavior != "BUILDUP" {
			deletedCount, err = s.DeleteTaskFromTemplateID(templateDoc)
			if err != nil {
				return nil, err
			}
		}
		task.Deadline = &nextGeneration
	} else if templateDoc.RecurType == "WINDOW" {
		task.Deadline = &nextGeneration
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Updating template", slog.String("templateId", templateId.Hex()), slog.String("lastGenerated", thisGeneration.Format(time.RFC3339)), slog.String("nextGenerated", nextGeneration.Format(time.RFC3339)))

	update := bson.M{
		"$set": bson.M{
			"lastGenerated": &thisGeneration,
			"nextGenerated": &nextGeneration,
		},
		"$inc": bson.M{
			"timesGenerated": 1,
		},
	}

	if deletedCount > 0 {
		incMap, ok := update["$inc"].(bson.M)
		if ok {
			incMap["timesMissed"] = deletedCount
		}
		setMap, ok := update["$set"].(bson.M)
		if ok {
			setMap["streak"] = 0
		}

		// Send push notification to user about missed task
		go func() {
			var user types.User
			err := s.Users.FindOne(ctx, bson.M{"_id": templateDoc.UserID}).Decode(&user)
			if err != nil {
				slog.Error("Failed to find user for missed task notification", "error", err)
				return
			}

			if user.PushToken != "" {
				if err := xutils.SendNotification(xutils.Notification{
					Token:   user.PushToken,
					Title:   "Task Missed",
					Message: fmt.Sprintf("You missed your recurring task: %s", templateDoc.Content),
					Data: map[string]string{
						"taskId": templateDoc.ID.Hex(),
						"type":   "TASK_MISSED",
					},
				}); err != nil {
					slog.Error("Failed to send missed task notification", "error", err)
				}
			}
		}()
	} else {
		// If we didn't delete any task (deletedCount == 0), it means the previous task was likely completed
		// (since it's not in the active list).
		// We only send this notification if:
		// 1. It's not the first generation (TimesGenerated > 0)
		// 2. The recurrence type implies we SHOULD have deleted it if it was there (Rolling/Occurrence)
		//    This prevents sending "Great Job" for Buildup tasks where the old one is intentionally kept.
		isRollingOrOccurrence := templateDoc.RecurType == "OCCURRENCE" ||
			(templateDoc.RecurType == "DEADLINE" && (templateDoc.RecurDetails == nil || templateDoc.RecurDetails.Behavior != "BUILDUP"))

		if templateDoc.TimesGenerated > 0 && isRollingOrOccurrence {
			go func() {
				var user types.User
				err := s.Users.FindOne(ctx, bson.M{"_id": templateDoc.UserID}).Decode(&user)
				if err != nil {
					slog.Error("Failed to find user for completion notification", "error", err)
					return
				}

				if user.PushToken != "" {
					if err := xutils.SendNotification(xutils.Notification{
						Token:   user.PushToken,
						Title:   "Great Job!",
						Message: fmt.Sprintf("We've added '%s' back to your todo list.", templateDoc.Content),
						Data: map[string]string{
							"taskId": templateDoc.ID.Hex(),
							"type":   "TASK_REGENERATED",
						},
					}); err != nil {
						slog.Error("Failed to send task regenerated notification", "error", err)
					}
				}
			}()
		}
	}

	_, err = s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": templateId}, update)
	if err != nil {
		return nil, err
	}

	// insert the task into the database
	_, err = s.Tasks.UpdateOne(ctx, bson.M{"_id": templateDoc.CategoryID}, bson.M{"$push": bson.M{"tasks": task}})
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (s *Service) DeleteTaskFromTemplateID(templateDoc TemplateTaskDocument) (int, error) {
	ctx := context.Background()

	cursor, err := s.Tasks.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: bson.M{"_id": templateDoc.CategoryID}},
		},
		{
			{Key: "$unwind", Value: "$tasks"},
		},
		{
			{Key: "$replaceRoot", Value: bson.M{"newRoot": "$tasks"}},
		},
		{
			{Key: "$match", Value: bson.M{"templateID": templateDoc.ID}},
		},
	})
	if err != nil {
		return 0, err
	}
	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return 0, err
	}

	deletedCount := 0
	for _, result := range results {
		if len(results) > 0 {
			// lets just delete the task for now
			err = s.DeleteTask(templateDoc.CategoryID, result.ID)
			if err != nil {
				slog.Error("Error deleting task in DeleteTaskFromTemplateID", "error", err)
				return deletedCount, err
			}
			deletedCount++
		}
	}

	return deletedCount, nil
}

// CreateTemplateForTask creates a template task for a recurring task
func (s *Service) CreateTemplateForTask(
	userID primitive.ObjectID,
	categoryID primitive.ObjectID,
	templateID primitive.ObjectID,
	content string,
	priority int,
	value float64,
	public bool,
	recurFrequency string,
	recurDetails *RecurDetails,
	deadline *time.Time,
	startTime *time.Time,
	startDate *time.Time,
	reminders []*Reminder,
) error {

	recurType := "OCCURRENCE"

	// if we have a deadline with no start information
	if deadline != nil {
		recurType = "DEADLINE"
		if startTime != nil || startDate != nil {
			recurType = "WINDOW"
		}
	}

	baseTime := xutils.NowUTC()
	if deadline != nil {
		baseTime = *deadline
	} else if startTime != nil {
		baseTime = *startTime
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
		UserID:         userID,
		CategoryID:     categoryID,
		ID:             templateID,
		Content:        content,
		Priority:       priority,
		Value:          value,
		Public:         public,
		RecurType:      recurType,
		RecurFrequency: recurFrequency,
		RecurDetails:   recurDetails,

		Deadline:      deadline,
		StartTime:     startTime,
		StartDate:     startDate,
		LastGenerated: &baseTime,
		Reminders:     relativeReminders,

		// Initialize analytics fields
		TimesGenerated:  0,
		TimesCompleted:  0,
		TimesMissed:     0,
		Streak:          0,
		HighestStreak:   0,
		CompletionDates: []time.Time{}, // Initialize empty array for completion tracking
	}

	var nextOccurrence time.Time
	var err error

	if recurType == "OCCURRENCE" {
		nextOccurrence, err = s.ComputeNextOccurrence(&template_doc)
		if err != nil {
			return fmt.Errorf("error creating OCCURRENCE template task: %w", err)
		}
	} else if recurType == "DEADLINE" {
		nextOccurrence, err = s.ComputeNextDeadline(&template_doc)
		if err != nil {
			return fmt.Errorf("error creating DEADLINE template task: %w", err)
		}
	} else if recurType == "WINDOW" {
		nextOccurrence, err = s.ComputeNextOccurrence(&template_doc)
		if err != nil {
			return fmt.Errorf("error creating WINDOW template task: %w", err)
		}
	}

	template_doc.NextGenerated = &nextOccurrence

	_, err = s.CreateTemplateTask(categoryID, &template_doc)
	if err != nil {
		return fmt.Errorf("error creating template task: %w", err)
	}

	return nil
}

// GetDueRecurringTasks returns all recurring tasks that are due for generation.
// It checks for templates where nextGenerated <= Now.
func (s *Service) GetDueRecurringTasks() ([]TemplateTaskDocument, error) {
	ctx := context.Background()
	now := xutils.NowUTC()

	matchConditions := bson.M{"nextGenerated": bson.M{"$lte": now}}

	templatePipeline := bson.A{
		bson.D{{Key: "$match", Value: matchConditions}},
	}

	cursor, err := s.TemplateTasks.Aggregate(ctx, templatePipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TemplateTaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func (s *Service) GetTasksWithStartTimesOlderThanOneDay(userID ...primitive.ObjectID) ([]TemplateTaskDocument, error) {
	ctx := context.Background()

	inOneDay := xutils.NowUTC()

	baseTime := inOneDay // Simulating which tasks to update in one day

	// This is buggy because it only accounts for tasks that are not completed
	slog.LogAttrs(ctx, slog.LevelInfo, "Getting tasks with start times older than one day using: "+baseTime.String())

	// tasks_pipeline :=
	// 	bson.A{
	// 		bson.D{{"$unwind", "$tasks"}},
	// 		bson.D{{"$replaceRoot", bson.D{{"newRoot", "$tasks"}}}},
	// 		bson.D{{"$match", bson.D{{"templateID", bson.D{{"$exists", true}}}}}},
	// 		bson.D{{"$match", bson.D{{"startDate", bson.D{{"$lte", baseTime.AddDate(0, 0, -1)}}}}}},
	// 	}
	// Completed tasks should be found using template tasks collection

	matchConditions := bson.M{"nextGenerated": bson.M{"$lte": baseTime.AddDate(0, 0, -1)}}

	// If userID is provided, filter by it
	if len(userID) > 0 && !userID[0].IsZero() {
		matchConditions["userID"] = userID[0]
	}

	templatePipeline :=
		bson.A{
			bson.D{{Key: "$match", Value: matchConditions}},
		}

	cursor, err := s.TemplateTasks.Aggregate(ctx, templatePipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TemplateTaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func (s *Service) GetRecurringTasksWithPastDeadlines(userID ...primitive.ObjectID) ([]TemplateTaskDocument, error) {
	ctx := context.Background()

	// pipeline :=
	// 	bson.A{
	// 		bson.D{{"$unwind", "$tasks"}},
	// 		bson.D{{"$replaceRoot", bson.D{{"newRoot", "$tasks"}}}},
	// 		bson.D{{"$match", bson.D{{"templateID", bson.D{{"$exists", true}}}}}},
	// 	  bson.D{{"$match", bson.D{{"deadline", bson.D{{"$lt", xutils.NowUTC()}}}}}},
	// 	}

	matchConditions := bson.M{"deadline": bson.M{"$lt": xutils.NowUTC()}}

	// If userID is provided, filter by it
	if len(userID) > 0 && !userID[0].IsZero() {
		matchConditions["userID"] = userID[0]
	}

	templatePipeline :=
		bson.A{
			bson.D{{Key: "$match", Value: matchConditions}},
		}

	cursor, err := s.TemplateTasks.Aggregate(ctx, templatePipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TemplateTaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// GetRandomTaskForToday returns a random task that is assigned for today
// A task is considered "for today" if:
// - Start date is today
// - Deadline is today
// - Neither start date nor deadline are set (any time tasks)
func (s *Service) GetRandomTaskForToday(userID primitive.ObjectID) (*TaskDocument, error) {
	ctx := context.Background()

	// Get today's date range (start and end of day in UTC)
	now := time.Now().UTC()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, time.UTC)

	// Pipeline to find tasks for the user that are "for today"
	pipeline := []bson.M{
		{
			"$match": bson.M{"user": userID},
		},
		{
			"$unwind": "$tasks",
		},
		{
			"$match": bson.M{
				"$or": []bson.M{
					// Start date is today
					{
						"$and": []bson.M{
							{"tasks.startDate": bson.M{"$ne": nil}},
							{"tasks.startDate": bson.M{"$gte": startOfDay}},
							{"tasks.startDate": bson.M{"$lte": endOfDay}},
						},
					},
					// Deadline is today
					{
						"$and": []bson.M{
							{"tasks.deadline": bson.M{"$ne": nil}},
							{"tasks.deadline": bson.M{"$gte": startOfDay}},
							{"tasks.deadline": bson.M{"$lte": endOfDay}},
						},
					},
					// Neither start date nor deadline are set
					{
						"$and": []bson.M{
							{"tasks.startDate": nil},
							{"tasks.deadline": nil},
						},
					},
				},
			},
		},
		{
			"$set": bson.M{
				"tasks.userID":     "$user",
				"tasks.categoryID": "$_id",
			},
		},
		{
			"$replaceRoot": bson.M{"newRoot": "$tasks"},
		},
		// Add random sampling to get a random task
		{
			"$sample": bson.M{"size": 1},
		},
	}

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate tasks for today: %w", err)
	}
	defer cursor.Close(ctx)

	var task TaskDocument
	if cursor.Next(ctx) {
		if err := cursor.Decode(&task); err != nil {
			return nil, fmt.Errorf("failed to decode task: %w", err)
		}
		return &task, nil
	}

	// No tasks found for today
	return nil, mongo.ErrNoDocuments
}

func (s *Service) DeleteTaskByID(id primitive.ObjectID) error {
	ctx := context.Background()

	// go through all the categories and delete the task
	cursor, err := s.Tasks.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: bson.M{}},
		},
		{
			{Key: "$unwind", Value: "$tasks"},
		},
		{
			{Key: "$match", Value: bson.M{"tasks._id": id}},
		},
	})

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return err
	}

	for _, result := range results {
		err = s.DeleteTask(result.ID, id)
		if err != nil {
			return err
		}
	}
	defer cursor.Close(ctx)

	return err
}

// UpdateTaskNotes updates the notes field of a task
func (s *Service) UpdateTaskNotes(
	id primitive.ObjectID,
	categoryId primitive.ObjectID,
	userId primitive.ObjectID,
	updated UpdateTaskNotesDocument) error {

	ctx := context.Background()

	if err := s.verifyCategoryOwnership(ctx, categoryId, userId); err != nil {
		return errors.New("error verifying category ownership, user must not own this category: " + err.Error())
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Updating task notes", slog.String("categoryId", categoryId.Hex()), slog.String("id", id.Hex()), slog.String("userId", userId.Hex()))

	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{"_id": categoryId},
		bson.D{
			{"$set", bson.D{
				{"tasks.$[t].notes", updated.Notes},
				{"tasks.$[t].lastEdited", xutils.NowUTC()},
			}},
		},
		getTaskArrayFilterOptions(id),
	)

	return handleMongoError(ctx, "update task notes", err)
}

// UpdateTaskChecklist updates the checklist field of a task
func (s *Service) UpdateTaskChecklist(
	id primitive.ObjectID,
	categoryId primitive.ObjectID,
	userId primitive.ObjectID,
	updated UpdateTaskChecklistDocument) error {

	ctx := context.Background()

	// First verify the category belongs to the user
	var category types.CategoryDocument
	err := s.Tasks.FindOne(ctx, bson.M{
		"_id":  categoryId,
		"user": userId,
	}).Decode(&category)
	if err != nil {
		return err
	}

	options := options.UpdateOptions{
		ArrayFilters: &options.ArrayFilters{
			Filters: bson.A{
				bson.M{
					"t._id": id,
				},
			},
		},
	}

	_, err = s.Tasks.UpdateOne(ctx,
		bson.M{
			"_id": categoryId,
		},
		bson.D{{
			Key: "$set", Value: bson.D{
				{Key: "tasks.$[t].checklist", Value: updated.Checklist},
				{Key: "tasks.$[t].lastEdited", Value: xutils.NowUTC()},
			},
		}},
		&options,
	)

	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to update task checklist", slog.String("error", err.Error()))
		return err
	}

	return nil
}

func (s *Service) verifyCategoryOwnership(ctx context.Context, categoryId, userId primitive.ObjectID) error {
	slog.LogAttrs(ctx, slog.LevelInfo, "Verifying category ownership", slog.String("categoryId", categoryId.Hex()), slog.String("userId", userId.Hex()))
	var category types.CategoryDocument
	err := s.Tasks.FindOne(ctx, bson.M{
		"_id":  categoryId,
		"user": userId,
	}).Decode(&category)
	return err
}

func handleMongoError(ctx context.Context, operation string, err error) error {
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to "+operation, slog.String("error", err.Error()))
		return err
	}
	return nil
}

func (s *Service) GetTasksWithPastReminders() ([]TaskDocument, error) {
	ctx := context.Background()

	pipeline := getBaseTaskPipeline()
	pipeline = append(pipeline, bson.D{{"$match", bson.M{"reminders": bson.M{
		"$exists": true,
		"$elemMatch": bson.M{
			"sent": false,
			"triggerTime": bson.M{
				"$lte": xutils.NowUTC(),
			},
		},
	}}}})

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func (s *Service) SendReminder(userID primitive.ObjectID, reminder *Reminder, task *TaskDocument) error {
	ctx := context.Background()
	// lookup the user
	var user types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return err
	}

	fmt.Println("Sending reminder to user", user.PushToken)

	// Generate descriptive reminder message
	message := s.generateReminderMessage(reminder, task)

	// send the reminder to the user
	err = xutils.SendNotification(xutils.Notification{
		Token:   user.PushToken,
		Message: message,
		Data: map[string]string{
			"taskId": task.ID.Hex(),
		},
	})

	return err
}

// generateReminderMessage creates a descriptive reminder message based on timing and task details
func (s *Service) generateReminderMessage(reminder *Reminder, task *TaskDocument) string {
	now := time.Now()
	taskName := task.Content

	// Use custom message if provided
	if reminder.CustomMessage != nil && *reminder.CustomMessage != "" {
		return *reminder.CustomMessage + ": " + taskName
	}

	// Calculate time differences
	var timeDiff time.Duration
	var baseMessage string

	// Before/After Start logic
	if reminder.BeforeStart && task.StartTime != nil {
		timeDiff = task.StartTime.Sub(now)
		if timeDiff > 0 {
			baseMessage = formatTimeMessage("starts in", timeDiff, taskName)
		} else {
			baseMessage = "Starting now: " + taskName
		}
	} else if reminder.AfterStart && task.StartTime != nil {
		timeDiff = now.Sub(*task.StartTime)
		if timeDiff > 0 {
			baseMessage = formatOverdueMessage("started", timeDiff, taskName)
		} else {
			baseMessage = "Starting: " + taskName
		}
	}

	// Before/After Deadline logic
	if reminder.BeforeDeadline && task.Deadline != nil {
		timeDiff = task.Deadline.Sub(now)
		if timeDiff > 0 {
			baseMessage = formatTimeMessage("due in", timeDiff, taskName)
		} else {
			baseMessage = "Due now: " + taskName
		}
	} else if reminder.AfterDeadline && task.Deadline != nil {
		timeDiff = now.Sub(*task.Deadline)
		if timeDiff > 0 {
			baseMessage = formatOverdueMessage("was due", timeDiff, taskName)
		} else {
			baseMessage = "Due: " + taskName
		}
	}

	// Fallback if no specific timing
	if baseMessage == "" {
		baseMessage = "Reminder: " + taskName
	}

	return baseMessage
}

// formatTimeMessage formats future time messages like "starts in 15 minutes"
func formatTimeMessage(action string, duration time.Duration, taskName string) string {
	timeStr := formatDuration(duration)
	return fmt.Sprintf("Task %s %s: %s", action, timeStr, taskName)
}

// formatOverdueMessage formats past time messages like "started 5 minutes ago"
func formatOverdueMessage(pastAction string, duration time.Duration, taskName string) string {
	timeStr := formatDuration(duration)
	if pastAction == "was due" {
		return fmt.Sprintf("Overdue: %s (%s %s ago)", taskName, pastAction, timeStr)
	}
	return fmt.Sprintf("Task %s %s ago: %s", pastAction, timeStr, taskName)
}

// formatDuration converts duration to human-readable format
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return "now"
	} else if d < time.Hour {
		minutes := int(d.Minutes())
		if minutes == 1 {
			return "1 minute"
		}
		return fmt.Sprintf("%d minutes", minutes)
	} else if d < 24*time.Hour {
		hours := int(d.Hours())
		if hours == 1 {
			return "1 hour"
		}
		return fmt.Sprintf("%d hours", hours)
	} else {
		days := int(d.Hours() / 24)
		if days == 1 {
			return "1 day"
		}
		return fmt.Sprintf("%d days", days)
	}
}

func (s *Service) UpdateReminderSent(taskID primitive.ObjectID, categoryID primitive.ObjectID, userID primitive.ObjectID) error {
	ctx := context.Background()

	options := options.UpdateOptions{
		ArrayFilters: &options.ArrayFilters{
			Filters: bson.A{
				bson.M{
					"t._id": taskID,
				},
			},
		},
	}

	// Pull the reminder from the list of reminders
	// if the triggerTime is less than or equal to the current time, pull it from the list
	_, err := s.Tasks.UpdateOne(ctx,
		bson.M{"_id": categoryID},
		bson.M{"$pull": bson.M{"tasks.$[t].reminders": bson.M{"triggerTime": bson.M{"$lte": xutils.NowUTC()}}}},
		&options)
	return err
}

func (s *Service) AddReminderToTask(taskID primitive.ObjectID, categoryID primitive.ObjectID, userID primitive.ObjectID, reminder Reminder) error {
	ctx := context.Background()

	if err := s.verifyCategoryOwnership(ctx, categoryID, userID); err != nil {
		return errors.New("error verifying category ownership, user must not own this category: " + err.Error())
	}

	// frontend would calculate trigger time based on the thingies

	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{"_id": categoryID},
		bson.D{
			{"$push", bson.M{
				"tasks.$[t].reminders": reminder,
			}},
		},
		getTaskArrayFilterOptions(taskID),
	)

	return handleMongoError(ctx, "add reminder to task", err)
}

func (s *Service) GetTemplateByID(id primitive.ObjectID) (*TemplateTaskDocument, error) {
	ctx := context.Background()

	var template TemplateTaskDocument
	err := s.TemplateTasks.FindOne(ctx, bson.M{"_id": id}).Decode(&template)
	return &template, err
}

// UpdateTemplateTask updates a template task document by ID
func (s *Service) UpdateTemplateTask(id primitive.ObjectID, updated UpdateTemplateDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	// Always update the lastEdited field
	*updateFields = append(*updateFields, bson.E{Key: "lastEdited", Value: xutils.NowUTC()})

	update := bson.M{"$set": updateFields}

	result, err := s.TemplateTasks.UpdateOne(ctx, filter, update)
	if err != nil {
		return handleMongoError(ctx, "update template task", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("template task not found")
	}

	return nil
}

// GetTemplatesByUserWithCategory retrieves all template tasks for a user with category names
func (s *Service) GetTemplatesByUserWithCategory(userID primitive.ObjectID) ([]TemplateWithCategory, error) {
	ctx := context.Background()

	slog.LogAttrs(ctx, slog.LevelInfo, "GetTemplatesByUserWithCategory called",
		slog.String("userID", userID.Hex()))

	// Use aggregation to join with categories collection for category names
	pipeline := mongo.Pipeline{
		// Match templates for this user
		{{Key: "$match", Value: bson.M{"userID": userID}}},
		// Lookup category name
		{{Key: "$lookup", Value: bson.M{
			"from":         "categories",
			"localField":   "categoryID",
			"foreignField": "_id",
			"as":           "categoryInfo",
		}}},
		// Add category name field
		{{Key: "$addFields", Value: bson.M{
			"categoryName": bson.M{
				"$ifNull": bson.A{
					bson.M{"$arrayElemAt": bson.A{"$categoryInfo.name", 0}},
					"Unknown",
				},
			},
		}}},
		// Remove the temporary categoryInfo array
		{{Key: "$project", Value: bson.M{
			"categoryInfo": 0,
		}}},
		// Sort by category name, then content
		{{Key: "$sort", Value: bson.D{
			{Key: "categoryName", Value: 1},
			{Key: "content", Value: 1},
		}}},
	}

	cursor, err := s.TemplateTasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var templates []TemplateWithCategory
	if err := cursor.All(ctx, &templates); err != nil {
		return nil, err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "GetTemplatesByUserWithCategory returning",
		slog.Int("templateCount", len(templates)))

	return templates, nil
}

func (s *Service) GetCompletedTasks(userId primitive.ObjectID, page int, limit int) ([]TaskDocument, int64, error) {
	ctx := context.Background()

	// Calculate skip value for pagination
	skip := (page - 1) * limit

	// Get total count of completed tasks for this user
	totalCount, err := s.CompletedTasks.CountDocuments(ctx, bson.M{"user": userId})
	if err != nil {
		return nil, 0, err
	}

	// Sort by timeCompleted in descending order (most recent first)
	// Add pagination with limit and skip
	findOptions := options.Find().
		SetSort(bson.D{{Key: "timeCompleted", Value: -1}}).
		SetLimit(int64(limit)).
		SetSkip(int64(skip))

	cursor, err := s.CompletedTasks.Find(ctx, bson.M{"user": userId}, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	// Decode tasks one by one to handle errors gracefully
	for cursor.Next(ctx) {
		var task TaskDocument
		if err := cursor.Decode(&task); err != nil {
			// Log the error but continue processing other tasks
			slog.LogAttrs(ctx, slog.LevelError, "Failed to unmarshal task in GetCompletedTasks",
				slog.String("error", err.Error()))
			continue // Skip this task and continue with others
		}
		results = append(results, task)
	}

	if err := cursor.Err(); err != nil {
		return nil, 0, err
	}
	return results, totalCount, nil
}

func (s *Service) GetCompletedTasksByDate(userId primitive.ObjectID, date time.Time) ([]TaskDocument, error) {
	ctx := context.Background()

	// date is expected to be midnight in the user's timezone (or UTC if not specified)
	// We need to find tasks completed between date (start of day) and date + 24h (end of day)
	// Mongo stores times in UTC, so we need to convert the start/end times to UTC for the query

	startOfDay := date
	endOfDay := date.Add(24*time.Hour - 1*time.Nanosecond)

	// Debug logging
	slog.LogAttrs(ctx, slog.LevelInfo, "GetCompletedTasksByDate query range",
		slog.String("userId", userId.Hex()),
		slog.Time("startLocal", startOfDay),
		slog.Time("endLocal", endOfDay),
		slog.Time("startUTC", startOfDay.UTC()),
		slog.Time("endUTC", endOfDay.UTC()))

	filter := bson.M{
		"user": userId,
		"timeCompleted": bson.M{
			"$gte": startOfDay.UTC(),
			"$lte": endOfDay.UTC(),
		},
	}

	// First, count total completed tasks for this user (for debugging)
	totalUserTasks, _ := s.CompletedTasks.CountDocuments(ctx, bson.M{"user": userId})

	slog.LogAttrs(ctx, slog.LevelInfo, "GetCompletedTasksByDate executing query",
		slog.String("filter", fmt.Sprintf("%+v", filter)),
		slog.Int64("totalUserCompletedTasks", totalUserTasks))

	cursor, err := s.CompletedTasks.Find(ctx, filter)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "GetCompletedTasksByDate cursor error",
			slog.String("error", err.Error()))
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	// Decode tasks one by one to handle errors gracefully
	for cursor.Next(ctx) {
		var task TaskDocument
		if err := cursor.Decode(&task); err != nil {
			// Log the error but continue processing other tasks
			slog.LogAttrs(ctx, slog.LevelError, "Failed to unmarshal task",
				slog.String("error", err.Error()))
			// Try to get the raw document for debugging
			var rawDoc bson.M
			if err := cursor.Decode(&rawDoc); err == nil {
				slog.LogAttrs(ctx, slog.LevelError, "Raw document that failed",
					slog.Any("document", rawDoc))
			}
			continue // Skip this task and continue with others
		}
		results = append(results, task)
	}

	if err := cursor.Err(); err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "GetCompletedTasksByDate cursor error",
			slog.String("error", err.Error()))
		return nil, err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "GetCompletedTasksByDate returning",
		slog.Int("taskCount", len(results)))

	// Log first few tasks for debugging
	for i, task := range results {
		if i < 3 { // Only log first 3 tasks
			slog.LogAttrs(ctx, slog.LevelInfo, "GetCompletedTasksByDate task",
				slog.Int("index", i),
				slog.String("content", task.Content),
				slog.Time("timeCompleted", *task.TimeCompleted))
		}
	}

	return results, nil
}

// Specialized update methods for targeted operations

// UpdateTaskDeadline updates only the deadline field of a task
func (s *Service) UpdateTaskDeadline(id primitive.ObjectID, categoryID primitive.ObjectID, userID primitive.ObjectID, update UpdateTaskDeadlineDocument) error {
	ctx := context.Background()

	if err := s.verifyCategoryOwnership(ctx, categoryID, userID); err != nil {
		return errors.New("error verifying category ownership, user must not own this category: " + err.Error())
	}

	updateFields := bson.M{
		"tasks.$[t].deadline":   update.Deadline,
		"tasks.$[t].lastEdited": xutils.NowUTC(),
	}

	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{"_id": categoryID},
		bson.M{"$set": updateFields},
		getTaskArrayFilterOptions(id),
	)

	return handleMongoError(ctx, "update task deadline", err)
}

// UpdateTaskStart updates the start date and time fields of a task
func (s *Service) UpdateTaskStart(id primitive.ObjectID, categoryID primitive.ObjectID, userID primitive.ObjectID, update UpdateTaskStartDocument) error {
	ctx := context.Background()

	if err := s.verifyCategoryOwnership(ctx, categoryID, userID); err != nil {
		return errors.New("error verifying category ownership, user must not own this category: " + err.Error())
	}

	updateFields := bson.M{
		"tasks.$[t].lastEdited": xutils.NowUTC(),
	}

	// Combine StartDate and StartTime if both are provided
	// StartTime from the time picker includes the current date, but we want to use the date from StartDate
	if update.StartTime != nil && update.StartDate != nil {
		// Extract time components (hour, minute, second) from StartTime
		hour, min, sec := update.StartTime.Clock()

		// Combine the date from StartDate with the time from StartTime
		combinedDateTime := time.Date(
			update.StartDate.Year(),
			update.StartDate.Month(),
			update.StartDate.Day(),
			hour, min, sec, 0,
			update.StartDate.Location(),
		)

		// Update StartDate to include the time
		updateFields["tasks.$[t].startDate"] = combinedDateTime
		// Keep StartTime as well for potential future use/display
		updateFields["tasks.$[t].startTime"] = update.StartTime
	} else {
		// Only update fields that are provided individually
		if update.StartDate != nil {
			updateFields["tasks.$[t].startDate"] = update.StartDate
		}
		if update.StartTime != nil {
			updateFields["tasks.$[t].startTime"] = update.StartTime
		}
	}

	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{"_id": categoryID},
		bson.M{"$set": updateFields},
		getTaskArrayFilterOptions(id),
	)

	return handleMongoError(ctx, "update task start date/time", err)
}

// UpdateTaskReminders updates the reminders field of a task
func (s *Service) UpdateTaskReminders(id primitive.ObjectID, categoryID primitive.ObjectID, userID primitive.ObjectID, update UpdateTaskReminderDocument) error {
	ctx := context.Background()

	if err := s.verifyCategoryOwnership(ctx, categoryID, userID); err != nil {
		return errors.New("error verifying category ownership, user must not own this category: " + err.Error())
	}

	updateFields := bson.M{
		"tasks.$[t].reminders":  update.Reminders,
		"tasks.$[t].lastEdited": xutils.NowUTC(),
	}

	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{"_id": categoryID},
		bson.M{"$set": updateFields},
		getTaskArrayFilterOptions(id),
	)

	return handleMongoError(ctx, "update task reminders", err)
}
