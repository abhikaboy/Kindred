package task

import (
	"github.com/gofiber/fiber/v2"
)

func (h *Handler) HandleReminder(c *fiber.Ctx) error {
	tasks, err := h.service.GetTasksWithPastReminders()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}
	// Send the reminders to the user
	for _, task := range tasks {
		err = h.service.SendReminder(task.UserID, task.Reminders[0], task.ID, task.Content)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
	}

	return c.JSON(tasks)
}

func ParseReminder(params CreateTaskParams) []*Reminder {
	reminders := make([]*Reminder, 0)
	for _, reminder := range params.Reminders {
		// If the reminder is absolute, then the trigger time is a time
		if reminder.Type == "ABSOLUTE" {
			reminders = append(reminders, &Reminder{
				TriggerTime: reminder.TriggerTime,
				Sent:        false,
				Type:        reminder.Type,
				AfterStart:  reminder.AfterStart,
				BeforeDeadline: reminder.BeforeDeadline,
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
			reminders = append(reminders, &Reminder{
				TriggerTime: reminder.TriggerTime,
				Sent:        false,
				Type:        reminder.Type,
				AfterStart:  reminder.AfterStart,
				BeforeDeadline: reminder.BeforeDeadline,
			})
		}
	}
	return reminders
}