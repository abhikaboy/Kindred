package task

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const FollowUpReminderType = "FOLLOW_UP"
const FollowUpDelay = 3 * time.Hour

func (h *Handler) HandleReminder() (fiber.Map, error) {
	tasks, err := h.service.GetTasksWithPastReminders()
	if err != nil {
		return fiber.Map{
			"error": err.Error(),
		}, err
	}
	// Send the reminders to the user
	successful_updates := make([]TaskID, 0)
	failed_updates := make([]TaskID, 0)
	for _, task := range tasks {
		// Process ALL past due reminders for this task, not just the first one
		for _, reminder := range task.Reminders {
			if reminder.Sent || !reminder.TriggerTime.Before(xutils.NowUTC()) {
				continue
			}
			// Atomically claim before sending so overlapping cron runs / instances
			// can't double-send the same reminder. Only the winner sends.
			won, err := h.service.ClaimReminder(task.ID, task.CategoryID, reminder.TriggerTime)
			if err != nil {
				slog.Error("Failed to claim reminder", "error", err, "taskId", task.ID.Hex())
				continue
			}
			if !won {
				continue
			}
			id := TaskID{TaskID: task.ID, CategoryID: task.CategoryID, UserID: task.UserID}
			if err := h.service.SendReminder(task.UserID, reminder, &task); err != nil {
				slog.Error("Failed to send reminder", "error", err, "taskId", task.ID.Hex(), "userId", task.UserID.Hex())
				failed_updates = append(failed_updates, id)
				continue
			}
			successful_updates = append(successful_updates, id)
		}
	}

	return fiber.Map{
		"tasks":              tasks,
		"successful_updates": successful_updates,
		"failed_updates":     failed_updates,
	}, nil
}

func (h *Handler) AddReminderToTask(c *fiber.Ctx) error {
	userIDVal := c.UserContext().Value("user_id")
	userIDStr, ok := userIDVal.(string)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user_id in context",
		})
	}

	err, ids := xutils.ParseIDs(c, c.Params("id"), c.Params("category"), userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":         "Invalid taskID or categoryID or userID",
			"error_message": err.Error(),
		})
	}
	taskID, categoryID, userID := ids[0], ids[1], ids[2]

	reminder := types.Reminder{}
	// using body parser
	if err := c.BodyParser(&reminder); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":         "Invalid reminder",
			"error_message": err.Error(),
		})
	}

	err = h.service.AddReminderToTask(taskID, categoryID, userID, reminder)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.SendStatus(fiber.StatusOK)
}

func ParseReminder(params CreateTaskParams) []*Reminder {
	reminders := make([]*Reminder, 0)
	for _, reminder := range params.Reminders {
		// If the reminder is absolute, then the trigger time is a time
		if reminder.Type == "ABSOLUTE" {
			reminders = append(reminders, &Reminder{
				TriggerTime:    reminder.TriggerTime,
				Sent:           false,
				Type:           reminder.Type,
				AfterStart:     reminder.AfterStart,
				BeforeDeadline: reminder.BeforeDeadline,
				AfterDeadline:  reminder.AfterDeadline,
			})
		}
		// If the reminder is relative, then the trigger time is a duration from the start date or deadline
		if reminder.Type == "RELATIVE" {
			if reminder.AfterStart {
				reminder.TriggerTime = params.StartDate.Add(params.StartTime.Sub(reminder.TriggerTime))
			}
			if reminder.BeforeDeadline {
				reminder.TriggerTime = params.Deadline.Add(params.Deadline.Sub(reminder.TriggerTime))
			}
			if reminder.AfterDeadline {
				if params.Deadline != nil {
					reminder.TriggerTime = (*params.Deadline).Add(reminder.TriggerTime.Sub(*params.Deadline))
				}
			}
			reminders = append(reminders, &Reminder{
				TriggerTime:    reminder.TriggerTime,
				Sent:           false,
				Type:           reminder.Type,
				AfterStart:     reminder.AfterStart,
				BeforeDeadline: reminder.BeforeDeadline,
				AfterDeadline:  reminder.AfterDeadline,
			})
		}
	}
	return reminders
}

