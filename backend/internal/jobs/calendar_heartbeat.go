package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/calendar"
	ph "github.com/abhikaboy/Kindred/internal/posthog"
	"github.com/getsentry/sentry-go"
	"github.com/robfig/cron/v3"
	"go.mongodb.org/mongo-driver/mongo"
)

// CalendarHeartbeatJob periodically checks that all calendar connections
// are still functional — tokens refresh, API calls succeed, and sync is possible.
type CalendarHeartbeatJob struct {
	connections *mongo.Collection
	config      config.Config
	service     *calendar.Service
}

// NewCalendarHeartbeatJob creates a new heartbeat job
func NewCalendarHeartbeatJob(connections *mongo.Collection, categories *mongo.Collection, cfg config.Config) *CalendarHeartbeatJob {
	service := calendar.NewService(connections, categories, cfg)
	return &CalendarHeartbeatJob{
		connections: connections,
		config:      cfg,
		service:     service,
	}
}

// StartCron registers the heartbeat on the given cron scheduler.
// Runs every 1 hour.
func (j *CalendarHeartbeatJob) StartCron(c *cron.Cron) {
	_, err := c.AddFunc("@every 1h", func() {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				slog.Error("Panic recovered in calendar heartbeat", "panic", r, "stack", stack)
				sentry.CurrentHub().Recover(r)
				sentry.Flush(2e9)
			}
		}()

		ctx := context.Background()
		if err := j.Run(ctx); err != nil {
			slog.Error("Calendar heartbeat job failed", "error", err)
			sentry.CaptureException(fmt.Errorf("calendar heartbeat job failed: %w", err))
		}
	})
	if err != nil {
		slog.Error("Error adding calendar heartbeat cron job", "error", err)
	} else {
		slog.Info("Calendar heartbeat cron registered (every 1h)")
	}

	// Run once on startup (with a short delay to let things initialize)
	go func() {
		time.Sleep(10 * time.Second)
		ctx := context.Background()
		if err := j.Run(ctx); err != nil {
			slog.Error("Initial calendar heartbeat failed", "error", err)
			sentry.CaptureException(fmt.Errorf("initial calendar heartbeat failed: %w", err))
		}
	}()
}

// Run executes the heartbeat: checks every connection and persists health status.
func (j *CalendarHeartbeatJob) Run(ctx context.Context) error {
	start := time.Now()
	slog.Info("Calendar heartbeat starting")

	connections, err := j.service.GetAllConnections(ctx)
	if err != nil {
		sentry.CaptureException(fmt.Errorf("calendar heartbeat: failed to list connections: %w", err))
		return fmt.Errorf("failed to list connections: %w", err)
	}

	if len(connections) == 0 {
		slog.Info("Calendar heartbeat: no connections to check")
		return nil
	}

	slog.Info("Calendar heartbeat: checking connections", "total", len(connections))

	var healthy, degraded, broken int

	for i := range connections {
		conn := &connections[i]
		result := j.service.CheckConnectionHealth(ctx, conn)

		// Persist the result
		if err := j.service.UpdateConnectionHealth(ctx, result.ConnectionID, result.Status, result.Message); err != nil {
			slog.Error("Heartbeat: failed to persist health status",
				"connection_id", result.ConnectionID,
				"error", err)
		}

		switch result.Status {
		case calendar.HealthStatusHealthy:
			healthy++
		case calendar.HealthStatusDegraded:
			degraded++
			sentry.WithScope(func(scope *sentry.Scope) {
				scope.SetTag("connection_id", result.ConnectionID.Hex())
				scope.SetTag("account", result.Account)
				scope.SetLevel(sentry.LevelWarning)
				sentry.CaptureMessage(fmt.Sprintf("calendar connection degraded: %s — %s", result.Account, result.Message))
			})
			// Track in PostHog so we can see per-user connection health over time
			if client := ph.GetClient(); client != nil {
				_ = client.Track(ctx, ph.Event{
					UserID:    result.UserID.Hex(),
					EventName: "calendar_connection_degraded",
					Category:  "calendar",
					Properties: map[string]interface{}{
						"connection_id": result.ConnectionID.Hex(),
						"account":       result.Account,
						"message":       result.Message,
						"duration_ms":   result.Duration.Milliseconds(),
					},
				})
			}
		case calendar.HealthStatusBroken:
			broken++
			sentry.WithScope(func(scope *sentry.Scope) {
				scope.SetTag("connection_id", result.ConnectionID.Hex())
				scope.SetTag("account", result.Account)
				scope.SetLevel(sentry.LevelError)
				sentry.CaptureMessage(fmt.Sprintf("calendar connection broken: %s — %s", result.Account, result.Message))
			})
			if client := ph.GetClient(); client != nil {
				_ = client.Track(ctx, ph.Event{
					UserID:    result.UserID.Hex(),
					EventName: "calendar_connection_broken",
					Category:  "calendar",
					Properties: map[string]interface{}{
						"connection_id": result.ConnectionID.Hex(),
						"account":       result.Account,
						"message":       result.Message,
						"duration_ms":   result.Duration.Milliseconds(),
					},
				})
			}
		}
	}

	duration := time.Since(start)
	slog.Info("Calendar heartbeat completed",
		"total", len(connections),
		"healthy", healthy,
		"degraded", degraded,
		"broken", broken,
		"duration_ms", duration.Milliseconds())

	// Alert if any connections are in bad shape
	if broken > 0 {
		sentry.CaptureException(fmt.Errorf("calendar heartbeat: %d/%d connection(s) broken", broken, len(connections)))
	}

	return nil
}
