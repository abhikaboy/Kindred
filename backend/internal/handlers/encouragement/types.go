package encouragement

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Input/Output types for encouragement operations

// Create Encouragement
type CreateEncouragementInput struct {
	Authorization string                    `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                    `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          CreateEncouragementParams `json:"body"`
}

type CreateEncouragementOutput struct {
	Body EncouragementDocument `json:"body"`
}

// Get Encouragements (all for authenticated user)
type GetEncouragementsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetEncouragementsOutput struct {
	Body []EncouragementDocument `json:"body"`
}

// Get Encouragement by ID
type GetEncouragementInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetEncouragementOutput struct {
	Body EncouragementDocument `json:"body"`
}

// Update Encouragement
type UpdateEncouragementInput struct {
	Authorization string                      `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                      `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string                      `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateEncouragementDocument `json:"body"`
}

type UpdateEncouragementOutput struct {
	Body struct {
		Message string `json:"message" example:"Encouragement updated successfully"`
	}
}

// Delete Encouragement
type DeleteEncouragementInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteEncouragementOutput struct {
	Body struct {
		Message string `json:"message" example:"Encouragement deleted successfully"`
	}
}

// Mark Encouragements as Read
type MarkEncouragementsReadInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          MarkEncouragementsReadBody
}

type MarkEncouragementsReadBody struct {
	ID []string `json:"id" validate:"required" doc:"List of encouragement IDs to mark as read"`
}

type MarkEncouragementsReadOutput struct {
	Body struct {
		Message string `json:"message" example:"Encouragements marked as read successfully"`
		Count   int    `json:"count" example:"2" doc:"Number of encouragements marked as read"`
	}
}

// Data structures
type EncouragementSender struct {
	Name    string `bson:"name" json:"name" example:"John Doe" doc:"Sender's name"`
	Picture string `bson:"picture" json:"picture" example:"https://example.com/avatar.jpg" doc:"Sender's profile picture URL"`
	ID      string `bson:"id" json:"id" example:"507f1f77bcf86cd799439011" doc:"Sender's user ID"`
}

// Internal version for MongoDB operations
type EncouragementSenderInternal struct {
	Name    string             `bson:"name"`
	Picture string             `bson:"picture"`
	ID      primitive.ObjectID `bson:"id"`
}

// Helper function to convert from internal to API type
func (s *EncouragementSenderInternal) ToAPI() *EncouragementSender {
	return &EncouragementSender{
		Name:    s.Name,
		Picture: s.Picture,
		ID:      s.ID.Hex(),
	}
}

type CreateEncouragementParams struct {
	Receiver     string `json:"receiver" example:"507f1f77bcf86cd799439012" doc:"Receiver user ID" validate:"required"`
	Message      string `json:"message" example:"Great job on completing your task!" doc:"Encouragement message" validate:"required"`
	CategoryName string `json:"categoryName" example:"Work" doc:"Category name" validate:"required"`
	TaskName     string `json:"taskName" example:"Complete project proposal" doc:"Task name" validate:"required"`
	TaskID       string `json:"taskId" example:"507f1f77bcf86cd799439013" doc:"Task ID being encouraged" validate:"required"`
	Type         string `json:"type" example:"message" doc:"Type of encouragement (message or image)" validate:"omitempty,oneof=message image"`
}

type EncouragementDocument struct {
	ID           string              `bson:"_id,omitempty" json:"id" example:"507f1f77bcf86cd799439011" doc:"Unique identifier for the encouragement"`
	Sender       EncouragementSender `bson:"sender" json:"sender" doc:"Sender information"`
	Receiver     string              `bson:"receiver" json:"receiver" example:"507f1f77bcf86cd799439012" doc:"Receiver user ID"`
	Message      string              `bson:"message" json:"message" example:"Great job on completing your task!" doc:"Encouragement message"`
	Timestamp    time.Time           `bson:"timestamp" json:"timestamp" example:"2023-01-01T00:00:00Z" doc:"Creation timestamp"`
	CategoryName string              `bson:"categoryName" json:"categoryName" example:"Work" doc:"Category name"`
	TaskName     string              `bson:"taskName" json:"taskName" example:"Complete project proposal" doc:"Task name"`
	TaskID       string              `bson:"taskId" json:"taskId" example:"507f1f77bcf86cd799439013" doc:"Task ID being encouraged"`
	Read         bool                `bson:"read" json:"read" example:"false" doc:"Whether the encouragement has been read"`
	Type         string              `bson:"type" json:"type" example:"message" doc:"Type of encouragement (message or image)"`
}

// Internal struct for MongoDB operations (keeps primitive.ObjectID)
type EncouragementDocumentInternal struct {
	ID           primitive.ObjectID          `bson:"_id,omitempty"`
	Sender       EncouragementSenderInternal `bson:"sender"`
	Receiver     primitive.ObjectID          `bson:"receiver"`
	Message      string                      `bson:"message"`
	Timestamp    time.Time                   `bson:"timestamp"`
	CategoryName string                      `bson:"categoryName"`
	TaskName     string                      `bson:"taskName"`
	TaskID       primitive.ObjectID          `bson:"taskId"`
	Read         bool                        `bson:"read"`
	Type         string                      `bson:"type"`
}

type UpdateEncouragementDocument struct {
	Message      *string    `bson:"message,omitempty" json:"message,omitempty" example:"Updated encouragement message" doc:"New message"`
	CategoryName *string    `bson:"categoryName,omitempty" json:"categoryName,omitempty" example:"Updated Work" doc:"New category name"`
	TaskName     *string    `bson:"taskName,omitempty" json:"taskName,omitempty" example:"Updated task name" doc:"New task name"`
	Read         *bool      `bson:"read,omitempty" json:"read,omitempty" example:"true" doc:"Read status"`
	Timestamp    *time.Time `bson:"timestamp,omitempty" json:"timestamp,omitempty" example:"2023-01-02T00:00:00Z" doc:"Update timestamp"`
}

// Helper functions to convert between internal and API types
func (e *EncouragementDocumentInternal) ToAPI() *EncouragementDocument {
	return &EncouragementDocument{
		ID:           e.ID.Hex(),
		Sender:       *e.Sender.ToAPI(),
		Receiver:     e.Receiver.Hex(),
		Message:      e.Message,
		Timestamp:    e.Timestamp,
		CategoryName: e.CategoryName,
		TaskName:     e.TaskName,
		TaskID:       e.TaskID.Hex(),
		Read:         e.Read,
		Type:         e.Type,
	}
}

/*
Encouragement Service to be used by Encouragement Handler to interact with the
Database layer of the application
*/

type Service struct {
	Encouragements      *mongo.Collection
	Users               *mongo.Collection
	NotificationService *notifications.Service
}
