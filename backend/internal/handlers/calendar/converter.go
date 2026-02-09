package calendar

import (
	"fmt"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ConvertEventToTaskParams converts a calendar event to task creation parameters
func ConvertEventToTaskParams(event ProviderEvent, userID, categoryID primitive.ObjectID) task.CreateTaskParams {
	// Build notes from event details
	notes := buildEventNotes(event)

	// Set integration field for duplicate prevention
	integration := fmt.Sprintf("gcal:%s:%s", event.CalendarID, event.ID)

	// Default active to true
	active := true

	params := task.CreateTaskParams{
		Priority:    2,                      // Default medium priority
		Content:     event.Summary,          // Event title becomes task title
		Value:       5.0,                    // Default medium value
		Recurring:   false,                  // Calendar events are not recurring tasks
		Public:      false,                  // Calendar events are private by default
		Active:      &active,                // Task is active
		Notes:       notes,                  // Formatted event details
		Integration: integration,            // Unique identifier for duplicate prevention
		Checklist:   []task.ChecklistItem{}, // Empty checklist
		Reminders:   []*task.Reminder{},     // Empty reminders (could be populated from event reminders)
	}

	// Handle all-day events
	if event.IsAllDay {
		// For all-day events, only set StartDate and Deadline (no time components)
		startDate := event.StartTime
		deadline := event.EndTime
		params.StartDate = &startDate
		params.Deadline = &deadline
	} else {
		// For timed events, set both date and time fields
		startTime := event.StartTime
		startDate := time.Date(event.StartTime.Year(), event.StartTime.Month(), event.StartTime.Day(), 0, 0, 0, 0, event.StartTime.Location())
		deadline := event.EndTime

		params.StartTime = &startTime
		params.StartDate = &startDate
		params.Deadline = &deadline
	}

	return params
}

// buildEventNotes formats event details into task notes
func buildEventNotes(event ProviderEvent) string {
	var parts []string

	// Add calendar name
	if event.CalendarName != "" {
		parts = append(parts, fmt.Sprintf("Calendar: %s", event.CalendarName))
	}

	// Add description
	if event.Description != "" {
		parts = append(parts, fmt.Sprintf("Description: %s", event.Description))
	}

	// Add location
	if event.Location != "" {
		parts = append(parts, fmt.Sprintf("Location: %s", event.Location))
	}

	// Add attendees
	if len(event.Attendees) > 0 {
		parts = append(parts, fmt.Sprintf("Attendees: %s", strings.Join(event.Attendees, ", ")))
	}

	// Add status
	if event.Status != "" {
		parts = append(parts, fmt.Sprintf("Status: %s", event.Status))
	}

	return strings.Join(parts, "\n")
}
