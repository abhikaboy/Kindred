package Waitlist

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateWaitlistParams struct {
	Email string `validate:"required,email" json:"email" example:"user@example.com" doc:"User email address"`
	Name  string `validate:"required" json:"name" example:"John Doe" doc:"User full name"`
}

type WaitlistDocument struct {
	ID        string    `bson:"_id,omitempty" json:"id" example:"507f1f77bcf86cd799439011" doc:"Unique waitlist entry identifier"`
	Email     string    `bson:"email" json:"email" example:"user@example.com" doc:"User email address"`
	Name      string    `bson:"name" json:"name" example:"John Doe" doc:"User full name"`
	Timestamp time.Time `bson:"timestamp" json:"timestamp" example:"2023-01-01T00:00:00Z" doc:"Entry creation timestamp"`
}

// Internal struct for MongoDB operations (keeps primitive.ObjectID)
type WaitlistDocumentInternal struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Email     string             `bson:"email"`
	Name      string             `bson:"name"`
	Timestamp time.Time          `bson:"timestamp"`
}

// Helper function to convert from internal to API type
func (w *WaitlistDocumentInternal) ToAPI() *WaitlistDocument {
	return &WaitlistDocument{
		ID:        w.ID.Hex(),
		Email:     w.Email,
		Name:      w.Name,
		Timestamp: w.Timestamp,
	}
}

/*
Waitlist Service to be used by Waitlist Handler to interact with the
Database layer of the application
*/

type Service struct {
	Waitlists *mongo.Collection
}
