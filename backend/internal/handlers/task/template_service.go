package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func (s *Service) CreateTemplateTask(categoryId primitive.ObjectID, r *TemplateTaskDocument) (*TemplateTaskDocument, error) {
	ctx := context.Background()

	_, err := s.TemplateTasks.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	return r, nil
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

	// Flex tasks have their own generation logic
	if templateDoc.RecurType == "FLEX" && templateDoc.FlexState != nil {
		return s.createFlexTaskFromTemplate(ctx, &templateDoc, task)
	}

	// Ensure NextGenerated is not nil before proceeding
	if templateDoc.NextGenerated == nil {
		return nil, fmt.Errorf("template NextGenerated is nil for template %s", templateId.Hex())
	}

	templateDoc.LastGenerated = templateDoc.NextGenerated
	thisGeneration := *templateDoc.LastGenerated
	var nextGeneration time.Time
	var deletedCount int
	var skippedOccurrences int // Track if we skipped any occurrences (missed tasks)

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
			nextGeneration, err = s.ComputeNextWindow(&templateDoc)
			if err != nil {
				return nil, err
			}
		}

		// Check if the calculated nextGeneration is still in the past
		// If so, update LastGenerated and try again (skip this occurrence)
		if nextGeneration.Before(now) {
			slog.Info("Skipping past recurrence", "templateID", templateId, "skippedTime", nextGeneration)
			templateDoc.LastGenerated = &nextGeneration
			skippedOccurrences++ // Track that we skipped an occurrence
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
		if templateDoc.RecurDetails == nil || templateDoc.RecurDetails.Behavior != "BUILDUP" {
			deletedCount, err = s.DeleteTaskFromTemplateID(templateDoc)
			if err != nil {
				return nil, err
			}
		}
		task.Deadline = &nextGeneration
	} else if templateDoc.RecurType == "WINDOW" {
		if templateDoc.RecurDetails == nil || templateDoc.RecurDetails.Behavior != "BUILDUP" {
			deletedCount, err = s.DeleteTaskFromTemplateID(templateDoc)
			if err != nil {
				return nil, err
			}
		}

		// Preserve original window duration while anchoring times to the next occurrence date
		startSource := templateDoc.StartTime
		if startSource == nil && templateDoc.StartDate != nil {
			startSource = templateDoc.StartDate
		}
		nextStart := applyTimeToDate(nextGeneration, startSource, nil)

		var nextDeadline time.Time
		if templateDoc.StartDate != nil && templateDoc.Deadline != nil {
			duration := xutils.ToUTC(*templateDoc.Deadline).Sub(xutils.ToUTC(*templateDoc.StartDate))
			if duration > 0 {
				nextDeadline = nextStart.Add(duration)
			}
		}
		if nextDeadline.IsZero() {
			nextDeadline = applyTimeToDate(nextGeneration, templateDoc.Deadline, nil)
		}

		task.StartDate = &nextStart
		task.Deadline = &nextDeadline
	}

	// Recompute reminder trigger times for the new instance based on shifted dates
	task.Reminders = recomputeReminderTriggerTimes(templateDoc.Reminders, &templateDoc, &task)

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

	missedTotal := deletedCount + skippedOccurrences
	if missedTotal > 0 {
		incMap, ok := update["$inc"].(bson.M)
		if ok {
			incMap["timesMissed"] = missedTotal
		}
	}

	// A task is missed if we skipped past occurrences OR if we had to delete
	// an uncompleted active task to make way for the new one.
	taskWasMissed := skippedOccurrences > 0 || deletedCount > 0

	if taskWasMissed {
		setMap, ok := update["$set"].(bson.M)
		if ok {
			setMap["streak"] = 0
			setMap["previousStreak"] = templateDoc.Streak
			now := xutils.NowUTC()
			setMap["lastMissedAt"] = &now
		}

		totalMissed := skippedOccurrences + deletedCount
		go func() {
			user, err := s.Users.GetUserByID(ctx, templateDoc.UserID)
			if err != nil {
				slog.Error("Failed to find user for missed task notification", "error", err)
				return
			}

			if user.PushToken != "" {
				message := fmt.Sprintf("You missed your recurring task: %s", templateDoc.Content)
				if totalMissed > 1 {
					message = fmt.Sprintf("You missed %d occurrences of: %s", totalMissed, templateDoc.Content)
				}
				if err := xutils.SendNotification(xutils.Notification{
					Token:   user.PushToken,
					Title:   "Task Missed",
					Message: message,
					Data: map[string]string{
						"taskId": templateDoc.ID.Hex(),
						"type":   "TASK_MISSED",
						"url":    "/(logged-in)/(tabs)/(task)/undo-missed/" + templateDoc.ID.Hex(),
					},
				}); err != nil {
					slog.Error("Failed to send missed task notification", "error", err)
				}
			}
		}()
	} else if templateDoc.TimesGenerated > 0 {
		// No missed tasks: the previous task was completed (not in the active list).
		// Only send "Great Job!" for rolling/occurrence types (not buildup, where old tasks are kept).
		isRollingOrOccurrence := templateDoc.RecurType == "OCCURRENCE" ||
			(templateDoc.RecurType == "DEADLINE" && (templateDoc.RecurDetails == nil || templateDoc.RecurDetails.Behavior != "BUILDUP")) ||
			(templateDoc.RecurType == "WINDOW" && (templateDoc.RecurDetails == nil || templateDoc.RecurDetails.Behavior != "BUILDUP"))

		if isRollingOrOccurrence {
			go func() {
				user, err := s.Users.GetUserByID(ctx, templateDoc.UserID)
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
	notes string,
	checklist []ChecklistItem,
) error {

	if err := ValidateRecurDetails(recurFrequency, recurDetails); err != nil {
		return err
	}
	if recurDetails != nil && recurDetails.Behavior == "" {
		recurDetails.Behavior = "ROLLING"
	}

	// Flex tasks have their own template creation path
	if recurDetails != nil && recurDetails.Flex != nil {
		return s.createFlexTemplateForTask(
			userID, categoryID, templateID,
			content, priority, value, public,
			recurDetails, notes, checklist,
		)
	}

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
	} else if startDate != nil {
		baseTime = *startDate
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
		Notes:         notes,
		Checklist:     checklist,

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
		nextOccurrence, err = s.ComputeNextWindow(&template_doc)
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

// ScheduleNextRecurrence updates a template's nextGenerated so the cron job
// will create the next task instance at the appropriate time, rather than
// creating it immediately on completion.
func (s *Service) ScheduleNextRecurrence(templateId primitive.ObjectID) error {
	ctx := context.Background()

	var templateDoc TemplateTaskDocument
	if err := s.TemplateTasks.FindOne(ctx, bson.M{"_id": templateId}).Decode(&templateDoc); err != nil {
		return err
	}

	if templateDoc.NextGenerated == nil {
		return fmt.Errorf("template NextGenerated is nil for template %s", templateId.Hex())
	}

	templateDoc.LastGenerated = templateDoc.NextGenerated
	thisGeneration := *templateDoc.LastGenerated
	var nextGeneration time.Time
	var err error

	now := xutils.NowUTC()
	catchUpLimit := 100
	iterations := 0

	for {
		iterations++
		if iterations > catchUpLimit {
			slog.Warn("Catch-up limit reached in ScheduleNextRecurrence", "templateID", templateId)
			break
		}

		switch templateDoc.RecurType {
		case "OCCURRENCE":
			nextGeneration, err = s.ComputeNextOccurrence(&templateDoc)
		case "DEADLINE":
			nextGeneration, err = s.ComputeNextDeadline(&templateDoc)
		case "WINDOW":
			nextGeneration, err = s.ComputeNextWindow(&templateDoc)
		default:
			return fmt.Errorf("unknown recur type: %s", templateDoc.RecurType)
		}
		if err != nil {
			return err
		}

		if nextGeneration.Before(now) {
			templateDoc.LastGenerated = &nextGeneration
			continue
		}
		break
	}

	slog.Info("Scheduling next recurrence",
		"templateID", templateId.Hex(),
		"lastGenerated", thisGeneration.Format(time.RFC3339),
		"nextGenerated", nextGeneration.Format(time.RFC3339))

	_, err = s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": templateId}, bson.M{
		"$set": bson.M{
			"lastGenerated": &thisGeneration,
			"nextGenerated": &nextGeneration,
		},
	})
	return err
}

// GetDueRecurringTasks returns all recurring tasks that are due for generation.
// It checks for templates where nextGenerated <= now - 30 minutes, giving users
// a 30-minute grace period to mark the task as complete before it's treated as missed.
func (s *Service) GetDueRecurringTasks() ([]TemplateTaskDocument, error) {
	ctx := context.Background()
	now := xutils.NowUTC()
	gracePeriod := now.Add(-30 * time.Minute)

	matchConditions := bson.M{"nextGenerated": bson.M{"$lte": gracePeriod}}

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

func (s *Service) GetTemplateByID(id primitive.ObjectID) (*TemplateTaskDocument, error) {
	ctx := context.Background()

	var template TemplateTaskDocument
	err := s.TemplateTasks.FindOne(ctx, bson.M{"_id": id}).Decode(&template)
	return &template, err
}

// ResetTemplateMetrics zeroes out streak, timesCompleted, timesMissed, and completionDates.
func (s *Service) ResetTemplateMetrics(id primitive.ObjectID) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}
	update := bson.M{"$set": bson.M{
		"streak":          0,
		"highestStreak":   0,
		"timesCompleted":  0,
		"timesMissed":     0,
		"timesGenerated":  0,
		"completionDates": []time.Time{},
		"lastEdited":      xutils.NowUTC(),
	}}

	result, err := s.TemplateTasks.UpdateOne(ctx, filter, update)
	if err != nil {
		return handleMongoError(ctx, "reset template metrics", err)
	}
	if result.MatchedCount == 0 {
		return fmt.Errorf("template task not found")
	}
	return nil
}

