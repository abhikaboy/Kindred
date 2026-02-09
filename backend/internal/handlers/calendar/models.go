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
	CreatedAt         time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt         time.Time          `bson:"updated_at" json:"updated_at"`
}
