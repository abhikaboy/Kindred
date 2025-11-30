package task

import (
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
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
	err, ids := xutils.ParseIDs(c, c.Params("id"), c.Params("category"), c.UserContext().Value("user_id").(string))
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
