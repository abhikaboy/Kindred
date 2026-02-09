package calendar

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service        *Service
	webhookLimiter *WebhookRateLimiter
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
		// 10 requests per minute per connection_id
		webhookLimiter: NewWebhookRateLimiter(10, 60),
	}
}

// ConnectGoogle initiates OAuth flow
func (h *Handler) ConnectGoogle(ctx context.Context, input *ConnectGoogleInput) (*ConnectGoogleOutput, error) {
	// Get user ID from context (set by auth middleware)
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("User not authenticated")
	}

	authURL, err := h.service.InitiateOAuth(ProviderGoogle, userID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to generate auth URL", err)
	}

	resp := &ConnectGoogleOutput{}
	resp.Body.AuthURL = authURL
	return resp, nil
}

// OAuthCallback handles Google's OAuth callback and returns HTML redirect
func (h *Handler) OAuthCallback(ctx context.Context, input *OAuthCallbackInput) (*OAuthCallbackOutput, error) {
	slog.Info("OAuth callback received", "has_code", input.Code != "", "has_state", input.State != "", "has_error", input.Error != "")
	resp := &OAuthCallbackOutput{}

	var redirectURL string

	// Check for OAuth error
	if input.Error != "" {
		slog.Warn("OAuth error from provider", "error", input.Error)
		redirectURL = fmt.Sprintf("kindred://calendar/error?message=%s", input.Error)
		resp.Body.HTML = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=%s">
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to app...</p>
</body>
</html>`, redirectURL)
		return resp, nil
	}

	// Handle callback (state contains user ID)
	connection, err := h.service.HandleCallback(ctx, ProviderGoogle, input.Code, input.State)
	if err != nil {
		slog.Error("Failed to handle OAuth callback", "error", err)
		redirectURL = "kindred://calendar/error?message=connection_failed"
		resp.Body.HTML = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=%s">
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to app...</p>
</body>
</html>`, redirectURL)
		return resp, nil
	}

	slog.Info("OAuth callback completed successfully", "account", connection.ProviderAccountID, "connection_id", connection.ID.Hex())

	// Success - redirect to deep link
	redirectURL = fmt.Sprintf("kindred://calendar/linked?connectionId=%s", connection.ID.Hex())
	resp.Body.HTML = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=%s">
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to app...</p>
</body>
</html>`, redirectURL)

	return resp, nil
}

// GetConnections lists user's calendar connections
func (h *Handler) GetConnections(ctx context.Context, input *GetConnectionsInput) (*GetConnectionsOutput, error) {
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("User not authenticated")
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID")
	}

	connections, err := h.service.GetConnections(ctx, userObjID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch connections", err)
	}

	resp := &GetConnectionsOutput{}
	resp.Body.Connections = connections
	return resp, nil
}

// Disconnect removes a calendar connection
func (h *Handler) Disconnect(ctx context.Context, input *DisconnectInput) (*DisconnectOutput, error) {
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("User not authenticated")
	}

	connectionID, err := primitive.ObjectIDFromHex(input.ConnectionID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid connection ID")
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID")
	}

	if err := h.service.DisconnectProvider(ctx, userObjID, connectionID); err != nil {
		return nil, huma.Error500InternalServerError("Failed to disconnect", err)
	}

	resp := &DisconnectOutput{}
	resp.Body.Success = true
	resp.Body.Message = "Calendar disconnected successfully"
	return resp, nil
}

// GetEvents fetches calendar events from a connection
func (h *Handler) GetEvents(ctx context.Context, input *GetEventsInput) (*GetEventsOutput, error) {
	slog.Info("Fetching events", "connection_id", input.ConnectionID, "start", input.StartDate, "end", input.EndDate)

	// Verify user is authenticated
	_, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("User not authenticated")
	}

	// Parse connection ID
	connectionID, err := primitive.ObjectIDFromHex(input.ConnectionID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid connection ID")
	}

	// Parse dates with defaults
	var startTime, endTime time.Time

	if input.StartDate == "" {
		// Default: start of today
		now := time.Now()
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		slog.Info("Using default start date (today)", "start", startTime)
	} else {
		startTime, err = time.Parse(time.RFC3339, input.StartDate)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid start date format, use RFC3339")
		}
	}

	if input.EndDate == "" {
		// Default: 7 days from now (next week)
		now := time.Now()
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location()).AddDate(0, 0, 7)
		slog.Info("Using default end date (7 days from now)", "end", endTime)
	} else {
		endTime, err = time.Parse(time.RFC3339, input.EndDate)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid end date format, use RFC3339")
		}
	}

	// Fetch events
	events, err := h.service.FetchEvents(ctx, connectionID, startTime, endTime)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch events", err)
	}

	// Convert to DTOs
	eventDTOs := make([]CalendarEventDTO, 0, len(events))
	for _, event := range events {
		eventDTOs = append(eventDTOs, CalendarEventDTO{
			ID:           event.ID,
			CalendarID:   event.CalendarID,
			CalendarName: event.CalendarName,
			Summary:      event.Summary,
			Description:  event.Description,
			Location:     event.Location,
			StartTime:    event.StartTime.Format(time.RFC3339),
			EndTime:      event.EndTime.Format(time.RFC3339),
			IsAllDay:     event.IsAllDay,
			Attendees:    event.Attendees,
			Status:       event.Status,
		})
	}

	resp := &GetEventsOutput{}
	resp.Body.Events = eventDTOs
	return resp, nil
}

// SyncEvents syncs calendar events to tasks
func (h *Handler) SyncEvents(ctx context.Context, input *SyncEventsInput) (*SyncEventsOutput, error) {
	slog.Info("Syncing events to tasks", "connection_id", input.ConnectionID, "start", input.StartDate, "end", input.EndDate)

	// Verify user is authenticated
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("User not authenticated")
	}

	// Parse connection ID
	connectionID, err := primitive.ObjectIDFromHex(input.ConnectionID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid connection ID")
	}

	// Parse user ID
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID")
	}

	// Parse dates with defaults
	var startTime, endTime time.Time

	if input.StartDate == "" {
		// Default: start of today
		now := time.Now()
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		slog.Info("Using default start date (today)", "start", startTime)
	} else {
		startTime, err = time.Parse(time.RFC3339, input.StartDate)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid start date format, use RFC3339")
		}
	}

	if input.EndDate == "" {
		// Default: 7 days from now (next week)
		now := time.Now()
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location()).AddDate(0, 0, 7)
		slog.Info("Using default end date (7 days from now)", "end", endTime)
	} else {
		endTime, err = time.Parse(time.RFC3339, input.EndDate)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid end date format, use RFC3339")
		}
	}

	// Sync events to tasks
	result, err := h.service.SyncEventsToTasks(ctx, connectionID, userObjID, startTime, endTime)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to sync events", err)
	}

	resp := &SyncEventsOutput{}
	resp.Body.TasksCreated = result.TasksCreated
	resp.Body.TasksSkipped = result.TasksSkipped
	resp.Body.EventsTotal = result.EventsTotal
	resp.Body.CategoriesSynced = result.CategoriesSynced
	resp.Body.WorkspaceName = result.WorkspaceName

	slog.Info("Sync completed", "connection_id", input.ConnectionID, "tasks_created", result.TasksCreated, "tasks_skipped", result.TasksSkipped)
	return resp, nil
}
