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
			// Only process reminders that are due and not sent
			if !reminder.Sent && reminder.TriggerTime.Before(xutils.NowUTC()) {
				err = h.service.SendReminder(task.UserID, reminder, &task)
				if err != nil {
					slog.Error("Failed to send reminder", "error", err, "taskId", task.ID.Hex(), "userId", task.UserID.Hex())
					failed_updates = append(failed_updates, TaskID{
						TaskID:     task.ID,
						CategoryID: task.CategoryID,
						UserID:     task.UserID,
					})
					continue
				}
				// Mark this specific reminder as successful
				successful_updates = append(successful_updates, TaskID{
					TaskID:     task.ID,
					CategoryID: task.CategoryID,
					UserID:     task.UserID,
				})
			}
		}
	}

	for _, update := range successful_updates {
		err = h.service.UpdateReminderSent(update.TaskID, update.CategoryID, update.UserID)
		if err != nil {
			slog.Error("Failed to update reminder sent status", "error", err, "taskId", update.TaskID.Hex())
			failed_updates = append(failed_updates, update)
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

	// send the reminder to the user
	return xutils.SendNotification(xutils.Notification{
		Token:   user.PushToken,
		Message: message,
		Data: map[string]string{
			"taskId": task.ID.Hex(),
		},
	})
}

// generateReminderMessage creates a descriptive reminder message based on timing and task details
func (s *Service) generateReminderMessage(reminder *Reminder, task *TaskDocument) string {
	now := time.Now()
	taskName := task.Content
	hasWindow := task.Deadline != nil && (task.StartDate != nil || task.StartTime != nil)

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
