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

func getTaskByIdPipeline(id primitive.ObjectID) []bson.D {
	return append(getBaseTaskPipeline(), bson.D{
		{Key: "$match", Value: bson.M{"_id": id}},
	})
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
	err = cursor.All(ctx, &Task)
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
		{Key: "tasks.$[t].active", Value: updated.Active},
	}

	// Add the new fields conditionally
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
	if templateDoc.RecurType == "OCCURRENCE" {

		err = s.DeleteTaskFromTemplateID(templateDoc)
		if err != nil {
			return nil, err
		}

		nextGeneration, err = s.ComputeNextOccurrence(&templateDoc)
		slog.LogAttrs(ctx, slog.LevelInfo, "Next occurrence", slog.String("nextGeneration", nextGeneration.Format(time.RFC3339)))
		if err != nil {
			return nil, err
		}
		task.StartDate = &nextGeneration

	} else if templateDoc.RecurType == "DEADLINE" {

		// if the recur behavior is buildup, then we dont need to delete the last task
		// otherwise, if its rolling we need to delete the last task
		fmt.Println(templateDoc.RecurDetails)
		if templateDoc.RecurDetails.Behavior == "" || templateDoc.RecurDetails.Behavior != "BUILDUP" {
			fmt.Println("Deleting task from template because this is a rolling deadline")
			err = s.DeleteTaskFromTemplateID(templateDoc)
			if err != nil {
				return nil, err
			}
		}
		nextGeneration, err = s.ComputeNextDeadline(&templateDoc)
		if err != nil {
			return nil, err
		}
		task.Deadline = &nextGeneration
	} else if templateDoc.RecurType == "WINDOW" {
		// TODO: implement window
		nextGeneration = *templateDoc.NextGenerated
		task.Deadline = &nextGeneration
	}
	slog.LogAttrs(ctx, slog.LevelInfo, "Updating template", slog.String("templateId", templateId.Hex()), slog.String("lastGenerated", thisGeneration.Format(time.RFC3339)), slog.String("nextGenerated", nextGeneration.Format(time.RFC3339)))
	s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": templateId}, bson.M{"$set": bson.M{"lastGenerated": &thisGeneration, "nextGenerated": &nextGeneration}})

	// insert the task into the database
	_, err = s.Tasks.UpdateOne(ctx, bson.M{"_id": templateDoc.CategoryID}, bson.M{"$push": bson.M{"tasks": task}})
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (s *Service) DeleteTaskFromTemplateID(templateDoc TemplateTaskDocument) error {
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
		return err
	}
	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return err
	}
	for _, result := range results {
		if len(results) > 0 {
			// lets just delete the task for now
			err = s.DeleteTask(templateDoc.CategoryID, result.ID)
			if err != nil {
				slog.Error("Error deleting task in DeleteTaskFromTemplateID", "error", err)
				return err
			}
		}
	}

	return nil
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

/*
This returns a bson.D that can be used to update a task
*/
func getCommonTaskUpdateFields() bson.D {
	return bson.D{
		{Key: "tasks.$[t].lastEdited", Value: xutils.NowUTC()},
	}
}

func (s *Service) createTaskInCategory(ctx context.Context, categoryId primitive.ObjectID, task *TaskDocument) error {
	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{"_id": categoryId},
		bson.M{"$push": bson.M{"tasks": task}},
	)
	return handleMongoError(ctx, "create task", err)
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

func (s *Service) GetCompletedTasks(userId primitive.ObjectID, page int, limit int) ([]TaskDocument, int64, error) {
	ctx := context.Background()

	// Calculate skip value for pagination
	skip := (page - 1) * limit

	// Get total count of completed tasks for this user
	totalCount, err := s.CompletedTasks.CountDocuments(ctx, bson.M{"userID": userId})
	if err != nil {
		return nil, 0, err
	}

	// Sort by timeCompleted in descending order (most recent first)
	// Add pagination with limit and skip
	findOptions := options.Find().
		SetSort(bson.D{{Key: "timeCompleted", Value: -1}}).
		SetLimit(int64(limit)).
		SetSkip(int64(skip))

	cursor, err := s.CompletedTasks.Find(ctx, bson.M{"userID": userId}, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, err
	}
	return results, totalCount, nil
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
