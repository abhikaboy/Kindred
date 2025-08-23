package Profile

import (
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// RelationshipStatus represents the relationship between the authenticated user and the profile being viewed
type RelationshipStatus string

const (
	RelationshipNone      RelationshipStatus = "none"      // No connection exists
	RelationshipRequested RelationshipStatus = "requested" // Connection request sent by authenticated user
	RelationshipReceived  RelationshipStatus = "received"  // Connection request received by authenticated user
	RelationshipConnected RelationshipStatus = "connected" // Users are connected/friends
	RelationshipSelf      RelationshipStatus = "self"      // Viewing own profile
)

type ProfileDocument struct {
	ID             primitive.ObjectID   `bson:"_id" json:"id"`
	ProfilePicture *string              `bson:"profile_picture" json:"profile_picture"`
	DisplayName    string               `bson:"display_name" json:"display_name"`
	Handle         string               `bson:"handle" json:"handle"`
	TasksComplete  int                  `bson:"tasks_complete" json:"tasks_complete"`
	Streak         int                  `bson:"streak" json:"streak"`
	Points         int                  `bson:"points" json:"points"`         // Stored field in users collection
	PostsMade      int                  `bson:"posts_made" json:"posts_made"` // Stored field in users collection
	Friends        []primitive.ObjectID `bson:"friends" json:"friends"`
	// Relationship information - only included when viewing another user's profile
	Relationship *RelationshipInfo    `bson:"-" json:"relationship,omitempty"`
	Tasks        []types.TaskDocument `bson:"tasks" json:"tasks,omitempty"`
}

// RelationshipInfo contains details about the relationship between users
type RelationshipInfo struct {
	Status    RelationshipStatus `json:"status"`
	RequestID *string            `json:"request_id,omitempty"` // ID of the connection request if applicable
}

type UpdateProfileDocument struct {
	DisplayName    string  `bson:"display_name,omitempty" json:"display_name,omitempty"`
	Handle         string  `bson:"handle,omitempty" json:"handle,omitempty"`
	ProfilePicture *string `bson:"profile_picture,omitempty" json:"profile_picture,omitempty"`
}

/*
Profile Service to be used by Profile Handler to interact with the
Database layer of the application
*/

type Service struct {
	Profiles    *mongo.Collection
	Connections *mongo.Collection // Add connections collection for relationship checks
	Tasks       *mongo.Collection
}
