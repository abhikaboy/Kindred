package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

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

// QueryTasksByUser retrieves tasks for a user with dynamic filtering
func (s *Service) QueryTasksByUser(userId primitive.ObjectID, filters TaskQueryFilters) ([]TaskDocument, error) {
	ctx := context.Background()
	var pipeline []bson.D

	// Step 1: Match by user
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{"user": userId}}})

	// Step 2: If category IDs filter specified, match before unwind for efficiency
	if len(filters.CategoryIDs) > 0 {
		categoryObjIDs := make([]primitive.ObjectID, 0, len(filters.CategoryIDs))
		for _, idStr := range filters.CategoryIDs {
			objID, err := primitive.ObjectIDFromHex(idStr)
			if err != nil {
				continue // Skip invalid IDs
			}
			categoryObjIDs = append(categoryObjIDs, objID)
		}
		if len(categoryObjIDs) > 0 {
			pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{"_id": bson.M{"$in": categoryObjIDs}}}})
		}
	}

	// Step 3: Unwind tasks array
	pipeline = append(pipeline, bson.D{{Key: "$unwind", Value: "$tasks"}})

	// Step 4: Set categoryID and userID on each task
	pipeline = append(pipeline, bson.D{{Key: "$set", Value: bson.M{
		"tasks.categoryID": "$_id",
		"tasks.userID":     "$user",
	}}})

	// Step 5: Replace root with task document
	pipeline = append(pipeline, bson.D{{Key: "$replaceRoot", Value: bson.M{"newRoot": "$tasks"}}})

	// Step 6: Build dynamic post-unwind $match conditions
	var andConditions []bson.M

	// Priority filter
	if len(filters.Priorities) > 0 {
		andConditions = append(andConditions, bson.M{"priority": bson.M{"$in": filters.Priorities}})
	}

	// Deadline filter
	if filters.HasDeadline != nil {
		if *filters.HasDeadline {
			deadlineCond := bson.M{"$exists": true, "$ne": nil}
			if filters.DeadlineFrom != nil {
				deadlineCond["$gte"] = *filters.DeadlineFrom
			}
			if filters.DeadlineTo != nil {
				deadlineCond["$lte"] = *filters.DeadlineTo
			}
			andConditions = append(andConditions, bson.M{"deadline": deadlineCond})
		} else {
			andConditions = append(andConditions, bson.M{"$or": bson.A{
				bson.M{"deadline": nil},
				bson.M{"deadline": bson.M{"$exists": false}},
			}})
		}
	} else if filters.DeadlineFrom != nil || filters.DeadlineTo != nil {
		deadlineCond := bson.M{}
		if filters.DeadlineFrom != nil {
			deadlineCond["$gte"] = *filters.DeadlineFrom
		}
		if filters.DeadlineTo != nil {
			deadlineCond["$lte"] = *filters.DeadlineTo
		}
		andConditions = append(andConditions, bson.M{"deadline": deadlineCond})
	}

	// Start date filter
	if filters.HasStartTime != nil {
		if *filters.HasStartTime {
			startCond := bson.M{"$exists": true, "$ne": nil}
			if filters.StartTimeFrom != nil {
				startCond["$gte"] = *filters.StartTimeFrom
			}
			if filters.StartTimeTo != nil {
				startCond["$lte"] = *filters.StartTimeTo
			}
			andConditions = append(andConditions, bson.M{"startDate": startCond})
		} else {
			andConditions = append(andConditions, bson.M{"$or": bson.A{
				bson.M{"startDate": nil},
				bson.M{"startDate": bson.M{"$exists": false}},
			}})
		}
	} else if filters.StartTimeFrom != nil || filters.StartTimeTo != nil {
		startCond := bson.M{}
		if filters.StartTimeFrom != nil {
			startCond["$gte"] = *filters.StartTimeFrom
		}
		if filters.StartTimeTo != nil {
			startCond["$lte"] = *filters.StartTimeTo
		}
		andConditions = append(andConditions, bson.M{"startDate": startCond})
	}

	// Active filter
	if filters.Active != nil {
		andConditions = append(andConditions, bson.M{"active": *filters.Active})
	}

	if len(andConditions) > 0 {
		var matchCondition bson.M
		if len(andConditions) == 1 {
			matchCondition = andConditions[0]
		} else {
			aArray := make(bson.A, len(andConditions))
			for i, c := range andConditions {
				aArray[i] = c
			}
			matchCondition = bson.M{"$and": aArray}
		}
		pipeline = append(pipeline, bson.D{{Key: "$match", Value: matchCondition}})
	}

	// Step 7: Sort
	sortBy := filters.SortBy
	if sortBy == "" {
		sortBy = "timestamp"
	}
	sortDir := filters.SortDir
	if sortDir != 1 && sortDir != -1 {
		sortDir = -1
	}
	pipeline = append(pipeline, bson.D{{Key: "$sort", Value: bson.D{{Key: sortBy, Value: sortDir}}}})

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
