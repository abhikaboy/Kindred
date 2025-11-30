package task

import (
	"fmt"
	"log/slog"

	"github.com/gofiber/fiber/v2"
	"github.com/robfig/cron/v3"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Cron(collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := Handler{
		service:       service,
		geminiService: nil, // Cron jobs don't need gemini service
	}

	/* Recurring Tasks */

	c := cron.New()
	id, err := c.AddFunc("@every 1m", func() {
		tasks := make([]TemplateTaskDocument, 0)
		recurringTasks, err := service.GetDueRecurringTasks()
		if err != nil {
			slog.Error("Error getting due recurring tasks", "error", err)
		}
		tasks = append(tasks, recurringTasks...)

		for _, task := range tasks {
			// TOOD: Optimize to take the template itself rather than the ID
			newTask, err := service.CreateTaskFromTemplate(task.ID)
			if err != nil {
				slog.Error("Error creating task from template", "error", err)
				if err.Error() == "mongo: no documents in result" {
					slog.Info("No template found, deleting task", "task", task.ID)
				}
			} else {
				fmt.Println(newTask)
			}
		}

		/* Reminders */

		reminder_result, err := handler.HandleReminder()
		if err != nil {
			slog.Error("Error handling reminder", "error", fiber.Map{
				"error": err.Error(),
			})
		}

		fmt.Println(reminder_result)

		/* Checkins */

		checkin_result, err := handler.HandleCheckin()
		if err != nil {
			slog.Error("Error handling checkin", "error", fiber.Map{
				"error": err.Error(),
			})
		}
		fmt.Println(checkin_result)

	})
	if err != nil {
		slog.Error("Error adding cron job", "error", err)
	}

	c.Start()
	slog.Info("Cron scheduler started", "id", id)
}
