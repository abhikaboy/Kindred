package calendar

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/oauth2"
)

// MockProvider implements the Provider interface for testing
type MockProvider struct {
	watchCalendarFunc func(ctx context.Context, token *oauth2.Token, calendarID string, channelID string, webhookURL string) (*WatchResponse, error)
	stopWatchFunc     func(ctx context.Context, token *oauth2.Token, channelID string, resourceID string) error
	listCalendarsFunc func(ctx context.Context, token *oauth2.Token) ([]CalendarInfo, error)
}

func (m *MockProvider) GenerateAuthURL(userID string) string {
	return "https://example.com/auth"
}

func (m *MockProvider) ExchangeCode(ctx context.Context, code string) (*oauth2.Token, error) {
	return &oauth2.Token{}, nil
}

func (m *MockProvider) RefreshToken(ctx context.Context, refreshToken string) (*oauth2.Token, error) {
	return &oauth2.Token{}, nil
}

func (m *MockProvider) GetAccountInfo(ctx context.Context, token *oauth2.Token) (AccountInfo, error) {
	return AccountInfo{}, nil
}

func (m *MockProvider) ListCalendars(ctx context.Context, token *oauth2.Token) ([]CalendarInfo, error) {
	if m.listCalendarsFunc != nil {
		return m.listCalendarsFunc(ctx, token)
	}
	return []CalendarInfo{}, nil
}

func (m *MockProvider) FetchEvents(ctx context.Context, token *oauth2.Token, timeMin, timeMax time.Time) ([]ProviderEvent, error) {
	return []ProviderEvent{}, nil
}

func (m *MockProvider) CreateEvent(ctx context.Context, token *oauth2.Token, event ProviderEvent) (ProviderEvent, error) {
	return ProviderEvent{}, nil
}

func (m *MockProvider) UpdateEvent(ctx context.Context, token *oauth2.Token, eventID string, event ProviderEvent) (ProviderEvent, error) {
	return ProviderEvent{}, nil
}

func (m *MockProvider) DeleteEvent(ctx context.Context, token *oauth2.Token, eventID string) error {
	return nil
}

func (m *MockProvider) WatchCalendar(ctx context.Context, token *oauth2.Token, calendarID string, channelID string, webhookURL string) (*WatchResponse, error) {
	if m.watchCalendarFunc != nil {
		return m.watchCalendarFunc(ctx, token, calendarID, channelID, webhookURL)
	}
	return &WatchResponse{}, nil
}

func (m *MockProvider) StopWatch(ctx context.Context, token *oauth2.Token, channelID string, resourceID string) error {
	if m.stopWatchFunc != nil {
		return m.stopWatchFunc(ctx, token, channelID, resourceID)
	}
	return nil
}

func TestWatchResponse(t *testing.T) {
	now := time.Now()
	expiration := now.Add(30 * 24 * time.Hour)

	resp := &WatchResponse{
		ChannelID:  "test-channel-123",
		ResourceID: "test-resource-456",
		Expiration: expiration,
	}

	if resp.ChannelID != "test-channel-123" {
		t.Errorf("Expected ChannelID 'test-channel-123', got '%s'", resp.ChannelID)
	}

	if resp.ResourceID != "test-resource-456" {
		t.Errorf("Expected ResourceID 'test-resource-456', got '%s'", resp.ResourceID)
	}

	if !resp.Expiration.Equal(expiration) {
		t.Errorf("Expected Expiration %v, got %v", expiration, resp.Expiration)
	}
}

func TestWatchChannelModel(t *testing.T) {
	now := time.Now()
	expiration := now.Add(30 * 24 * time.Hour)

	watch := WatchChannel{
		CalendarID: "primary",
		ChannelID:  "channel-123",
		ResourceID: "resource-456",
		Expiration: expiration,
		CreatedAt:  now,
	}

	if watch.CalendarID != "primary" {
		t.Errorf("Expected CalendarID 'primary', got '%s'", watch.CalendarID)
	}

	if watch.ChannelID != "channel-123" {
		t.Errorf("Expected ChannelID 'channel-123', got '%s'", watch.ChannelID)
	}

	if watch.ResourceID != "resource-456" {
		t.Errorf("Expected ResourceID 'resource-456', got '%s'", watch.ResourceID)
	}

	if !watch.Expiration.Equal(expiration) {
		t.Errorf("Expected Expiration %v, got %v", expiration, watch.Expiration)
	}

	if !watch.CreatedAt.Equal(now) {
		t.Errorf("Expected CreatedAt %v, got %v", now, watch.CreatedAt)
	}
}

func TestWatchChannelExpiration(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name       string
		expiration time.Time
		threshold  time.Time
		isExpiring bool
	}{
		{
			name:       "expiring in 2 days",
			expiration: now.Add(2 * 24 * time.Hour),
			threshold:  now.Add(3 * 24 * time.Hour),
			isExpiring: true,
		},
		{
			name:       "expiring in 5 days",
			expiration: now.Add(5 * 24 * time.Hour),
			threshold:  now.Add(3 * 24 * time.Hour),
			isExpiring: false,
		},
		{
			name:       "already expired",
			expiration: now.Add(-1 * time.Hour),
			threshold:  now.Add(3 * 24 * time.Hour),
			isExpiring: true,
		},
		{
			name:       "expiring in exactly 3 days",
			expiration: now.Add(3 * 24 * time.Hour),
			threshold:  now.Add(3 * 24 * time.Hour),
			isExpiring: false, // Before, not equal
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			watch := WatchChannel{
				Expiration: tt.expiration,
			}

			isExpiring := watch.Expiration.Before(tt.threshold)

			if isExpiring != tt.isExpiring {
				t.Errorf("Expected isExpiring to be %v, got %v", tt.isExpiring, isExpiring)
			}
		})
	}
}

