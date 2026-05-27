package calendar

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func ptrTime(t time.Time) *time.Time { return &t }

func TestBuildProviderEventFromTask_TimedTask(t *testing.T) {
	task := &types.TaskDocument{
		ID:        primitive.NewObjectID(),
		Content:   "Standup",
		StartTime: ptrTime(time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)),
		Deadline:  ptrTime(time.Date(2026, 6, 1, 10, 30, 0, 0, time.UTC)),
		Active:    true,
	}

	ev, err := BuildProviderEventFromTask(task, "cal-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Summary != "Standup" {
		t.Fatalf("summary: got %q want %q", ev.Summary, "Standup")
	}
	if ev.IsAllDay {
		t.Fatalf("timed task should not be all-day")
	}
	if !ev.StartTime.Equal(*task.StartTime) {
		t.Fatalf("start mismatch")
	}
	if !ev.EndTime.Equal(*task.Deadline) {
		t.Fatalf("end mismatch")
	}
	if ev.ExtendedProperties["kindred_task_id"] != task.ID.Hex() {
		t.Fatalf("missing kindred_task_id tag")
	}
	if ev.ExtendedProperties["kindred_origin"] != "push" {
		t.Fatalf("missing kindred_origin tag")
	}
	if ev.CalendarID != "cal-1" {
		t.Fatalf("calendar id not propagated")
	}
}

func TestBuildProviderEventFromTask_AllDay(t *testing.T) {
	// StartDate set, StartTime nil → all-day
	task := &types.TaskDocument{
		ID:        primitive.NewObjectID(),
		Content:   "Conference",
		StartDate: ptrTime(time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)),
		Deadline:  ptrTime(time.Date(2026, 6, 2, 0, 0, 0, 0, time.UTC)),
		Active:    true,
	}
	ev, err := BuildProviderEventFromTask(task, "cal-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ev.IsAllDay {
		t.Fatalf("expected all-day")
	}
}

func TestBuildProviderEventFromTask_DeadlineOnly(t *testing.T) {
	// Deadline set, no StartTime, no StartDate → all-day event on deadline date with "Due: " prefix.
	task := &types.TaskDocument{
		ID:       primitive.NewObjectID(),
		Content:  "File taxes",
		Deadline: ptrTime(time.Date(2026, 4, 15, 0, 0, 0, 0, time.UTC)),
		Active:   true,
	}
	ev, err := BuildProviderEventFromTask(task, "cal-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ev.IsAllDay {
		t.Fatalf("deadline-only should be all-day")
	}
	if ev.Summary != "Due: File taxes" {
		t.Fatalf("summary: got %q", ev.Summary)
	}
}

func TestBuildProviderEventFromTask_Completed(t *testing.T) {
	task := &types.TaskDocument{
		ID:        primitive.NewObjectID(),
		Content:   "Standup",
		StartTime: ptrTime(time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)),
		Deadline:  ptrTime(time.Date(2026, 6, 1, 10, 30, 0, 0, time.UTC)),
		Active:    false,
	}
	ev, err := BuildProviderEventFromTask(task, "cal-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Summary != "✓ Standup" {
		t.Fatalf("expected check prefix, got %q", ev.Summary)
	}
}

func TestBuildProviderEventFromTask_NoDate(t *testing.T) {
	task := &types.TaskDocument{
		ID:      primitive.NewObjectID(),
		Content: "Sometime soon",
	}
	_, err := BuildProviderEventFromTask(task, "cal-1")
	if err == nil {
		t.Fatalf("expected error for undated task")
	}
}

func TestParseCategoryIntegration(t *testing.T) {
	connID := primitive.NewObjectID()
	in := "gcal:" + connID.Hex() + ":primary"
	gotConn, gotCal, ok := parseCategoryIntegration(in)
	if !ok {
		t.Fatalf("expected ok")
	}
	if gotConn != connID {
		t.Fatalf("conn mismatch")
	}
	if gotCal != "primary" {
		t.Fatalf("cal mismatch: %q", gotCal)
	}

	if _, _, ok := parseCategoryIntegration("notgcal:foo:bar"); ok {
		t.Fatalf("expected !ok for non-gcal prefix")
	}
	if _, _, ok := parseCategoryIntegration("gcal:notahex:cal"); ok {
		t.Fatalf("expected !ok for invalid connection id")
	}
}
