package Connection

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ConnectionUser struct {
	ID      string  `bson:"_id" json:"_id" example:"507f1f77bcf86cd799439011" doc:"User ID"`
	Picture *string `bson:"picture" json:"picture" example:"https://example.com/avatar.jpg" doc:"Profile picture URL"`
	Name    string  `bson:"name" json:"name" example:"John Doe" doc:"User name"`
	Handle  string  `bson:"handle" json:"handle" example:"johndoe" doc:"User handle"`
}

// Internal version for MongoDB operations
type ConnectionUserInternal struct {
	ID      primitive.ObjectID `bson:"_id"`
	Picture *string            `bson:"picture"`
	Name    string             `bson:"name"`
	Handle  string             `bson:"handle"`
}

// Helper function to convert from internal to API type
func (u *ConnectionUserInternal) ToAPI() *ConnectionUser {
	return &ConnectionUser{
		ID:      u.ID.Hex(),
		Picture: u.Picture,
		Name:    u.Name,
		Handle:  u.Handle,
	}
}

type CreateConnectionParams struct {
	Requester ConnectionUser `validate:"required" json:"requester" doc:"Connection requester information"`
	Reciever  string         `validate:"required" json:"reciever" example:"507f1f77bcf86cd799439012" doc:"Receiver user ID"`
}

type ConnectionDocument struct {
	ID        string         `bson:"_id,omitempty" json:"id" example:"507f1f77bcf86cd799439011" doc:"Connection ID"`
	Requester ConnectionUser `validate:"required" json:"requester" doc:"Connection requester information"`
	Reciever  string         `validate:"required" json:"reciever" example:"507f1f77bcf86cd799439012" doc:"Receiver user ID"`
	Timestamp time.Time      `bson:"timestamp" json:"timestamp" example:"2023-01-01T00:00:00Z" doc:"Connection timestamp"`
}

// Internal version for MongoDB operations
type ConnectionDocumentInternal struct {
	ID        primitive.ObjectID     `bson:"_id,omitempty"`
	Requester ConnectionUserInternal `bson:"requester"`
	Reciever  primitive.ObjectID     `bson:"reciever"`
	Timestamp time.Time              `bson:"timestamp"`
}

// Helper function to convert from internal to API type
func (c *ConnectionDocumentInternal) ToAPI() *ConnectionDocument {
	return &ConnectionDocument{
		ID:        c.ID.Hex(),
		Requester: *c.Requester.ToAPI(),
		Reciever:  c.Reciever.Hex(),
		Timestamp: c.Timestamp,
	}
}

type UpdateConnectionDocument struct {
	// idk what goes here
}

/*
Connection Service to be used by Connection Handler to interact with the
Database layer of the application
*/

type Service struct {
	Connections *mongo.Collection
}