func TestMockProviderWatchCalendar(t *testing.T) {
	ctx := context.Background()
	token := &oauth2.Token{AccessToken: "test-token"}
	expiration := time.Now().Add(30 * 24 * time.Hour)

	mock := &MockProvider{
		watchCalendarFunc: func(ctx context.Context, token *oauth2.Token, calendarID string, channelID string, webhookURL string) (*WatchResponse, error) {
			return &WatchResponse{
				ChannelID:  channelID,
				ResourceID: "resource-123",
				Expiration: expiration,
			}, nil
		},
	}

	resp, err := mock.WatchCalendar(ctx, token, "primary", "channel-456", "https://example.com/webhook")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if resp.ChannelID != "channel-456" {
		t.Errorf("Expected ChannelID 'channel-456', got '%s'", resp.ChannelID)
	}

	if resp.ResourceID != "resource-123" {
		t.Errorf("Expected ResourceID 'resource-123', got '%s'", resp.ResourceID)
	}

	if !resp.Expiration.Equal(expiration) {
		t.Errorf("Expected Expiration %v, got %v", expiration, resp.Expiration)
	}
}

func TestMockProviderStopWatch(t *testing.T) {
	ctx := context.Background()
	token := &oauth2.Token{AccessToken: "test-token"}

	stopCalled := false
	mock := &MockProvider{
		stopWatchFunc: func(ctx context.Context, token *oauth2.Token, channelID string, resourceID string) error {
			stopCalled = true
			if channelID != "channel-123" {
				t.Errorf("Expected channelID 'channel-123', got '%s'", channelID)
			}
			if resourceID != "resource-456" {
				t.Errorf("Expected resourceID 'resource-456', got '%s'", resourceID)
			}
			return nil
		},
	}

	err := mock.StopWatch(ctx, token, "channel-123", "resource-456")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if !stopCalled {
		t.Error("Expected StopWatch to be called")
	}
}

func TestWebhookURLFormat(t *testing.T) {
	connectionID := primitive.NewObjectID()
	webhookBaseURL := "https://api.example.com/v1/calendar/webhook"

	expectedURL := webhookBaseURL + "/" + connectionID.Hex()

	tests := []struct {
		name           string
		baseURL        string
		connectionID   primitive.ObjectID
		expectedFormat string
	}{
		{
			name:           "standard format",
			baseURL:        "https://api.example.com/v1/calendar/webhook",
			connectionID:   connectionID,
			expectedFormat: expectedURL,
		},
		{
			name:           "with trailing slash",
			baseURL:        "https://api.example.com/v1/calendar/webhook/",
			connectionID:   connectionID,
			expectedFormat: "https://api.example.com/v1/calendar/webhook//" + connectionID.Hex(),
		},
		{
			name:           "localhost",
			baseURL:        "http://localhost:8080/v1/calendar/webhook",
			connectionID:   connectionID,
			expectedFormat: "http://localhost:8080/v1/calendar/webhook/" + connectionID.Hex(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// This tests the URL format we expect to use
			actualURL := tt.baseURL + "/" + tt.connectionID.Hex()
			if actualURL != tt.expectedFormat {
				t.Errorf("Expected URL '%s', got '%s'", tt.expectedFormat, actualURL)
			}
		})
	}
}

func TestWatchChannelValidation(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name        string
		watch       WatchChannel
		channelID   string
		resourceID  string
		shouldMatch bool
	}{
		{
			name: "matching channel and resource",
			watch: WatchChannel{
				CalendarID: "primary",
				ChannelID:  "channel-123",
				ResourceID: "resource-456",
				Expiration: now.Add(30 * 24 * time.Hour),
				CreatedAt:  now,
			},
			channelID:   "channel-123",
			resourceID:  "resource-456",
			shouldMatch: true,
		},
		{
			name: "mismatched channel ID",
			watch: WatchChannel{
				CalendarID: "primary",
				ChannelID:  "channel-123",
				ResourceID: "resource-456",
				Expiration: now.Add(30 * 24 * time.Hour),
				CreatedAt:  now,
			},
			channelID:   "channel-999",
			resourceID:  "resource-456",
			shouldMatch: false,
		},
		{
			name: "mismatched resource ID",
			watch: WatchChannel{
				CalendarID: "primary",
				ChannelID:  "channel-123",
				ResourceID: "resource-456",
				Expiration: now.Add(30 * 24 * time.Hour),
				CreatedAt:  now,
			},
			channelID:   "channel-123",
			resourceID:  "resource-999",
			shouldMatch: false,
		},
		{
			name: "both mismatched",
			watch: WatchChannel{
				CalendarID: "primary",
				ChannelID:  "channel-123",
				ResourceID: "resource-456",
				Expiration: now.Add(30 * 24 * time.Hour),
				CreatedAt:  now,
			},
			channelID:   "channel-999",
			resourceID:  "resource-999",
			shouldMatch: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches := tt.watch.ChannelID == tt.channelID && tt.watch.ResourceID == tt.resourceID

			if matches != tt.shouldMatch {
				t.Errorf("Expected match to be %v, got %v", tt.shouldMatch, matches)
			}
		})
	}
}
