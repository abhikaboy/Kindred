package task

import (
	"fmt"
	"log/slog"
	"runtime/debug"

	"github.com/getsentry/sentry-go"
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
		geminiService: nil,
	}

	/* Recurring Tasks */

	c := cron.New()
	id, err := c.AddFunc("@every 1m", func() {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				slog.Error("Panic recovered in cron job", "panic", r, "stack", stack)
				sentry.CurrentHub().Recover(r)
				sentry.Flush(2e9)
			}
		}()

		tasks := make([]TemplateTaskDocument, 0)
		recurringTasks, err := service.GetDueRecurringTasks()
		if err != nil {
			slog.Error("Error getting due recurring tasks", "error", err)
			sentry.CaptureException(fmt.Errorf("cron: failed to get due recurring tasks: %w", err))
		}
		tasks = append(tasks, recurringTasks...)

		for _, task := range tasks {
			newTask, err := service.CreateTaskFromTemplate(task.ID)
			if err != nil {
				slog.Error("Error creating task from template", "error", err, "templateID", task.ID.Hex())
				sentry.CaptureException(fmt.Errorf("cron: failed to create task from template %s: %w", task.ID.Hex(), err))
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
			sentry.CaptureException(fmt.Errorf("cron: reminder handling failed: %w", err))
		}

		if failedUpdates, ok := reminder_result["failed_updates"].([]TaskID); ok && len(failedUpdates) > 0 {
			slog.Warn("Reminder cycle completed with failures", "failed_count", len(failedUpdates))
		}

		/* Checkins */

		checkin_result, err := handler.HandleCheckin()
		if err != nil {
			slog.Error("Error handling checkin", "error", fiber.Map{
				"error": err.Error(),
			})
			sentry.CaptureException(fmt.Errorf("cron: checkin handling failed: %w", err))
		}
		fmt.Println(checkin_result)

	})
	if err != nil {
		slog.Error("Error adding cron job", "error", err)
	}

	c.Start()
	slog.Info("Cron scheduler started", "id", id)
}
