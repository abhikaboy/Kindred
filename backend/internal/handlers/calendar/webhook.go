package calendar

import (
	"context"
	"fmt"
	"log/slog"
	"time"

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
		return nil, fmt.Errorf("rate limit exceeded for connection")
	}

	// Parse connection ID
	connectionID, err := primitive.ObjectIDFromHex(input.ConnectionID)
	if err != nil {
		slog.Error("Invalid connection ID in webhook", "connection_id", input.ConnectionID, "error", err)
		return nil, fmt.Errorf("invalid connection ID: %w", err)
	}

	// Look up connection by ID
	var connection CalendarConnection
	err = h.service.connections.FindOne(ctx, bson.M{"_id": connectionID}).Decode(&connection)
	if err == mongo.ErrNoDocuments {
		slog.Error("Connection not found for webhook", "connection_id", input.ConnectionID)
		return nil, fmt.Errorf("connection not found")
	} else if err != nil {
		slog.Error("Failed to find connection for webhook", "connection_id", input.ConnectionID, "error", err)
		return nil, fmt.Errorf("failed to find connection: %w", err)
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
		return nil, fmt.Errorf("invalid channel or resource ID")
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
			// Create a new context for the background operation
			bgCtx := context.Background()

			// Define time range for sync (next week of events)
			now := time.Now()
			startTime := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			endTime := startTime.AddDate(0, 0, 7).Add(24*time.Hour - time.Second)

			// Trigger sync
			_, err := h.service.SyncEventsToTasks(bgCtx, connection.ID, connection.UserID, startTime, endTime)
			if err != nil {
				slog.Error("Failed to sync events after webhook", "connection_id", connection.ID, "error", err)
				return
			}

			slog.Info("Successfully synced events after webhook", "connection_id", connection.ID)
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
