package calendar

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestConvertEventToTaskParams(t *testing.T) {
	userID := primitive.NewObjectID()
	categoryID := primitive.NewObjectID()
	location := time.UTC

	tests := []struct {
		name     string
		event    ProviderEvent
		expected func(task.CreateTaskParams) bool
	}{
		{
			name: "basic timed event",
			event: ProviderEvent{
				ID:           "event123",
				CalendarID:   "cal456",
				CalendarName: "Primary",
				Summary:      "Team Meeting",
				Description:  "Discuss Q1 goals",
				Location:     "Conference Room A",
				StartTime:    time.Date(2024, 3, 15, 10, 0, 0, 0, location),
				EndTime:      time.Date(2024, 3, 15, 11, 0, 0, 0, location),
				IsAllDay:     false,
				Attendees:    []string{"alice@example.com", "bob@example.com"},
				Status:       "confirmed",
			},
			expected: func(params task.CreateTaskParams) bool {
				if params.Content != "Team Meeting" {
					t.Errorf("Expected content 'Team Meeting', got '%s'", params.Content)
					return false
				}
				if params.Integration != "gcal:cal456:event123" {
					t.Errorf("Expected integration 'gcal:cal456:event123', got '%s'", params.Integration)
					return false
				}
				if params.Priority != 2 {
					t.Errorf("Expected priority 2, got %d", params.Priority)
					return false
				}
				if params.Value != 5.0 {
					t.Errorf("Expected value 5.0, got %f", params.Value)
					return false
				}
				if params.Recurring {
					t.Error("Expected recurring to be false")
					return false
				}
				if params.Public {
					t.Error("Expected public to be false")
					return false
				}
				if params.StartTime == nil {
					t.Error("Expected StartTime to be set")
					return false
				}
				if params.StartDate == nil {
					t.Error("Expected StartDate to be set")
					return false
				}
				if params.Deadline == nil {
					t.Error("Expected Deadline to be set")
					return false
				}
				if !params.StartTime.Equal(time.Date(2024, 3, 15, 10, 0, 0, 0, location)) {
					t.Errorf("Expected StartTime to be 2024-03-15 10:00:00, got %v", params.StartTime)
					return false
				}
				if !params.Deadline.Equal(time.Date(2024, 3, 15, 11, 0, 0, 0, location)) {
					t.Errorf("Expected Deadline to be 2024-03-15 11:00:00, got %v", params.Deadline)
					return false
				}
				// Check StartDate is date-only (midnight)
				expectedDate := time.Date(2024, 3, 15, 0, 0, 0, 0, location)
				if !params.StartDate.Equal(expectedDate) {
					t.Errorf("Expected StartDate to be 2024-03-15 00:00:00, got %v", params.StartDate)
					return false
				}
				return true
			},
		},
		{
			name: "all-day event",
			event: ProviderEvent{
				ID:           "event789",
				CalendarID:   "cal456",
				CalendarName: "Primary",
				Summary:      "Birthday Party",
				Description:  "John's birthday celebration",
				Location:     "Home",
				StartTime:    time.Date(2024, 3, 20, 0, 0, 0, 0, location),
				EndTime:      time.Date(2024, 3, 21, 0, 0, 0, 0, location),
				IsAllDay:     true,
				Attendees:    []string{"john@example.com"},
				Status:       "confirmed",
			},
			expected: func(params task.CreateTaskParams) bool {
				if params.Content != "Birthday Party" {
					t.Errorf("Expected content 'Birthday Party', got '%s'", params.Content)
					return false
				}
				if params.Integration != "gcal:cal456:event789" {
					t.Errorf("Expected integration 'gcal:cal456:event789', got '%s'", params.Integration)
					return false
				}
				// For all-day events, StartTime should NOT be set
				if params.StartTime != nil {
					t.Errorf("Expected StartTime to be nil for all-day event, got %v", params.StartTime)
					return false
				}
				// But StartDate and Deadline should be set
				if params.StartDate == nil {
					t.Error("Expected StartDate to be set")
					return false
				}
				if params.Deadline == nil {
					t.Error("Expected Deadline to be set")
					return false
				}
				if !params.StartDate.Equal(time.Date(2024, 3, 20, 0, 0, 0, 0, location)) {
					t.Errorf("Expected StartDate to be 2024-03-20, got %v", params.StartDate)
					return false
				}
				if !params.Deadline.Equal(time.Date(2024, 3, 21, 0, 0, 0, 0, location)) {
					t.Errorf("Expected Deadline to be 2024-03-21, got %v", params.Deadline)
					return false
				}
				return true
			},
		},
		{
			name: "event with no description or location",
			event: ProviderEvent{
				ID:           "event999",
				CalendarID:   "cal456",
				CalendarName: "Work",
				Summary:      "Quick Call",
				Description:  "",
				Location:     "",
				StartTime:    time.Date(2024, 3, 15, 14, 0, 0, 0, location),
				EndTime:      time.Date(2024, 3, 15, 14, 30, 0, 0, location),
				IsAllDay:     false,
				Attendees:    []string{},
				Status:       "confirmed",
			},
			expected: func(params task.CreateTaskParams) bool {
				if params.Content != "Quick Call" {
					t.Errorf("Expected content 'Quick Call', got '%s'", params.Content)
					return false
				}
				if params.Integration != "gcal:cal456:event999" {
					t.Errorf("Expected integration 'gcal:cal456:event999', got '%s'", params.Integration)
					return false
				}
				// Notes should only contain calendar name and status
				expectedNotes := "Calendar: Work\nStatus: confirmed"
				if params.Notes != expectedNotes {
					t.Errorf("Expected notes '%s', got '%s'", expectedNotes, params.Notes)
					return false
				}
				return true
			},
		},
		{
			name: "multi-day event",
			event: ProviderEvent{
				ID:           "event555",
				CalendarID:   "cal456",
				CalendarName: "Personal",
				Summary:      "Vacation",
				Description:  "Beach trip",
				Location:     "Hawaii",
				StartTime:    time.Date(2024, 7, 1, 9, 0, 0, 0, location),
				EndTime:      time.Date(2024, 7, 5, 17, 0, 0, 0, location),
				IsAllDay:     false,
				Attendees:    []string{},
				Status:       "confirmed",
			},
			expected: func(params task.CreateTaskParams) bool {
				if params.Content != "Vacation" {
					t.Errorf("Expected content 'Vacation', got '%s'", params.Content)
					return false
				}
				if params.StartTime == nil || params.Deadline == nil {
					t.Error("Expected both StartTime and Deadline to be set for multi-day event")
					return false
				}
				if !params.StartTime.Equal(time.Date(2024, 7, 1, 9, 0, 0, 0, location)) {
					t.Errorf("Expected StartTime to be 2024-07-01 09:00:00, got %v", params.StartTime)
					return false
				}
				if !params.Deadline.Equal(time.Date(2024, 7, 5, 17, 0, 0, 0, location)) {
					t.Errorf("Expected Deadline to be 2024-07-05 17:00:00, got %v", params.Deadline)
					return false
				}
				return true
			},
		},
		{
			name: "event with multiple attendees",
			event: ProviderEvent{
				ID:           "event111",
				CalendarID:   "cal456",
				CalendarName: "Primary",
				Summary:      "Team Standup",
				Description:  "Daily sync",
				Location:     "Zoom",
				StartTime:    time.Date(2024, 3, 15, 9, 0, 0, 0, location),
				EndTime:      time.Date(2024, 3, 15, 9, 15, 0, 0, location),
				IsAllDay:     false,
				Attendees:    []string{"alice@example.com", "bob@example.com", "charlie@example.com"},
				Status:       "confirmed",
			},
			expected: func(params task.CreateTaskParams) bool {
				expectedNotes := "Calendar: Primary\nDescription: Daily sync\nLocation: Zoom\nAttendees: alice@example.com, bob@example.com, charlie@example.com\nStatus: confirmed"
				if params.Notes != expectedNotes {
					t.Errorf("Expected notes:\n%s\n\nGot:\n%s", expectedNotes, params.Notes)
					return false
				}
				return true
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ConvertEventToTaskParams(tt.event, userID, categoryID)

			// Run custom validation
			if !tt.expected(result) {
				t.Errorf("Test '%s' failed validation", tt.name)
			}

			// Common validations for all tests
			if result.Active == nil || !*result.Active {
				t.Error("Expected Active to be true")
			}
			if len(result.Checklist) != 0 {
				t.Error("Expected empty Checklist")
			}
			if len(result.Reminders) != 0 {
				t.Error("Expected empty Reminders")
			}
		})
	}
}

