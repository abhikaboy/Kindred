package congratulation

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Input/Output types for congratulation operations

// Create Congratulation
type CreateCongratulationInput struct {
	Authorization string                     `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                     `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          CreateCongratulationParams `json:"body"`
}

type CreateCongratulationOutput struct {
	Body struct {
		CongratulationDocument
		RingDelta *rings.RingDelta `json:"ringDelta,omitempty" doc:"Describes the Share ring increment triggered by this congratulation so the client can render feedback"`
	} `json:"body"`
}

// Get Congratulations (all for authenticated user)
type GetCongratulationsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetCongratulationsOutput struct {
	Body []CongratulationDocument `json:"body"`
}

// Get Congratulation by ID
type GetCongratulationInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetCongratulationOutput struct {
	Body CongratulationDocument `json:"body"`
}

// Update Congratulation
type UpdateCongratulationInput struct {
	Authorization string                       `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                       `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string                       `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateCongratulationDocument `json:"body"`
}

type UpdateCongratulationOutput struct {
	Body struct {
		Message string `json:"message" example:"Congratulation updated successfully"`
	}
}

// Delete Congratulation
type DeleteCongratulationInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteCongratulationOutput struct {
	Body struct {
		Message string `json:"message" example:"Congratulation deleted successfully"`
	}
}

// Mark Congratulations as Read
type MarkCongratulationsReadInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          MarkCongratulationsReadParams
}

type MarkCongratulationsReadParams struct {
	ID []string `json:"id" validate:"required" doc:"List of congratulation IDs to mark as read"`
}

type MarkCongratulationsReadOutput struct {
	Body struct {
		Message string `json:"message" example:"Congratulations marked as read successfully"`
		Count   int    `json:"count" example:"2" doc:"Number of congratulations marked as read"`
	}
}

// React to Congratulation
type ReactToCongratulationInput struct {
	Authorization string                       `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                       `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string                       `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          CongratulationReactionParams `json:"body"`
}

type CongratulationReactionParams struct {
	Emoji string `json:"emoji" example:"🙌" doc:"Reaction emoji (one of the curated kudos reactions)" validate:"required"`
}

type ReactToCongratulationOutput struct {
	Body struct {
		Reaction *string `json:"reaction" example:"🙌" doc:"Reaction state after the toggle (null when removed)"`
		Message  string  `json:"message" example:"Reaction added successfully"`
	} `json:"body"`
}

// Get Sent Congratulations
type GetSentCongratulationsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetSentCongratulationsOutput struct {
	Body []CongratulationDocument `json:"body"`
}

// Send Beak Congratulation (system congratulation from onboarding)
type SendBeakCongratulationInput struct {
	Authorization string                       `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                       `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          SendBeakCongratulationParams `json:"body"`
}

type SendBeakCongratulationParams struct {
	Message      string `json:"message" example:"welcome! you just completed your first task!" doc:"Congratulation message" validate:"required"`
	CategoryName string `json:"categoryName" example:"My Tasks" doc:"Category name" validate:"required"`
	TaskName     string `json:"taskName" example:"Start my morning routine" doc:"Task name" validate:"required"`
	GrantCredits bool   `json:"grantCredits,omitempty" doc:"Whether to grant welcome credits to the user"`
}

type SendBeakCongratulationOutput struct {
	Body SendBeakCongratulationResult
}

type SendBeakCongratulationResult struct {
	Message        string         `json:"message" example:"Congratulation sent successfully"`
	CreditsGranted map[string]int `json:"creditsGranted,omitempty" doc:"Credits granted to the user by type"`
}

// Data structures
type CongratulationSender struct {
	Name    string `bson:"name" json:"name" example:"John Doe" doc:"Sender's name"`
	Picture string `bson:"picture" json:"picture" example:"https://example.com/avatar.jpg" doc:"Sender's profile picture URL"`
	ID      string `bson:"id" json:"id" example:"507f1f77bcf86cd799439011" doc:"Sender's user ID"`
}

// Internal version for MongoDB operations
type CongratulationSenderInternal struct {
	Name    string             `bson:"name"`
	Picture string             `bson:"picture"`
	ID      primitive.ObjectID `bson:"id"`
}

// Helper function to convert from internal to API type
func (s *CongratulationSenderInternal) ToAPI() *CongratulationSender {
	return &CongratulationSender{
		Name:    s.Name,
		Picture: s.Picture,
		ID:      s.ID.Hex(),
	}
}

