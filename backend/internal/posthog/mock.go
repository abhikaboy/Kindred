package posthog

import (
	"context"
	"sync"
)

// MockPosthogService is a mock implementation of PosthogService for testing
type MockPosthogService struct {
	Events   []Event
	mu       sync.Mutex
	Enabled  bool
	TrackErr error
}

// NewMock creates a new mock PostHog service
func NewMock() *MockPosthogService {
	return &MockPosthogService{
		Events:  make([]Event, 0),
		Enabled: true,
	}
}

// Track records an event in the mock
func (m *MockPosthogService) Track(ctx context.Context, event Event) error {
	if !m.Enabled {
		return nil
	}

	if m.TrackErr != nil {
		return m.TrackErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.Events = append(m.Events, event)
	return nil
}

// TrackRequest records a request event in the mock
func (m *MockPosthogService) TrackRequest(ctx context.Context, userID string, props EventProperties) error {
	category, eventName := CategorizeEndpoint(props.Method, props.Path)

	properties := map[string]interface{}{
		"method":      props.Method,
		"path":        props.Path,
		"status_code": props.StatusCode,
		"duration_ms": props.Duration.Milliseconds(),
	}

	if props.UserAgent != "" {
		properties["user_agent"] = props.UserAgent
	}
	if props.IP != "" {
		properties["ip"] = props.IP
	}
	if props.ErrorMessage != "" {
		properties["error_message"] = props.ErrorMessage
	}
	if props.Timezone != "" {
		properties["timezone"] = props.Timezone
	}

	event := Event{
		UserID:     userID,
		EventName:  eventName,
		Category:   category,
		Properties: properties,
	}

	return m.Track(ctx, event)
}

// Identify records a user identification in the mock
func (m *MockPosthogService) Identify(ctx context.Context, userID string, properties map[string]interface{}) error {
	if !m.Enabled {
		return nil
	}

	if m.TrackErr != nil {
		return m.TrackErr
	}

	// For mock purposes, we can track identify calls as special events
	m.mu.Lock()
	defer m.mu.Unlock()

	m.Events = append(m.Events, Event{
		UserID:     userID,
		EventName:  "$identify",
		Category:   "system",
		Properties: properties,
	})

	return nil
}

// GetEvents returns all tracked events (thread-safe)
func (m *MockPosthogService) GetEvents() []Event {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Return a copy to prevent race conditions
	events := make([]Event, len(m.Events))
	copy(events, m.Events)
	return events
}

// GetEventCount returns the number of tracked events
func (m *MockPosthogService) GetEventCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.Events)
}

// GetEventsByCategory returns all events for a specific category
func (m *MockPosthogService) GetEventsByCategory(category string) []Event {
	m.mu.Lock()
	defer m.mu.Unlock()

	var filtered []Event
	for _, event := range m.Events {
		if event.Category == category {
			filtered = append(filtered, event)
		}
	}
	return filtered
}

// GetEventsByName returns all events with a specific name
func (m *MockPosthogService) GetEventsByName(name string) []Event {
	m.mu.Lock()
	defer m.mu.Unlock()

	var filtered []Event
	for _, event := range m.Events {
		if event.EventName == name {
			filtered = append(filtered, event)
		}
	}
	return filtered
}

// Reset clears all tracked events
func (m *MockPosthogService) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Events = make([]Event, 0)
}