func TestBuildEventNotes(t *testing.T) {
	tests := []struct {
		name     string
		event    ProviderEvent
		expected string
	}{
		{
			name: "all fields present",
			event: ProviderEvent{
				CalendarName: "Work Calendar",
				Description:  "Important meeting",
				Location:     "Room 101",
				Attendees:    []string{"alice@example.com", "bob@example.com"},
				Status:       "confirmed",
			},
			expected: "Calendar: Work Calendar\nDescription: Important meeting\nLocation: Room 101\nAttendees: alice@example.com, bob@example.com\nStatus: confirmed",
		},
		{
			name: "only calendar and status",
			event: ProviderEvent{
				CalendarName: "Personal",
				Description:  "",
				Location:     "",
				Attendees:    []string{},
				Status:       "tentative",
			},
			expected: "Calendar: Personal\nStatus: tentative",
		},
		{
			name: "no attendees",
			event: ProviderEvent{
				CalendarName: "Work",
				Description:  "Solo work",
				Location:     "Office",
				Attendees:    []string{},
				Status:       "confirmed",
			},
			expected: "Calendar: Work\nDescription: Solo work\nLocation: Office\nStatus: confirmed",
		},
		{
			name: "single attendee",
			event: ProviderEvent{
				CalendarName: "Primary",
				Description:  "1:1 meeting",
				Location:     "Zoom",
				Attendees:    []string{"manager@example.com"},
				Status:       "confirmed",
			},
			expected: "Calendar: Primary\nDescription: 1:1 meeting\nLocation: Zoom\nAttendees: manager@example.com\nStatus: confirmed",
		},
		{
			name: "empty event",
			event: ProviderEvent{
				CalendarName: "",
				Description:  "",
				Location:     "",
				Attendees:    []string{},
				Status:       "",
			},
			expected: "",
		},
		{
			name: "multiline description",
			event: ProviderEvent{
				CalendarName: "Work",
				Description:  "Line 1\nLine 2\nLine 3",
				Location:     "Office",
				Attendees:    []string{},
				Status:       "confirmed",
			},
			expected: "Calendar: Work\nDescription: Line 1\nLine 2\nLine 3\nLocation: Office\nStatus: confirmed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildEventNotes(tt.event)
			if result != tt.expected {
				t.Errorf("Expected:\n%s\n\nGot:\n%s", tt.expected, result)
			}
		})
	}
}

