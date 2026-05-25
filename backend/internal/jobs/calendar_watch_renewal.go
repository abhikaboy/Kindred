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
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// CalendarWatchRenewalJob handles proactive renewal of Google Calendar watch channels
type CalendarWatchRenewalJob struct {
	connections *mongo.Collection
	config      config.Config
	service     *calendar.Service
}

// NewCalendarWatchRenewalJob creates a new calendar watch renewal job
func NewCalendarWatchRenewalJob(connections *mongo.Collection, categories *mongo.Collection, cfg config.Config) *CalendarWatchRenewalJob {
	service := calendar.NewService(connections, categories, cfg)
	return &CalendarWatchRenewalJob{
		connections: connections,
		config:      cfg,
		service:     service,
	}
}

// StartCron registers the renewal job on the given cron scheduler.
// It runs every 6 hours: renewing expiring channels and checking health.
func (j *CalendarWatchRenewalJob) StartCron(c *cron.Cron) {
	_, err := c.AddFunc("@every 6h", func() {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				slog.Error("Panic recovered in calendar watch renewal", "panic", r, "stack", stack)
				sentry.CurrentHub().Recover(r)
				sentry.Flush(2e9)
			}
		}()

		ctx := context.Background()
		if err := j.Run(ctx); err != nil {
			slog.Error("Calendar watch renewal job failed", "error", err)
			sentry.CaptureException(fmt.Errorf("calendar watch renewal job failed: %w", err))
		}
	})
	if err != nil {
		slog.Error("Error adding calendar watch renewal cron job", "error", err)
	} else {
		slog.Info("Calendar watch renewal cron registered (every 6h)")
	}

	// Run once immediately on startup
	go func() {
		ctx := context.Background()
		if err := j.Run(ctx); err != nil {
			slog.Error("Initial calendar watch renewal failed", "error", err)
			sentry.CaptureException(fmt.Errorf("initial calendar watch renewal failed: %w", err))
		}
	}()
}

// Run executes the watch channel renewal job:
// 1. Renews channels expiring within 3 days
// 2. Reports already-expired channels to Sentry
// 3. Detects connections with missing watch channels
func (j *CalendarWatchRenewalJob) Run(ctx context.Context) error {
	start := time.Now()
	expirationThreshold := time.Now().Add(3 * 24 * time.Hour)

	cursor, err := j.connections.Find(ctx, bson.M{
		"watch_channels": bson.M{"$exists": true, "$ne": bson.A{}},
	})
	if err != nil {
		sentry.CaptureException(fmt.Errorf("calendar watch renewal: failed to query connections: %w", err))
		return fmt.Errorf("failed to find connections with watch channels: %w", err)
	}
	defer cursor.Close(ctx)

	connectionsChecked := 0
	channelsRenewed := 0
	channelsFailed := 0
	channelsExpired := 0

	for cursor.Next(ctx) {
		var connection calendar.CalendarConnection
		if err := cursor.Decode(&connection); err != nil {
			slog.Error("Failed to decode calendar connection", "error", err)
			continue
		}

		connectionsChecked++

		for _, watch := range connection.WatchChannels {
			// Flag already-expired channels
			if watch.Expiration.Before(time.Now()) {
				channelsExpired++
				slog.Warn("Watch channel already expired",
					"connection_id", connection.ID,
					"calendar_id", watch.CalendarID,
					"expired_at", watch.Expiration)
				sentry.CaptureException(fmt.Errorf(
					"calendar watch expired: connection=%s calendar=%s expired_at=%s",
					connection.ID.Hex(), watch.CalendarID, watch.Expiration.Format(time.RFC3339)))
			}

			// Renew if expiring within threshold (includes already-expired)
			if watch.Expiration.Before(expirationThreshold) {
				slog.Info("Renewing watch channel",
					"connection_id", connection.ID,
					"calendar_id", watch.CalendarID,
					"expiration", watch.Expiration)

				err := j.service.RenewWatchChannel(ctx, &connection, watch, j.config.GoogleCalendar.WebhookBaseURL)
				if err != nil {
					slog.Error("Failed to renew watch channel",
						"connection_id", connection.ID,
						"calendar_id", watch.CalendarID,
						"error", err)
					sentry.CaptureException(fmt.Errorf(
						"calendar watch renewal failed: connection=%s calendar=%s: %w",
						connection.ID.Hex(), watch.CalendarID, err))
					channelsFailed++
					continue
				}

				channelsRenewed++
			}
		}
	}

	if err := cursor.Err(); err != nil {
		sentry.CaptureException(fmt.Errorf("calendar watch renewal cursor error: %w", err))
		return fmt.Errorf("cursor error during watch renewal: %w", err)
	}

	slog.Info("Calendar watch renewal completed",
		"connections_checked", connectionsChecked,
		"channels_renewed", channelsRenewed,
		"channels_failed", channelsFailed,
		"channels_expired", channelsExpired,
		"duration_ms", time.Since(start).Milliseconds())

	// Health check: detect connections with missing watch channels
	j.checkMissingWatchChannels(ctx)

	return nil
}

// checkMissingWatchChannels finds calendar connections that have no watch channels
// and reports them as warnings. These connections won't receive real-time updates.
func (j *CalendarWatchRenewalJob) checkMissingWatchChannels(ctx context.Context) {
	cursor, err := j.connections.Find(ctx, bson.M{
		"$or": bson.A{
			bson.M{"watch_channels": bson.M{"$exists": false}},
			bson.M{"watch_channels": bson.M{"$size": 0}},
			bson.M{"watch_channels": nil},
		},
	})
	if err != nil {
		slog.Error("Failed to query connections missing watch channels", "error", err)
		return
	}
	defer cursor.Close(ctx)

	missing := 0
	for cursor.Next(ctx) {
		var conn calendar.CalendarConnection
		if err := cursor.Decode(&conn); err != nil {
			continue
		}
		missing++
		slog.Warn("Calendar connection has no watch channels",
			"connection_id", conn.ID,
			"user_id", conn.UserID,
			"provider", conn.Provider,
			"created_at", conn.CreatedAt)
	}

	if missing > 0 {
		sentry.CaptureException(fmt.Errorf("calendar health: %d connection(s) have no watch channels", missing))
	}
}
