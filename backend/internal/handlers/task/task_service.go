package task

//nolint:unkeyed
//nolint:composites

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

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

func handleMongoError(ctx context.Context, operation string, err error) error {
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to "+operation, slog.String("error", err.Error()))
		return err
	}
	return nil
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
	NextFlexTask  *NextFlexTaskInfo
}

type NextFlexTaskInfo struct {
	Task       TaskDocument `json:"task"`
	CategoryID string       `json:"categoryId"`
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
				"categoryID":    categoryId,
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
	var flexResult *NextFlexTaskInfo
	if taskToComplete.TemplateID != nil {
		result, err := s.TemplateTasks.UpdateOne(ctx,
			bson.M{"_id": *taskToComplete.TemplateID},
			mongo.Pipeline{
				{{Key: "$set", Value: bson.M{
					"streak":         bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$streak", 0}}, 1}},
					"timesCompleted": bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$timesCompleted", 0}}, 1}},
				}}},
				{{Key: "$set", Value: bson.M{
					"highestStreak": bson.M{"$cond": bson.A{
						bson.M{"$gt": bson.A{"$streak", bson.M{"$ifNull": bson.A{"$highestStreak", 0}}}},
						"$streak",
						bson.M{"$ifNull": bson.A{"$highestStreak", 0}},
					}},
				}}},
				{{Key: "$set", Value: bson.M{
					"completionDates": bson.M{"$concatArrays": bson.A{
						bson.M{"$ifNull": bson.A{"$completionDates", bson.A{}}},
						bson.A{xutils.NowUTC()},
					}},
				}}},
			},
		)
		if err != nil {
			slog.Error("Failed to update template stats", "error", err, "templateID", *taskToComplete.TemplateID)
			// Don't fail the completion
		} else {
			slog.Info("Updated template stats",
				"templateID", taskToComplete.TemplateID.Hex(),
				"matchedCount", result.MatchedCount,
				"modifiedCount", result.ModifiedCount)

			// Debug: Fetch and log the updated template
			var debugTemplate TemplateTaskDocument
			if err := s.TemplateTasks.FindOne(ctx, bson.M{"_id": *taskToComplete.TemplateID}).Decode(&debugTemplate); err == nil {
				slog.Info("Template after stats update",
					"templateID", taskToComplete.TemplateID.Hex(),
					"streak", debugTemplate.Streak,
					"timesCompleted", debugTemplate.TimesCompleted,
					"highestStreak", debugTemplate.HighestStreak)
			}
		}

		template, err := s.GetTemplateByID(*taskToComplete.TemplateID)
		if err == nil && template != nil {
			if template.RecurType == "FLEX" && template.FlexState != nil {
				nextFlexTask, err := s.handleFlexCompletion(ctx, template)
				if err != nil {
					slog.Error("Failed to handle flex completion", "error", err, "templateID", *taskToComplete.TemplateID)
				}
				flexResult = nextFlexTask
			} else {
				// For rolling recurring tasks, schedule the next instance via the cron
				isRolling := template.RecurDetails == nil || template.RecurDetails.Behavior != "BUILDUP"
				if isRolling {
					if err := s.ScheduleNextRecurrence(*taskToComplete.TemplateID); err != nil {
						slog.Error("Failed to schedule next recurring task", "error", err, "templateID", *taskToComplete.TemplateID)
					}
				}
			}
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
		NextFlexTask:  flexResult,
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
	itemSlice := make([]bulkTaskItem, len(tasks))
	for i, t := range tasks {
		itemSlice[i] = t
	}
	parsedTasks, failedIDs := parseBulkTaskIDs(itemSlice)
	output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, failedIDs...)

	// Build the structures that the rest of the method expects
	type taskMapping struct {
		taskID        primitive.ObjectID
		categoryID    primitive.ObjectID
		completeData  CompleteTaskDocument
		originalIndex int
	}

	validTasks := make([]taskMapping, 0, len(parsedTasks))
	taskIDMap := make(map[primitive.ObjectID]taskMapping) // For quick lookup
	taskIDs := make([]primitive.ObjectID, 0, len(parsedTasks))

	for _, p := range parsedTasks {
		mapping := taskMapping{
			taskID:        p.taskID,
			categoryID:    p.categoryID,
			completeData:  tasks[p.index].CompleteData,
			originalIndex: p.index,
		}
		validTasks = append(validTasks, mapping)
		taskIDMap[p.taskID] = mapping
		taskIDs = append(taskIDs, p.taskID)
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
					"categoryID":    mapping.categoryID,
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
		result, err := s.TemplateTasks.UpdateMany(ctx,
			bson.M{"_id": bson.M{"$in": templateIDList}},
			mongo.Pipeline{
				{{Key: "$set", Value: bson.M{
					"streak":         bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$streak", 0}}, 1}},
					"timesCompleted": bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$timesCompleted", 0}}, 1}},
				}}},
				{{Key: "$set", Value: bson.M{
					"highestStreak": bson.M{"$cond": bson.A{
						bson.M{"$gt": bson.A{"$streak", bson.M{"$ifNull": bson.A{"$highestStreak", 0}}}},
						"$streak",
						bson.M{"$ifNull": bson.A{"$highestStreak", 0}},
					}},
				}}},
				{{Key: "$set", Value: bson.M{
					"completionDates": bson.M{"$concatArrays": bson.A{
						bson.M{"$ifNull": bson.A{"$completionDates", bson.A{}}},
						bson.A{xutils.NowUTC()},
					}},
				}}},
			},
		)
		if err != nil {
			slog.Error("Failed to bulk update template stats", "error", err)
			// Don't fail the operation
		} else {
			slog.Info("Bulk updated template stats",
				"templateCount", len(templateIDList),
				"matchedCount", result.MatchedCount,
				"modifiedCount", result.ModifiedCount)
		}

		// Schedule next recurrence for each rolling template so the cron
		// creates the next instance at the appropriate time.
		for _, templateID := range templateIDList {
			tmpl, tmplErr := s.GetTemplateByID(templateID)
			if tmplErr != nil || tmpl == nil {
				continue
			}
			isRolling := tmpl.RecurDetails == nil || tmpl.RecurDetails.Behavior != "BUILDUP"
			if isRolling {
				if err := s.ScheduleNextRecurrence(templateID); err != nil {
					slog.Error("Failed to schedule next recurring task in bulk complete",
						"error", err, "templateID", templateID)
				}
			}
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
	itemSlice := make([]bulkTaskItem, len(tasks))
	for i, t := range tasks {
		itemSlice[i] = t
	}
	parsedTasks, failedIDs := parseBulkTaskIDs(itemSlice)
	output.Body.FailedTaskIDs = append(output.Body.FailedTaskIDs, failedIDs...)

	// Build the structures that the rest of the method expects
	type taskMapping struct {
		taskID          primitive.ObjectID
		categoryID      primitive.ObjectID
		deleteRecurring bool
		originalIndex   int
	}

	validTasks := make([]taskMapping, 0, len(parsedTasks))
	taskIDs := make([]primitive.ObjectID, 0, len(parsedTasks))

	for _, p := range parsedTasks {
		mapping := taskMapping{
			taskID:          p.taskID,
			categoryID:      p.categoryID,
			deleteRecurring: tasks[p.index].DeleteRecurring,
			originalIndex:   p.index,
		}
		validTasks = append(validTasks, mapping)
		taskIDs = append(taskIDs, p.taskID)
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

	// Frontend now sends a pre-combined startDate (date + time in local timezone),
	// so we store the values as received.
	if update.StartDate != nil {
		updateFields["tasks.$[t].startDate"] = update.StartDate
	}
	if update.StartTime != nil {
		updateFields["tasks.$[t].startTime"] = update.StartTime
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
