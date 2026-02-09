package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/calendar"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// CalendarWatchRenewalJob handles proactive renewal of Google Calendar watch channels
type CalendarWatchRenewalJob struct {
	connections *mongo.Collection
	categories  *mongo.Collection
	config      config.Config
	service     *calendar.Service
}

// NewCalendarWatchRenewalJob creates a new calendar watch renewal job
func NewCalendarWatchRenewalJob(connections *mongo.Collection, categories *mongo.Collection, cfg config.Config) *CalendarWatchRenewalJob {
	service := calendar.NewService(connections, categories, cfg)
	return &CalendarWatchRenewalJob{
		connections: connections,
		categories:  categories,
		config:      cfg,
		service:     service,
	}
}

// Run executes the watch channel renewal job
// This should be called daily via a cron job or scheduler
func (j *CalendarWatchRenewalJob) Run(ctx context.Context) error {
	slog.Info("Starting calendar watch renewal job")

	// Find all connections with watch channels expiring in the next 3 days
	expirationThreshold := time.Now().Add(3 * 24 * time.Hour)

	cursor, err := j.connections.Find(ctx, bson.M{
		"watch_channels": bson.M{"$exists": true, "$ne": []interface{}{}},
	})
	if err != nil {
		slog.Error("Failed to find connections with watch channels", "error", err)
		return err
	}
	defer cursor.Close(ctx)

	connectionsChecked := 0
	channelsRenewed := 0
	channelsFailed := 0

	for cursor.Next(ctx) {
		var connection calendar.CalendarConnection
		if err := cursor.Decode(&connection); err != nil {
			slog.Error("Failed to decode connection", "error", err)
			continue
		}

		connectionsChecked++

		// Check each watch channel
		for _, watch := range connection.WatchChannels {
			// Check if channel is expiring soon
			if watch.Expiration.Before(expirationThreshold) {
				slog.Info("Watch channel expiring soon, renewing",
					"connection_id", connection.ID,
					"channel_id", watch.ChannelID,
					"calendar_id", watch.CalendarID,
					"expiration", watch.Expiration)

				// Renew the watch channel
				err := j.service.RenewWatchChannel(ctx, &connection, watch, j.config.GoogleCalendar.WebhookBaseURL)
				if err != nil {
					slog.Error("Failed to renew watch channel",
						"connection_id", connection.ID,
						"channel_id", watch.ChannelID,
						"calendar_id", watch.CalendarID,
						"error", err)
					channelsFailed++
					continue
				}

				channelsRenewed++
				slog.Info("Watch channel renewed successfully",
					"connection_id", connection.ID,
					"channel_id", watch.ChannelID,
					"calendar_id", watch.CalendarID)
			}
		}
	}

	if err := cursor.Err(); err != nil {
		slog.Error("Cursor error during watch renewal", "error", err)
		return err
	}

	slog.Info("Calendar watch renewal job completed",
		"connections_checked", connectionsChecked,
		"channels_renewed", channelsRenewed,
		"channels_failed", channelsFailed)

	return nil
}

// StartScheduler starts a background scheduler that runs the renewal job daily
func (j *CalendarWatchRenewalJob) StartScheduler(ctx context.Context) {
	slog.Info("Starting calendar watch renewal scheduler")

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	// Run immediately on startup
	if err := j.Run(ctx); err != nil {
		slog.Error("Failed to run initial watch renewal", "error", err)
	}

	for {
		select {
		case <-ctx.Done():
			slog.Info("Calendar watch renewal scheduler stopped")
			return
		case <-ticker.C:
			if err := j.Run(ctx); err != nil {
				slog.Error("Failed to run scheduled watch renewal", "error", err)
			}
		}
	}
}
