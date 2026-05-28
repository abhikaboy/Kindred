package calendar

import (
	"errors"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
)

// ErrTaskNotPushable is returned when a task has no date and therefore can't
// be expressed as a calendar event.
var ErrTaskNotPushable = errors.New("task has no date and cannot be pushed to calendar")

// BuildProviderEventFromTask converts a task to a ProviderEvent destined for `calendarID`.
// Mapping rules:
//   - Timed (StartTime + Deadline set): timed event, [StartTime, Deadline]
//   - All-day (StartDate set, no StartTime): all-day event, [StartDate, Deadline or StartDate]
//   - Deadline-only (Deadline set, no StartTime/StartDate): all-day on deadline date, "Due: " prefix
//   - Completed (Active == false): same shape as above, "✓ " prefix on summary
//   - No date: returns ErrTaskNotPushable
func BuildProviderEventFromTask(task *types.TaskDocument, calendarID string) (ProviderEvent, error) {
	if task.StartTime == nil && task.StartDate == nil && task.Deadline == nil {
		return ProviderEvent{}, ErrTaskNotPushable
	}

	summary := task.Content
	deadlineOnly := task.StartTime == nil && task.StartDate == nil && task.Deadline != nil
	if deadlineOnly {
		summary = "Due: " + summary
	}

	completed := !task.Active
	if completed {
		summary = "✓ " + summary
	}

	ev := ProviderEvent{
		CalendarID: calendarID,
		Summary:    summary,
		ExtendedProperties: map[string]string{
			"kindred_task_id": task.ID.Hex(),
			"kindred_origin":  "push",
		},
	}

	switch {
	case task.StartTime != nil:
		ev.IsAllDay = false
		ev.StartTime = *task.StartTime
		if task.Deadline != nil {
			ev.EndTime = *task.Deadline
		} else {
			// Default to 30-minute block if a timed task has no deadline.
			ev.EndTime = task.StartTime.Add(30 * time.Minute)
		}
	case task.StartDate != nil:
		ev.IsAllDay = true
		ev.StartTime = *task.StartDate
		if task.Deadline != nil {
			ev.EndTime = *task.Deadline
		} else {
			ev.EndTime = *task.StartDate
		}
	default:
		// Deadline-only: all-day event on the deadline date.
		ev.IsAllDay = true
		ev.StartTime = *task.Deadline
		ev.EndTime = *task.Deadline
	}

	return ev, nil
}

// IsPushOriginEvent returns true if the event carries the kindred_origin=push marker,
// meaning Kindred wrote it. The pull-side sync uses this to skip its own writes.
func IsPushOriginEvent(ev ProviderEvent) bool {
	if ev.ExtendedProperties == nil {
		return false
	}
	return ev.ExtendedProperties["kindred_origin"] == "push"
}
