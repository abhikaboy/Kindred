package calendar

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/getsentry/sentry-go"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type WebhookInput struct {
	ConnectionID string `path:"connection_id" validate:"required"`

	// Google sends these as headers
	ChannelID     string `header:"X-Goog-Channel-ID" validate:"required"`
	ResourceID    string `header:"X-Goog-Resource-ID" validate:"required"`
	ResourceState string `header:"X-Goog-Resource-State" validate:"required"`
	ResourceURI   string `header:"X-Goog-Resource-URI"`
	MessageNumber string `header:"X-Goog-Message-Number"`
	ChannelToken  string `header:"X-Goog-Channel-Token"`
}

type WebhookOutput struct {
	Body struct {
		Success bool `json:"success"`
	}
}

func (h *Handler) HandleWebhook(ctx context.Context, input *WebhookInput) (*WebhookOutput, error) {
	slog.Info("Received webhook notification",
		"connection_id", input.ConnectionID,
		"channel_id", input.ChannelID,
		"resource_id", input.ResourceID,
		"resource_state", input.ResourceState,
		"message_number", input.MessageNumber)

	// Check rate limit for this connection
	if !h.webhookLimiter.Allow(input.ConnectionID) {
		slog.Warn("Webhook rate limit exceeded",
			"connection_id", input.ConnectionID,
			"channel_id", input.ChannelID)
		return nil, huma.Error429TooManyRequests("Rate limit exceeded. Please try again later.")
	}

	// Parse connection ID
	connectionID, err := primitive.ObjectIDFromHex(input.ConnectionID)
	if err != nil {
		slog.Error("Invalid connection ID in webhook", "connection_id", input.ConnectionID, "error", err)
		return nil, huma.Error400BadRequest("Invalid connection ID format", err)
	}

	// Look up connection by ID
	var connection CalendarConnection
	err = h.service.connections.FindOne(ctx, bson.M{"_id": connectionID}).Decode(&connection)
	if err == mongo.ErrNoDocuments {
		slog.Error("Connection not found for webhook", "connection_id", input.ConnectionID)
		return nil, huma.Error404NotFound("Calendar connection not found. Please reconnect your calendar.")
	} else if err != nil {
		slog.Error("Failed to find connection for webhook", "connection_id", input.ConnectionID, "error", err)
		sentry.CaptureException(fmt.Errorf("webhook: failed to find connection %s: %w", input.ConnectionID, err))
		return nil, huma.Error500InternalServerError("Failed to verify calendar connection", err)
	}

	// Validate channel ID and resource ID match one of the connection's watch channels
	validChannel := false
	for _, watch := range connection.WatchChannels {
		if watch.ChannelID == input.ChannelID && watch.ResourceID == input.ResourceID {
			validChannel = true
			break
		}
	}

	if !validChannel {
		slog.Error("Invalid channel or resource ID in webhook",
			"connection_id", input.ConnectionID,
			"channel_id", input.ChannelID,
			"resource_id", input.ResourceID)
		return nil, huma.Error403Forbidden("Invalid webhook channel. This notification is not authorized for this connection.")
	}

	// Handle different resource states
	switch input.ResourceState {
	case "sync":
		// Initial sync message when watch is created
		slog.Info("Received sync message for watch channel", "connection_id", input.ConnectionID, "channel_id", input.ChannelID)
		// Just acknowledge, no action needed

	case "exists":
		// Resource changed, trigger sync
		slog.Info("Resource changed, triggering sync", "connection_id", input.ConnectionID, "channel_id", input.ChannelID)

		// Trigger sync asynchronously (don't block webhook response)
		go func() {
			syncStart := time.Now()
			bgCtx := context.Background()

			// Define time range for sync (next week of events)
			now := time.Now()
			startTime := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			endTime := startTime.AddDate(0, 0, 7).Add(24*time.Hour - time.Second)

			slog.Info("Webhook-triggered sync starting",
				"connection_id", connection.ID,
				"account", connection.ProviderAccountID,
				"time_range_start", startTime,
				"time_range_end", endTime)

			result, err := h.service.SyncEventsToTasks(bgCtx, connection.ID, connection.UserID, startTime, endTime)
			if err != nil {
				slog.Error("Webhook-triggered sync failed",
					"connection_id", connection.ID,
					"account", connection.ProviderAccountID,
					"error", err,
					"duration_ms", time.Since(syncStart).Milliseconds())
				sentry.CaptureException(fmt.Errorf("webhook sync failed: connection=%s account=%s: %w", connection.ID.Hex(), connection.ProviderAccountID, err))
				return
			}

			slog.Info("Webhook-triggered sync completed",
				"connection_id", connection.ID,
				"account", connection.ProviderAccountID,
				"tasks_created", result.TasksCreated,
				"tasks_skipped", result.TasksSkipped,
				"tasks_deleted", result.TasksDeleted,
				"events_total", result.EventsTotal,
				"duration_ms", time.Since(syncStart).Milliseconds())
		}()

	case "not_exists":
		// Resource deleted
		slog.Info("Resource deleted", "connection_id", input.ConnectionID, "channel_id", input.ChannelID)
		// Just log, no action needed

	default:
		slog.Warn("Unknown resource state in webhook", "resource_state", input.ResourceState, "connection_id", input.ConnectionID)
	}

	// Return success immediately (don't block on sync)
	output := &WebhookOutput{}
	output.Body.Success = true
	return output, nil
}
