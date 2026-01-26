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

// Handler holds the service for Huma operations
type Handler struct {
	service *Service
}

// NotificationType defines the different types of notifications
type NotificationType string

const (
	NotificationTypeEncouragement         NotificationType = "ENCOURAGEMENT"
	NotificationTypeComment               NotificationType = "COMMENT"
	NotificationTypeCongratulation        NotificationType = "CONGRATULATION"
	NotificationTypeFriendRequest         NotificationType = "FRIEND_REQUEST"
	NotificationTypeFriendRequestAccepted NotificationType = "FRIEND_REQUEST_ACCEPTED"
	NotificationTypePost                  NotificationType = "POST"
)

// NotificationDocument represents a notification stored in the database
type NotificationDocument struct {
	ID               primitive.ObjectID `bson:"_id" json:"id"`
	Content          string             `bson:"content" json:"content"`
	Receiver         primitive.ObjectID `bson:"receiver" json:"receiver"`
	User             UserReference      `bson:"user" json:"user"`
	Time             time.Time          `bson:"time" json:"time"`
	NotificationType NotificationType   `bson:"notificationType" json:"notificationType"`
	ReferenceID      primitive.ObjectID `bson:"reference_id" json:"reference_id"`
	Read             bool               `bson:"read" json:"read"`
	Thumbnail        string             `bson:"thumbnail,omitempty" json:"thumbnail,omitempty" doc:"Optional thumbnail image URL for the notification"`
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
	Thumbnail        string             `json:"thumbnail,omitempty"`
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

// Huma Input/Output types for notification operations

// Get Notifications
type GetNotificationsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Limit         int    `query:"limit" example:"20" doc:"Maximum number of notifications to return (default: 20, max: 100)"`
	Skip          int    `query:"skip" example:"0" doc:"Number of notifications to skip for pagination"`
}

type GetNotificationsOutput struct {
	Body struct {
		Notifications []NotificationDocument `json:"notifications"`
		UnreadCount   int                    `json:"unread_count"`
		Total         int                    `json:"total"`
	} `json:"body"`
}

// Mark Notifications as Read
type MarkNotificationsReadInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          MarkNotificationsReadBody
}

type MarkNotificationsReadBody struct {
	ID []string `json:"id" validate:"required" doc:"List of notification IDs to mark as read"`
}

type MarkNotificationsReadOutput struct {
	Body struct {
		Message string `json:"message" example:"Notifications marked as read successfully"`
		Count   int    `json:"count" example:"2" doc:"Number of notifications marked as read"`
	}
}

// Mark All Notifications as Read
type MarkAllNotificationsReadInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type MarkAllNotificationsReadOutput struct {
	Body struct {
		Message string `json:"message" example:"All notifications marked as read successfully"`
	} `json:"body"`
}

// Delete Notification
type DeleteNotificationInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteNotificationOutput struct {
	Body struct {
		Message string `json:"message" example:"Notification deleted successfully"`
	} `json:"body"`
}