// BuildFollowUpReminder creates a FOLLOW_UP reminder for a task based on its timing.
// Returns nil if the task doesn't qualify (no deadline, no startTime, or trigger time already stale).
func BuildFollowUpReminder(deadline *time.Time, startTime *time.Time) *Reminder {
	var triggerTime time.Time

	if deadline != nil {
		triggerTime = deadline.Add(FollowUpDelay)
	} else if startTime != nil {
		triggerTime = startTime.Add(FollowUpDelay)
	} else {
		return nil
	}

	// Don't create follow-up if trigger time is already in the past
	if triggerTime.Before(xutils.NowUTC()) {
		return nil
	}

	return &Reminder{
		TriggerTime: triggerTime,
		Type:        FollowUpReminderType,
		Sent:        false,
	}
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
	user, err := s.Users.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}

	if user.PushToken == "" {
		slog.Warn("User has no push token, skipping reminder", "user_id", userID)
		return nil
	}

	// Generate descriptive reminder message
	message := s.generateReminderMessage(reminder, task)

	title := ""
	if reminder.Type == FollowUpReminderType {
		title = fmt.Sprintf("How was %s?", task.Content)
	}

	// send the reminder to the user
	return xutils.SendNotification(xutils.Notification{
		Token:   user.PushToken,
		Message: message,
		Title:   title,
		Data: map[string]string{
			"taskId": task.ID.Hex(),
			"type":   reminder.Type,
		},
	})
}

// generateReminderMessage creates a descriptive reminder message based on timing and task details
func (s *Service) generateReminderMessage(reminder *Reminder, task *TaskDocument) string {
	now := time.Now()
	taskName := task.Content
	hasWindow := task.Deadline != nil && (task.StartDate != nil || task.StartTime != nil)

	// Follow-up reminders use specific copy
	if reminder.Type == FollowUpReminderType {
		return "How'd it go? Tap to mark it done!"
	}

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
			if hasWindow {
				baseMessage = formatTimeMessage("ending in", timeDiff, taskName)
			} else {
				baseMessage = formatTimeMessage("due in", timeDiff, taskName)
			}
		} else {
			if hasWindow {
				baseMessage = "Ending now: " + taskName
			} else {
				baseMessage = "Due now: " + taskName
			}
		}
	} else if reminder.AfterDeadline && task.Deadline != nil {
		timeDiff = now.Sub(*task.Deadline)
		if timeDiff > 0 {
			if hasWindow {
				baseMessage = formatOverdueMessage("ended", timeDiff, taskName)
			} else {
				baseMessage = formatOverdueMessage("was due", timeDiff, taskName)
			}
		} else {
			if hasWindow {
				baseMessage = "Ended: " + taskName
			} else {
				baseMessage = "Due: " + taskName
			}
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
	if action == "starts in" {
		return fmt.Sprintf("%s starts in %s", taskName, timeStr)
	}
	return fmt.Sprintf("Task %s %s: %s", action, timeStr, taskName)
}

// formatOverdueMessage formats past time messages like "started 5 minutes ago"
func formatOverdueMessage(pastAction string, duration time.Duration, taskName string) string {
	timeStr := formatDuration(duration)
	if pastAction == "was due" {
		return fmt.Sprintf("Overdue: %s (%s %s ago)", taskName, pastAction, timeStr)
	}
	if pastAction == "ended" {
		return fmt.Sprintf("Ended: %s (%s ago)", taskName, timeStr)
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

// ClaimReminder atomically marks a single due reminder as sent and returns true
// only for the caller that won the claim. This is the dedup point: concurrent
// cron runs / instances racing the same reminder serialize on this update, so
// exactly one gets ModifiedCount == 1 and sends. Matched by triggerTime since
// reminders have no _id.
// ponytail: two reminders on one task at the same millisecond would both flip
// to sent in one $set, dropping the duplicate — accept it, give reminders an _id
// if that ever matters.
func (s *Service) ClaimReminder(taskID, categoryID primitive.ObjectID, triggerTime time.Time) (bool, error) {
	ctx := context.Background()
	opts := options.Update().SetArrayFilters(options.ArrayFilters{
		Filters: bson.A{
			bson.M{"t._id": taskID},
			bson.M{"r.triggerTime": triggerTime, "r.sent": false},
		},
	})
	res, err := s.Tasks.UpdateOne(ctx,
		bson.M{"_id": categoryID},
		bson.M{"$set": bson.M{"tasks.$[t].reminders.$[r].sent": true}},
		opts)
	if err != nil {
		return false, err
	}
	return res.ModifiedCount == 1, nil
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
