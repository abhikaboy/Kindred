package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/calendar"
	"github.com/getsentry/sentry-go"
	"github.com/robfig/cron/v3"
	"go.mongodb.org/mongo-driver/mongo"
)

// CalendarPushWorker drains the calendar_push_outbox and pushes tasks to Google Calendar.
type CalendarPushWorker struct {
	service *calendar.Service
}

// NewCalendarPushWorker constructs the worker reusing the calendar service.
func NewCalendarPushWorker(connections, categories *mongo.Collection, cfg config.Config) *CalendarPushWorker {
	service := calendar.NewService(connections, categories, cfg)
	return &CalendarPushWorker{service: service}
}

// StartCron registers the drain on the given cron scheduler. Runs every 30 seconds.
// (The outbox table also stores next_attempt_at, so backed-off rows don't run early.)
func (w *CalendarPushWorker) StartCron(c *cron.Cron) {
	_, err := c.AddFunc("@every 30s", func() {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				slog.Error("Panic in calendar push worker", "panic", r, "stack", stack)
				sentry.CurrentHub().Recover(r)
				sentry.Flush(2 * time.Second)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		if err := w.Run(ctx); err != nil {
			slog.Error("Calendar push worker failed", "error", err)
			sentry.CaptureException(fmt.Errorf("calendar push worker failed: %w", err))
		}
	})
	if err != nil {
		slog.Error("Error registering calendar push worker cron", "error", err)
	} else {
		slog.Info("Calendar push worker registered (every 30s)")
	}
}

// Run drains up to 50 rows in one tick.
func (w *CalendarPushWorker) Run(ctx context.Context) error {
	outbox := w.service.PushOutbox()
	rows, err := outbox.ClaimBatch(ctx, 50)
	if err != nil {
		return fmt.Errorf("claim batch: %w", err)
	}
	if len(rows) == 0 {
		return nil
	}
	slog.Info("Calendar push worker draining", "count", len(rows))

	var processed, failed int
	for _, row := range rows {
		if err := w.service.ProcessPushRow(ctx, row); err != nil {
			slog.Error("Push row failed", "row_id", row.ID, "task_id", row.TaskID, "op", row.Op, "attempt", row.AttemptCount, "error", err)
			if markErr := outbox.MarkFailure(ctx, row.ID, row.AttemptCount, err.Error()); markErr != nil {
				slog.Error("Failed to mark push row failure", "row_id", row.ID, "error", markErr)
			}
			failed++
			continue
		}
		if err := outbox.MarkSuccess(ctx, row.ID); err != nil {
			slog.Error("Failed to delete successful push row", "row_id", row.ID, "error", err)
		}
		processed++
	}
	slog.Info("Calendar push worker tick complete", "processed", processed, "failed", failed)
	return nil
}
