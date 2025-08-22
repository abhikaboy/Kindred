package notifications

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Service holds the MongoDB collections for notifications operations
type Service struct {
	Notifications *mongo.Collection
	Users         *mongo.Collection
}

// NotificationType defines the different types of notifications
type NotificationType string

const (
	NotificationTypeEncouragement  NotificationType = "ENCOURAGEMENT"
	NotificationTypeComment        NotificationType = "COMMENT"
	NotificationTypeCongratulation NotificationType = "CONGRATULATION"
)

// NotificationDocument represents a notification stored in the database
type NotificationDocument struct {
	ID               primitive.ObjectID `bson:"_id" json:"id"`
	Content          string             `bson:"content" json:"content"`
	User             UserReference      `bson:"user" json:"user"`
	Time             time.Time          `bson:"time" json:"time"`
	NotificationType NotificationType   `bson:"notificationType" json:"notificationType"`
	ReferenceID      primitive.ObjectID `bson:"reference_id" json:"reference_id"`
	Read             bool               `bson:"read" json:"read"`
}

// UserReference represents the user who should receive the notification
type UserReference struct {
	ID             primitive.ObjectID `bson:"_id" json:"id"`
	DisplayName    string             `bson:"display_name" json:"display_name"`
	Handle         string             `bson:"handle" json:"handle"`
	ProfilePicture string             `bson:"profile_picture" json:"profile_picture"`
}

// CreateNotificationRequest represents the data needed to create a new notification
type CreateNotificationRequest struct {
	Content          string             `json:"content" validate:"required"`
	UserID           primitive.ObjectID `json:"user_id" validate:"required"`
	NotificationType NotificationType   `json:"notification_type" validate:"required"`
	ReferenceID      primitive.ObjectID `json:"reference_id" validate:"required"`
}

// UpdateNotificationRequest represents data for updating notification read status
type UpdateNotificationRequest struct {
	Read bool `json:"read"`
}

// GetNotificationsResponse represents the response for getting notifications
type GetNotificationsResponse struct {
	Notifications []NotificationDocument `json:"notifications"`
	Total         int                    `json:"total"`
}