func TestConvertEventToTaskParams_IntegrationFormat(t *testing.T) {
	userID := primitive.NewObjectID()
	categoryID := primitive.NewObjectID()

	tests := []struct {
		name           string
		calendarID     string
		eventID        string
		expectedFormat string
	}{
		{
			name:           "standard IDs",
			calendarID:     "primary",
			eventID:        "abc123",
			expectedFormat: "gcal:primary:abc123",
		},
		{
			name:           "email as calendar ID",
			calendarID:     "user@example.com",
			eventID:        "xyz789",
			expectedFormat: "gcal:user@example.com:xyz789",
		},
		{
			name:           "complex calendar ID",
			calendarID:     "group.calendar.google.com_abc123",
			eventID:        "event_456",
			expectedFormat: "gcal:group.calendar.google.com_abc123:event_456",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event := ProviderEvent{
				ID:         tt.eventID,
				CalendarID: tt.calendarID,
				Summary:    "Test Event",
				StartTime:  time.Now(),
				EndTime:    time.Now().Add(time.Hour),
				IsAllDay:   false,
			}

			result := ConvertEventToTaskParams(event, userID, categoryID)

			if result.Integration != tt.expectedFormat {
				t.Errorf("Expected integration '%s', got '%s'", tt.expectedFormat, result.Integration)
			}
		})
	}
}

