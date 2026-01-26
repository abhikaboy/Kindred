package Connection

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
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

// New relationship-based types
type RelationshipStatus string

const (
	StatusFriends RelationshipStatus = "friends"
	StatusPending RelationshipStatus = "pending"
	StatusBlocked RelationshipStatus = "blocked"
)

type RelationshipType string

const (
	RelationshipNone            RelationshipType = "none"
	RelationshipFriends         RelationshipType = "friends"
	RelationshipRequestSent     RelationshipType = "request_sent"
	RelationshipRequestReceived RelationshipType = "request_received"
	RelationshipBlocked         RelationshipType = "blocked"
)

type CreateConnectionParams struct {
	ReceiverID string `validate:"required" json:"receiver_id" example:"507f1f77bcf86cd799439012" doc:"Receiver user ID"`
}

type ConnectionDocument struct {
	ID         string             `bson:"_id,omitempty" json:"id" example:"507f1f77bcf86cd799439011" doc:"Relationship ID"`
	Users      []string           `json:"users" doc:"Array of user IDs (always sorted)"`
	Status     RelationshipStatus `json:"status" doc:"Relationship status"`
	Requester  ConnectionUser     `json:"requester" doc:"Connection requester information"`
	ReceiverID string             `json:"receiver_id" doc:"Receiver user ID"`
	CreatedAt  time.Time          `json:"created_at" doc:"When relationship was created"`
	AcceptedAt *time.Time         `json:"accepted_at,omitempty" doc:"When friendship was confirmed"`
}

// Internal version for MongoDB operations
type ConnectionDocumentInternal struct {
	ID         primitive.ObjectID      `bson:"_id,omitempty"`
	Users      []primitive.ObjectID    `bson:"users"` // Always sorted
	Status     RelationshipStatus      `bson:"status"`
	Requester  ConnectionUserInternal  `bson:"requester"`
	ReceiverID primitive.ObjectID      `bson:"receiver_id"`
	CreatedAt  time.Time               `bson:"created_at"`
	AcceptedAt *time.Time              `bson:"accepted_at,omitempty"`
	BlockerID  *primitive.ObjectID     `bson:"blocker_id,omitempty"` // For blocked relationships
	UpdatedAt  *time.Time              `bson:"updated_at,omitempty"`
}

// Helper function to convert from internal to API type
func (c *ConnectionDocumentInternal) ToAPI() *ConnectionDocument {
	users := make([]string, len(c.Users))
	for i, userID := range c.Users {
		users[i] = userID.Hex()
	}

	doc := &ConnectionDocument{
		ID:         c.ID.Hex(),
		Users:      users,
		Status:     c.Status,
		Requester:  *c.Requester.ToAPI(),
		ReceiverID: c.ReceiverID.Hex(),
		CreatedAt:  c.CreatedAt,
		AcceptedAt: c.AcceptedAt,
	}

	return doc
}

type UpdateConnectionDocument struct {
	Status     *RelationshipStatus `json:"status,omitempty"`
	AcceptedAt *time.Time          `json:"accepted_at,omitempty"`
}

// Helper functions for sorting user IDs
func SortUserIDs(userA, userB primitive.ObjectID) []primitive.ObjectID {
	if userA.Hex() < userB.Hex() {
		return []primitive.ObjectID{userA, userB}
	}
	return []primitive.ObjectID{userB, userA}
}

func SortUserIDStrings(userA, userB string) []string {
	if userA < userB {
		return []string{userA, userB}
	}
	return []string{userB, userA}
}

type GetFriendsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetFriendsOutput struct {
	Body []types.UserExtendedReference `json:"body"`
}

/*
Connection Service to be used by Connection Handler to interact with the
Database layer of the application
*/

type Service struct {
	Connections         *mongo.Collection
	Users               *mongo.Collection
	NotificationService *notifications.Service
}