type UndoMissedResult struct {
	Streak        int
	HighestStreak int
}

func (s *Service) UndoMissedTask(templateID primitive.ObjectID) (*UndoMissedResult, error) {
	ctx := context.Background()

	var template TemplateTaskDocument
	err := s.TemplateTasks.FindOne(ctx, bson.M{"_id": templateID}).Decode(&template)
	if err != nil {
		return nil, fmt.Errorf("template task not found")
	}

	if template.LastMissedAt == nil {
		return nil, fmt.Errorf("no recent miss to undo")
	}

	if time.Since(*template.LastMissedAt) > 24*time.Hour {
		return nil, fmt.Errorf("undo window has expired (must be within 24 hours of the miss)")
	}

	restoredStreak := template.PreviousStreak + 1
	highestStreak := template.HighestStreak
	if restoredStreak > highestStreak {
		highestStreak = restoredStreak
	}

	now := xutils.NowUTC()
	update := bson.M{
		"$set": bson.M{
			"streak":         restoredStreak,
			"highestStreak":  highestStreak,
			"previousStreak": 0,
			"lastMissedAt":   nil,
			"lastEdited":     now,
		},
		"$inc": bson.M{
			"timesMissed":    -1,
			"timesCompleted": 1,
		},
		"$push": bson.M{
			"completionDates": now,
		},
	}

	result, err := s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": templateID}, update)
	if err != nil {
		return nil, handleMongoError(ctx, "undo missed task", err)
	}
	if result.MatchedCount == 0 {
		return nil, fmt.Errorf("template task not found")
	}

	return &UndoMissedResult{
		Streak:        restoredStreak,
		HighestStreak: highestStreak,
	}, nil
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