func TestConvertEventToTaskParams_TimeZones(t *testing.T) {
	userID := primitive.NewObjectID()
	categoryID := primitive.NewObjectID()

	// Test with different time zones
	pst, _ := time.LoadLocation("America/Los_Angeles")
	est, _ := time.LoadLocation("America/New_York")

	tests := []struct {
		name      string
		startTime time.Time
		endTime   time.Time
	}{
		{
			name:      "PST timezone",
			startTime: time.Date(2024, 3, 15, 10, 0, 0, 0, pst),
			endTime:   time.Date(2024, 3, 15, 11, 0, 0, 0, pst),
		},
		{
			name:      "EST timezone",
			startTime: time.Date(2024, 3, 15, 14, 0, 0, 0, est),
			endTime:   time.Date(2024, 3, 15, 15, 0, 0, 0, est),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event := ProviderEvent{
				ID:         "event123",
				CalendarID: "cal456",
				Summary:    "Test Event",
				StartTime:  tt.startTime,
				EndTime:    tt.endTime,
				IsAllDay:   false,
			}

			result := ConvertEventToTaskParams(event, userID, categoryID)

			if result.StartTime == nil {
				t.Error("Expected StartTime to be set")
				return
			}
			if result.Deadline == nil {
				t.Error("Expected Deadline to be set")
				return
			}

			// Verify times are preserved with correct timezone
			if !result.StartTime.Equal(tt.startTime) {
				t.Errorf("Expected StartTime %v, got %v", tt.startTime, result.StartTime)
			}
			if !result.Deadline.Equal(tt.endTime) {
				t.Errorf("Expected Deadline %v, got %v", tt.endTime, result.Deadline)
			}

			// Verify StartDate is in the same timezone but at midnight
			expectedDate := time.Date(tt.startTime.Year(), tt.startTime.Month(), tt.startTime.Day(), 0, 0, 0, 0, tt.startTime.Location())
			if !result.StartDate.Equal(expectedDate) {
				t.Errorf("Expected StartDate %v, got %v", expectedDate, result.StartDate)
			}
		})
	}
}

func TestConvertEventToTaskParams_EdgeCases(t *testing.T) {
	userID := primitive.NewObjectID()
	categoryID := primitive.NewObjectID()
	location := time.UTC

	tests := []struct {
		name  string
		event ProviderEvent
	}{
		{
			name: "empty summary",
			event: ProviderEvent{
				ID:         "event123",
				CalendarID: "cal456",
				Summary:    "",
				StartTime:  time.Date(2024, 3, 15, 10, 0, 0, 0, location),
				EndTime:    time.Date(2024, 3, 15, 11, 0, 0, 0, location),
				IsAllDay:   false,
			},
		},
		{
			name: "very long summary",
			event: ProviderEvent{
				ID:         "event123",
				CalendarID: "cal456",
				Summary:    "This is a very long event summary that might exceed normal length expectations and should still be handled correctly by the converter without any issues or truncation",
				StartTime:  time.Date(2024, 3, 15, 10, 0, 0, 0, location),
				EndTime:    time.Date(2024, 3, 15, 11, 0, 0, 0, location),
				IsAllDay:   false,
			},
		},
		{
			name: "special characters in summary",
			event: ProviderEvent{
				ID:         "event123",
				CalendarID: "cal456",
				Summary:    "Meeting @ 10:00 - Q&A Session (Important!)",
				StartTime:  time.Date(2024, 3, 15, 10, 0, 0, 0, location),
				EndTime:    time.Date(2024, 3, 15, 11, 0, 0, 0, location),
				IsAllDay:   false,
			},
		},
		{
			name: "event at midnight",
			event: ProviderEvent{
				ID:         "event123",
				CalendarID: "cal456",
				Summary:    "Midnight Event",
				StartTime:  time.Date(2024, 3, 15, 0, 0, 0, 0, location),
				EndTime:    time.Date(2024, 3, 15, 1, 0, 0, 0, location),
				IsAllDay:   false,
			},
		},
		{
			name: "event spanning midnight",
			event: ProviderEvent{
				ID:         "event123",
				CalendarID: "cal456",
				Summary:    "Late Night Event",
				StartTime:  time.Date(2024, 3, 15, 23, 0, 0, 0, location),
				EndTime:    time.Date(2024, 3, 16, 1, 0, 0, 0, location),
				IsAllDay:   false,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Should not panic or error
			result := ConvertEventToTaskParams(tt.event, userID, categoryID)

			// Basic validations
			if result.Integration == "" {
				t.Error("Expected integration to be set")
			}
			if result.Priority != 2 {
				t.Error("Expected default priority 2")
			}
			if result.Value != 5.0 {
				t.Error("Expected default value 5.0")
			}
		})
	}
}
