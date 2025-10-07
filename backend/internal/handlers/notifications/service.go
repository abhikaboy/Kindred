package notifications

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// NewNotificationService creates a new notification service instance
func NewNotificationService(collections map[string]*mongo.Collection) *Service {
	return newService(collections)
}

// newService receives the map of collections and picks out notifications
func newService(collections map[string]*mongo.Collection) *Service {
	notifications := collections["notifications"]
	users := collections["users"]

	// Log if collections are not found
	if notifications == nil {
		slog.Error("Notifications collection not found in database")
	}
	if users == nil {
		slog.Error("Users collection not found in database")
	}

	return &Service{
		Notifications: notifications,
		Users:         users,
	}
}

// CreateNotification adds a new notification to the database
func (s *Service) CreateNotification(userID primitive.ObjectID, receiverID primitive.ObjectID, content string, notificationType NotificationType, referenceID primitive.ObjectID, thumbnail ...string) error {
	if s.Notifications == nil {
		return fmt.Errorf("notifications collection not available")
	}

	ctx := context.Background()

	// Get user information for the notification
	var user types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}

	// Create the notification document
	notification := NotificationDocument{
		ID:       primitive.NewObjectID(),
		Receiver: receiverID,
		Content:  content,
		User: UserReference{
			ID:             user.ID,
			DisplayName:    user.DisplayName,
			Handle:         user.Handle,
			ProfilePicture: user.ProfilePicture,
		},
		Time:             time.Now(),
		NotificationType: notificationType,
		ReferenceID:      referenceID,
		Read:             false,
	}

	// Add thumbnail if provided
	if len(thumbnail) > 0 && thumbnail[0] != "" {
		notification.Thumbnail = thumbnail[0]
	}

	_, err = s.Notifications.InsertOne(ctx, notification)
	if err != nil {
		return fmt.Errorf("failed to create notification: %w", err)
	}

	slog.Info("Notification created", "user_id", userID, "type", notificationType, "reference_id", referenceID, "has_thumbnail", len(thumbnail) > 0)
	return nil
}

// GetUserNotifications retrieves all notifications for a specific user
func (s *Service) GetUserNotifications(userID primitive.ObjectID, limit int, skip int) ([]NotificationDocument, error) {
	if s.Notifications == nil {
		return nil, fmt.Errorf("notifications collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"receiver": userID}

	// Sort by time descending (newest first)
	opts := options.Find().
		SetSort(bson.D{{Key: "time", Value: -1}}).
		SetLimit(int64(limit)).
		SetSkip(int64(skip))

	cursor, err := s.Notifications.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch notifications: %w", err)
	}
	defer cursor.Close(ctx)

	var notifications []NotificationDocument
	if err := cursor.All(ctx, &notifications); err != nil {
		return nil, fmt.Errorf("failed to decode notifications: %w", err)
	}

	return notifications, nil
}

// GetUnreadCount returns the count of unread notifications for a user
func (s *Service) GetUnreadCount(userID primitive.ObjectID) (int64, error) {
	if s.Notifications == nil {
		return 0, fmt.Errorf("notifications collection not available")
	}

	ctx := context.Background()
	filter := bson.M{
		"receiver": userID,
		"read":     false,
	}

	count, err := s.Notifications.CountDocuments(ctx, filter)
	if err != nil {
		return 0, fmt.Errorf("failed to count unread notifications: %w", err)
	}

	return count, nil
}

// MarkNotificationsAsRead marks one or more notifications as read
func (s *Service) MarkNotificationsAsRead(notificationIDs []primitive.ObjectID) error {
	if s.Notifications == nil {
		return fmt.Errorf("notifications collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": bson.M{"$in": notificationIDs}}
	update := bson.M{"$set": bson.M{"read": true}}

	result, err := s.Notifications.UpdateMany(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to mark notifications as read: %w", err)
	}

	slog.Info("Notifications marked as read", "count", result.ModifiedCount, "notification_ids", notificationIDs)
	return nil
}

// MarkAllAsReadForUser marks all notifications for a user as read
func (s *Service) MarkAllAsReadForUser(userID primitive.ObjectID) error {
	if s.Notifications == nil {
		return fmt.Errorf("notifications collection not available")
	}

	ctx := context.Background()
	filter := bson.M{
		"receiver": userID,
		"read":     false,
	}
	update := bson.M{"$set": bson.M{"read": true}}

	result, err := s.Notifications.UpdateMany(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to mark all notifications as read: %w", err)
	}

	slog.Info("All notifications marked as read for user", "user_id", userID, "count", result.ModifiedCount)
	return nil
}

// DeleteNotification removes a notification by ID
func (s *Service) DeleteNotification(notificationID primitive.ObjectID) error {
	if s.Notifications == nil {
		return fmt.Errorf("notifications collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": notificationID}

	result, err := s.Notifications.DeleteOne(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("notification not found")
	}

	slog.Info("Notification deleted", "notification_id", notificationID)
	return nil
}
