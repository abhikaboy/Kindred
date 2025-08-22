package notifications

import (
	"context"
	"fmt"

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
		return nil, huma.Error500InternalServerError("Failed to fetch notifications", err)
	}

	// Get unread count
	unreadCount, err := h.service.GetUnreadCount(userObjectID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch unread count", err)
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
	// Validate input
	errs := xvalidator.Validator.Validate(input)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context (set by auth middleware)
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert string IDs to ObjectIDs
	var notificationIDs []primitive.ObjectID
	for _, idStr := range input.NotificationIDs {
		id, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid notification ID format", err)
		}
		notificationIDs = append(notificationIDs, id)
	}

	// Mark notifications as read
	err = h.service.MarkNotificationsAsRead(notificationIDs)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to mark notifications as read", err)
	}

	return &MarkNotificationsReadOutput{
		Body: struct {
			Message string `json:"message" example:"Notifications marked as read successfully"`
			Count   int    `json:"count" example:"2" doc:"Number of notifications marked as read"`
		}{
			Message: "Notifications marked as read successfully",
			Count:   len(notificationIDs),
		},
	}, nil
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
		return nil, huma.Error500InternalServerError("Failed to mark all notifications as read", err)
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
		return nil, huma.Error500InternalServerError("Failed to delete notification", err)
	}

	return &DeleteNotificationOutput{
		Body: struct {
			Message string `json:"message" example:"Notification deleted successfully"`
		}{
			Message: "Notification deleted successfully",
		},
	}, nil
}
