package calendar

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CalendarProvider represents supported calendar providers
type CalendarProvider string

const (
	ProviderGoogle  CalendarProvider = "google"
	ProviderOutlook CalendarProvider = "outlook"
	ProviderApple   CalendarProvider = "apple"
)

// CalendarConnection stores OAuth connection to a calendar provider
type CalendarConnection struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID            primitive.ObjectID `bson:"user_id" json:"user_id"`
	Provider          CalendarProvider   `bson:"provider" json:"provider"`
	ProviderAccountID string             `bson:"provider_account_id" json:"provider_account_id"` // email or account ID
	AccessToken       string             `bson:"access_token" json:"-"`                          // Never expose in API
	RefreshToken      string             `bson:"refresh_token" json:"-"`                         // Never expose in API
	TokenExpiry       time.Time          `bson:"token_expiry" json:"-"`
	Scopes            []string           `bson:"scopes" json:"scopes"`
	IsPrimary         bool               `bson:"is_primary" json:"is_primary"` // User's main calendar
	LastSync          time.Time          `bson:"last_sync,omitempty" json:"last_sync"`
	WatchChannels     []WatchChannel     `bson:"watch_channels,omitempty" json:"watch_channels,omitempty"`
	CreatedAt         time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at" json:"updated_at"`
}

// WatchChannel stores Google Calendar watch channel metadata
type WatchChannel struct {
	CalendarID string    `bson:"calendar_id" json:"calendar_id"` // Google calendar ID
	ChannelID  string    `bson:"channel_id" json:"channel_id"`   // UUID we generate
	ResourceID string    `bson:"resource_id" json:"resource_id"` // Google's resource ID
	Expiration time.Time `bson:"expiration" json:"expiration"`   // When channel expires
	CreatedAt  time.Time `bson:"created_at" json:"created_at"`
}

// ProcessedEvents tracks which calendar events have been processed into tasks
// This prevents duplicate task creation regardless of task status (completed/deleted/etc)
type ProcessedEvents struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID       primitive.ObjectID `bson:"user_id" json:"user_id"`
	ConnectionID primitive.ObjectID `bson:"connection_id" json:"connection_id"`
	EventIDs     []string           `bson:"event_ids" json:"event_ids"` // Array of processed event integration IDs
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
}
