package notifications

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// NewHandler creates a new notifications handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetNotificationsHuma handles GET /v1/notifications
func (h *Handler) GetNotificationsHuma(ctx context.Context, input *GetNotificationsInput) (*GetNotificationsOutput, error) {
	// Extract user_id from context (set by auth middleware)
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Set default values for pagination
	limit := input.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	skip := input.Skip
	if skip < 0 {
		skip = 0
	}

	// Get notifications
	notifications, err := h.service.GetUserNotifications(userObjectID, limit, skip)
	if err != nil {
		slog.Error("Failed to fetch notifications", "userId", userObjectID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load your notifications. Please try again.", err)
	}

	// Get unread count
	unreadCount, err := h.service.GetUnreadCount(userObjectID)
	if err != nil {
		slog.Error("Failed to fetch unread notification count", "userId", userObjectID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load notification count. Please try again.", err)
	}

	return &GetNotificationsOutput{
		Body: struct {
			Notifications []NotificationDocument `json:"notifications"`
			UnreadCount   int                    `json:"unread_count"`
			Total         int                    `json:"total"`
		}{
			Notifications: notifications,
			UnreadCount:   int(unreadCount),
			Total:         len(notifications),
		},
	}, nil
}

// MarkNotificationsReadHuma handles PATCH /v1/notifications/read
func (h *Handler) MarkNotificationsReadHuma(ctx context.Context, input *MarkNotificationsReadInput) (*MarkNotificationsReadOutput, error) {
	// Extract user_id from context (set by auth middleware)
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Add explicit validation
	errs := xvalidator.Validator.Validate(input)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please provide valid notification IDs", fmt.Errorf("validation errors: %v", errs))
	}

	if len(input.Body.ID) == 0 {
		return nil, huma.Error400BadRequest("No IDs provided", fmt.Errorf("id array cannot be empty"))
	}

	// Convert string IDs to ObjectIDs
	objectIDs := make([]primitive.ObjectID, len(input.Body.ID))
	for i, idStr := range input.Body.ID {
		id, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			return nil, huma.Error400BadRequest(fmt.Sprintf("Invalid notification ID format at position %d", i), fmt.Errorf("invalid ID at index %d: %s", i, idStr))
		}
		objectIDs[i] = id
	}

	// Mark notifications as read
	err = h.service.MarkNotificationsAsRead(objectIDs)
	if err != nil {
		slog.Error("Failed to mark notifications as read", "notificationCount", len(objectIDs), "error", err)
		return nil, huma.Error500InternalServerError("Unable to mark notifications as read. Please try again.", err)
	}

	resp := &MarkNotificationsReadOutput{}
	resp.Body.Message = "Notifications marked as read successfully"
	resp.Body.Count = len(objectIDs)
	return resp, nil
}

// MarkAllNotificationsReadHuma handles PATCH /v1/notifications/read-all
func (h *Handler) MarkAllNotificationsReadHuma(ctx context.Context, input *MarkAllNotificationsReadInput) (*MarkAllNotificationsReadOutput, error) {
	// Extract user_id from context (set by auth middleware)
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Mark all notifications as read
	err = h.service.MarkAllAsReadForUser(userObjectID)
	if err != nil {
		slog.Error("Failed to mark all notifications as read", "userId", userObjectID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to mark all notifications as read. Please try again.", err)
	}

	return &MarkAllNotificationsReadOutput{
		Body: struct {
			Message string `json:"message" example:"All notifications marked as read successfully"`
		}{
			Message: "All notifications marked as read successfully",
		},
	}, nil
}

// DeleteNotificationHuma handles DELETE /v1/notifications/{id}
func (h *Handler) DeleteNotificationHuma(ctx context.Context, input *DeleteNotificationInput) (*DeleteNotificationOutput, error) {
	// Extract user_id from context (set by auth middleware)
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Parse notification ID
	notificationID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid notification ID format", err)
	}

	// Delete notification
	err = h.service.DeleteNotification(notificationID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, huma.Error404NotFound("Notification not found", err)
		}
		slog.Error("Failed to delete notification", "notificationId", notificationID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to delete notification. Please try again.", err)
	}

	return &DeleteNotificationOutput{
		Body: struct {
			Message string `json:"message" example:"Notification deleted successfully"`
		}{
			Message: "Notification deleted successfully",
		},
	}, nil
}
