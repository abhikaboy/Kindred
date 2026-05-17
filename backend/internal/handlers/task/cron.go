package task

import (
	"fmt"
	"log/slog"
	"runtime/debug"

	"github.com/getsentry/sentry-go"
	"github.com/robfig/cron/v3"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Cron sets up periodic background jobs for tasks, reminders, and checkins.
*/
func Cron(collections map[string]*mongo.Collection) *cron.Cron {
	service := newService(collections, nil)
	handler := Handler{
		service:       service,
		geminiService: nil,
	}

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

		/* Recurring Tasks */

		tasks := make([]TemplateTaskDocument, 0)
		recurringTasks, err := service.GetDueRecurringTasks()
		if err != nil {
			slog.Error("Error getting due recurring tasks", "error", err)
			sentry.CaptureException(fmt.Errorf("cron: failed to get due recurring tasks: %w", err))
		}
		tasks = append(tasks, recurringTasks...)

		for _, task := range tasks {
			_, err := service.CreateTaskFromTemplate(task.ID)
			if err != nil {
				slog.Error("Error creating task from template", "error", err, "templateID", task.ID.Hex())
				sentry.CaptureException(fmt.Errorf("cron: failed to create task from template %s: %w", task.ID.Hex(), err))
			}
		}

		/* Reminders */

		reminder_result, err := handler.HandleReminder()
		if err != nil {
			slog.Error("Error handling reminder", "error", err)
			sentry.CaptureException(fmt.Errorf("cron: reminder handling failed: %w", err))
		}

		if failedUpdates, ok := reminder_result["failed_updates"].([]TaskID); ok && len(failedUpdates) > 0 {
			slog.Warn("Reminder cycle completed with failures", "failed_count", len(failedUpdates))
		}

		/* Checkins */

		checkin_result, err := handler.HandleCheckin()
		if err != nil {
			slog.Error("Error handling checkin", "error", err)
			sentry.CaptureException(fmt.Errorf("cron: checkin handling failed: %w", err))
		}

		// Only log checkin results when notifications were actually sent
		if notifCount, ok := checkin_result["notifications_sent"].(int); ok && notifCount > 0 {
			slog.Info("Checkin notifications sent",
				"notifications_sent", notifCount,
				"matched_users", checkin_result["matched_users"],
				"total_users", checkin_result["total_users"])
		}

		/* Live Activity Notifications */

		startTimeResult, err := handler.HandleStartTimeNotifications()
		if err != nil {
			slog.Error("Error handling start-time live activity notifications", "error", err)
			sentry.CaptureException(fmt.Errorf("cron: start-time live activity handling failed: %w", err))
		}
		if notifCount, ok := startTimeResult["notifications_sent"].(int); ok && notifCount > 0 {
			slog.Info("Start-time live activity notifications sent", "count", notifCount)
		}

		deadlineResult, err := handler.HandleDeadlineApproachingNotifications()
		if err != nil {
			slog.Error("Error handling deadline live activity notifications", "error", err)
			sentry.CaptureException(fmt.Errorf("cron: deadline live activity handling failed: %w", err))
		}
		if notifCount, ok := deadlineResult["notifications_sent"].(int); ok && notifCount > 0 {
			slog.Info("Deadline live activity notifications sent", "count", notifCount)
		}
	})
	if err != nil {
		slog.Error("Error adding cron job", "error", err)
	}

	c.Start()
	slog.Info("Cron scheduler started", "id", id)
	return c
}
