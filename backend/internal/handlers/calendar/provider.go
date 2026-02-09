package calendar

import (
	"context"
	"time"

	"golang.org/x/oauth2"
)

// Provider defines the interface all calendar providers must implement
type Provider interface {
	// OAuth methods
	GenerateAuthURL(userID string) string
	ExchangeCode(ctx context.Context, code string) (*oauth2.Token, error)
	RefreshToken(ctx context.Context, refreshToken string) (*oauth2.Token, error)

	// Account methods
	GetAccountInfo(ctx context.Context, token *oauth2.Token) (AccountInfo, error)

	// Calendar methods
	ListCalendars(ctx context.Context, token *oauth2.Token) ([]CalendarInfo, error)

	// Calendar event methods
	FetchEvents(ctx context.Context, token *oauth2.Token, timeMin, timeMax time.Time) ([]ProviderEvent, error)
	CreateEvent(ctx context.Context, token *oauth2.Token, event ProviderEvent) (ProviderEvent, error)
	UpdateEvent(ctx context.Context, token *oauth2.Token, eventID string, event ProviderEvent) (ProviderEvent, error)
	DeleteEvent(ctx context.Context, token *oauth2.Token, eventID string) error

	// Watch methods
	WatchCalendar(ctx context.Context, token *oauth2.Token, calendarID string, channelID string, webhookURL string) (*WatchResponse, error)
	StopWatch(ctx context.Context, token *oauth2.Token, channelID string, resourceID string) error
}

// AccountInfo represents provider account information
type AccountInfo struct {
	ID    string
	Email string
	Name  string
}

// CalendarInfo represents a calendar from the provider
type CalendarInfo struct {
	ID          string
	Name        string
	Description string
	IsPrimary   bool
	AccessRole  string // owner, writer, reader
}

// ProviderEvent represents a calendar event from any provider
type ProviderEvent struct {
	ID           string
	CalendarID   string
	CalendarName string
	Summary      string
	Description  string
	Location     string
	StartTime    time.Time
	EndTime      time.Time
	IsAllDay     bool
	Attendees    []string
	Status       string // confirmed, tentative, cancelled
}

// WatchResponse represents the response from creating a watch channel
type WatchResponse struct {
	ChannelID  string
	ResourceID string
	Expiration time.Time
}
