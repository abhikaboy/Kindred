package Profile

import (
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
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
	RelationshipBlocked   RelationshipStatus = "blocked"   // User is blocked
)

type ProfileDocument struct {
	ID                primitive.ObjectID   `bson:"_id" json:"id"`
	ProfilePicture    *string              `bson:"profile_picture" json:"profile_picture"`
	DisplayName       string               `bson:"display_name" json:"display_name"`
	Handle            string               `bson:"handle" json:"handle"`
	TasksComplete     int                  `bson:"tasks_complete" json:"tasks_complete"`
	Streak            int                  `bson:"streak" json:"streak"`
	Points            int                  `bson:"points" json:"points"`                         // Suppressed in API responses (always 0)
	ProductivityScore int                  `bson:"productivity_score" json:"productivity_score"` // Public-facing score
	PostsMade         int                  `bson:"posts_made" json:"posts_made"`                 // Stored field in users collection
	Song              *types.Song          `bson:"song,omitempty" json:"song,omitempty"`
	Friends           []primitive.ObjectID `bson:"friends" json:"friends"`
	// Relationship information - only included when viewing another user's profile
	Relationship   *RelationshipInfo    `bson:"-" json:"relationship,omitempty"`
	Tasks          []types.TaskDocument `bson:"tasks" json:"tasks,omitempty"`
	CompletedTasks []types.TaskDocument `bson:"-" json:"completed_tasks,omitempty"`
	// Today's ring state - included for connected users and self
	RingState *rings.RingState `bson:"-" json:"ring_state,omitempty"`
}

// RelationshipInfo contains details about the relationship between users
type RelationshipInfo struct {
	Status    RelationshipStatus `json:"status"`
	RequestID *string            `json:"request_id,omitempty"` // ID of the connection request if applicable
}

// sanitizeForResponse hides internal metrics from the API response.
// Points are always hidden. Streak is hidden when viewing another user's profile
// (it is only visible to the user themselves via productivity_score).
func (p *ProfileDocument) sanitizeForResponse(isSelf bool) {
	p.Points = 0
	if !isSelf {
		p.Streak = 0
	}
}

type UpdateProfileDocument struct {
	DisplayName    string      `bson:"display_name,omitempty" json:"display_name,omitempty"`
	Handle         string      `bson:"handle,omitempty" json:"handle,omitempty"`
	ProfilePicture *string     `bson:"profile_picture,omitempty" json:"profile_picture,omitempty"`
	Song           *types.Song `bson:"song,omitempty" json:"song,omitempty"`
}

/*
Profile Service to be used by Profile Handler to interact with the
Database layer of the application
*/

type Service struct {
	Profiles       *mongo.Collection
	Connections    *mongo.Collection
	Tasks          *mongo.Collection
	CompletedTasks *mongo.Collection
	Posts          *mongo.Collection
	Groups         *mongo.Collection
	Blueprints     *mongo.Collection
	Notifications  *mongo.Collection
}