type CreateCongratulationParams struct {
	Receiver     string `json:"receiver" example:"507f1f77bcf86cd799439012" doc:"Receiver user ID" validate:"required"`
	Message      string `json:"message" example:"Congratulations on completing your task!" doc:"Congratulation message" validate:"required"`
	CategoryName string `json:"categoryName" example:"Work" doc:"Category name" validate:"required"`
	TaskName     string `json:"taskName" example:"Complete project proposal" doc:"Task name" validate:"required"`
	Type         string `json:"type" example:"message" doc:"Type of congratulation (message or image)" validate:"omitempty,oneof=message image"`
	PostID       string `json:"postId,omitempty" example:"507f1f77bcf86cd799439013" doc:"Optional post ID associated with the congratulation"`
	Private      bool   `json:"private,omitempty" doc:"If true, the sender is anonymized to everyone except the receiver"`
}

type CongratulationDocument struct {
	ID           string               `bson:"_id,omitempty" json:"id" example:"507f1f77bcf86cd799439011" doc:"Unique identifier for the congratulation"`
	Sender       CongratulationSender `bson:"sender" json:"sender" doc:"Sender information"`
	Receiver     string               `bson:"receiver" json:"receiver" example:"507f1f77bcf86cd799439012" doc:"Receiver user ID"`
	Message      string               `bson:"message" json:"message" example:"Congratulations on completing your task!" doc:"Congratulation message"`
	Timestamp    time.Time            `bson:"timestamp" json:"timestamp" example:"2023-01-01T00:00:00Z" doc:"Creation timestamp"`
	CategoryName string               `bson:"categoryName" json:"categoryName" example:"Work" doc:"Category name"`
	TaskName     string               `bson:"taskName" json:"taskName" example:"Complete project proposal" doc:"Task name"`
	Read         bool                 `bson:"read" json:"read" example:"false" doc:"Whether the congratulation has been read"`
	Type         string               `bson:"type" json:"type" example:"message" doc:"Type of congratulation (message or image)"`
	Reaction     *string              `bson:"reaction,omitempty" json:"reaction,omitempty" example:"🙌" doc:"Receiver's emoji reaction"`
	ReactedAt    *time.Time           `bson:"reactedAt,omitempty" json:"reactedAt,omitempty" doc:"When the receiver reacted"`
	// Populated only by sent queries (kudos documents store just the receiver's ID).
	ReceiverInfo *CongratulationSender `bson:"receiverInfo,omitempty" json:"receiverInfo,omitempty" doc:"Receiver's profile info (sent queries only)"`
}

// Internal struct for MongoDB operations (keeps primitive.ObjectID)
type CongratulationDocumentInternal struct {
	ID           primitive.ObjectID           `bson:"_id,omitempty"`
	Sender       CongratulationSenderInternal `bson:"sender"`
	Receiver     primitive.ObjectID           `bson:"receiver"`
	Message      string                       `bson:"message"`
	Timestamp    time.Time                    `bson:"timestamp"`
	CategoryName string                       `bson:"categoryName"`
	TaskName     string                       `bson:"taskName"`
	Read         bool                         `bson:"read"`
	Type         string                       `bson:"type"`
	PostID       *primitive.ObjectID          `bson:"postId,omitempty"`
	Private      bool                         `bson:"private,omitempty"`
	Reaction     *string                      `bson:"reaction,omitempty"`
	ReactedAt    *time.Time                   `bson:"reactedAt,omitempty"`
}

type UpdateCongratulationDocument struct {
	Message      *string    `bson:"message,omitempty" json:"message,omitempty" example:"Updated congratulation message" doc:"New message"`
	CategoryName *string    `bson:"categoryName,omitempty" json:"categoryName,omitempty" example:"Updated Work" doc:"New category name"`
	TaskName     *string    `bson:"taskName,omitempty" json:"taskName,omitempty" example:"Updated task name" doc:"New task name"`
	Read         *bool      `bson:"read,omitempty" json:"read,omitempty" example:"true" doc:"Read status"`
	Timestamp    *time.Time `bson:"timestamp,omitempty" json:"timestamp,omitempty" example:"2023-01-02T00:00:00Z" doc:"Update timestamp"`
}

// Helper functions to convert between internal and API types
func (c *CongratulationDocumentInternal) ToAPI() *CongratulationDocument {
	return &CongratulationDocument{
		ID:           c.ID.Hex(),
		Sender:       *c.Sender.ToAPI(),
		Receiver:     c.Receiver.Hex(),
		Message:      c.Message,
		Timestamp:    c.Timestamp,
		CategoryName: c.CategoryName,
		TaskName:     c.TaskName,
		Read:         c.Read,
		Type:         c.Type,
		Reaction:     c.Reaction,
		ReactedAt:    c.ReactedAt,
	}
}

/*
Congratulation Service to be used by Congratulation Handler to interact with the
Database layer of the application
*/

type Service struct {
	Congratulations     *mongo.Collection
	Users               *mongo.Collection
	Posts               *mongo.Collection
	NotificationService *notifications.Service
	RingService         *rings.RingService
}
