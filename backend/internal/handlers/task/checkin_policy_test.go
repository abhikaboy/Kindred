package task

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestCheckinHour(t *testing.T) {
	cases := []struct {
		peak *int
		want int
	}{
		{nil, CheckinDefaultHour},
		{intp(14), 13},
		{intp(6), CheckinEarliestHour},  // early bird: never before 9
		{intp(23), CheckinLatestHour},   // night owl: never after 20
		{intp(10), CheckinEarliestHour}, // 9 exactly
	}
	for _, c := range cases {
		if got := CheckinHour(c.peak); got != c.want {
			t.Errorf("CheckinHour(%v) = %d, want %d", c.peak, got, c.want)
		}
	}
}

func TestCheckinMinuteIsStable(t *testing.T) {
	id := primitive.NewObjectID()
	m := CheckinMinute(id)
	if m < 0 || m > 59 {
		t.Fatalf("minute out of range: %d", m)
	}
	if CheckinMinute(id) != m {
		t.Fatal("minute changed between calls")
	}
}

func TestEvaluateCheckin(t *testing.T) {
	loc := time.UTC
	now := time.Date(2026, 9, 29, 10, 15, 0, 0, loc)
	ago := func(d time.Duration) *time.Time { t := now.Add(-d); return &t }
	day := 24 * time.Hour

	cases := []struct {
		name  string
		state CheckinState
		want  CheckinSkip
	}{
		{"off", CheckinState{Frequency: "none"}, CheckinSkipOff},
		{"first ever", CheckinState{Frequency: "regularly"}, CheckinSend},
		{"regularly, sent yesterday", CheckinState{Frequency: "regularly", LastSentAt: ago(day), LastActiveAt: ago(day - time.Hour)}, CheckinSkipTooSoon},
		{"regularly, sent two days ago", CheckinState{Frequency: "regularly", LastSentAt: ago(2 * day), LastActiveAt: ago(2*day - time.Hour)}, CheckinSend},
		{"frequently, sent yesterday", CheckinState{Frequency: "frequently", LastSentAt: ago(day), LastActiveAt: ago(day - time.Hour)}, CheckinSend},
		{"occasionally, sent two days ago", CheckinState{Frequency: "occasionally", LastSentAt: ago(2 * day), LastActiveAt: ago(2*day - time.Hour)}, CheckinSkipTooSoon},
		{"reduced doubles the gap", CheckinState{Frequency: "frequently", ReduceFrequency: true, LastSentAt: ago(day), LastActiveAt: ago(day - time.Hour)}, CheckinSkipTooSoon},
		{"unknown frequency acts as regularly", CheckinState{Frequency: "", LastSentAt: ago(day)}, CheckinSkipTooSoon},
		{"one ignored is still fine", CheckinState{Frequency: "frequently", LastSentAt: ago(day), IgnoredInARow: 0}, CheckinSend},
		{"two ignored goes quiet", CheckinState{Frequency: "frequently", LastSentAt: ago(day), IgnoredInARow: 1}, CheckinSkipIgnored},
		{"quiet ends once they're back", CheckinState{Frequency: "frequently", LastSentAt: ago(3 * day), IgnoredInARow: 1, LastActiveAt: ago(day)}, CheckinSend},
		{"already active today", CheckinState{Frequency: "frequently", LastActiveAt: ago(time.Hour)}, CheckinSkipActive},
	}
	for _, c := range cases {
		if got := EvaluateCheckin(c.state, now, loc); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestNextIgnoredInARow(t *testing.T) {
	now := time.Now()
	sent := now.Add(-48 * time.Hour)
	after := now.Add(-24 * time.Hour)
	before := now.Add(-72 * time.Hour)

	if got := (CheckinState{}).NextIgnoredInARow(); got != 0 {
		t.Errorf("first check-in: got %d", got)
	}
	if got := (CheckinState{LastSentAt: &sent, IgnoredInARow: 1, LastActiveAt: &before}).NextIgnoredInARow(); got != 2 {
		t.Errorf("ignored again: got %d", got)
	}
	if got := (CheckinState{LastSentAt: &sent, IgnoredInARow: 1, LastActiveAt: &after}).NextIgnoredInARow(); got != 0 {
		t.Errorf("answered: got %d", got)
	}
}

func TestPickCheckinFocus(t *testing.T) {
	loc := time.UTC
	now := time.Date(2026, 9, 29, 10, 0, 0, 0, loc)
	today := time.Date(2026, 9, 29, 0, 0, 0, 0, loc)
	yesterday := today.AddDate(0, 0, -1)
	at := func(h int) *time.Time { t := today.Add(time.Duration(h) * time.Hour); return &t }
	cand := func(task types.TaskDocument) CheckinCandidate {
		if task.ID.IsZero() {
			task.ID = primitive.NewObjectID()
		}
		if task.Timestamp.IsZero() {
			task.Timestamp = yesterday
		}
		return CheckinCandidate{Task: task, CategoryID: primitive.NewObjectID()}
	}

	t.Run("nothing on today", func(t *testing.T) {
		future := today.AddDate(0, 0, 3)
		got := PickCheckinFocus([]CheckinCandidate{cand(types.TaskDocument{Content: "later", Deadline: &future})}, now, loc)
		if got != nil {
			t.Fatalf("expected nil, got %+v", got)
		}
	})

	t.Run("due today beats planned today", func(t *testing.T) {
		got := PickCheckinFocus([]CheckinCandidate{
			cand(types.TaskDocument{Content: "planned", StartDate: at(0)}),
			cand(types.TaskDocument{Content: "due", Deadline: at(18)}),
		}, now, loc)
		if got == nil || got.Content != "due" || got.Kind != CheckinFocusDueToday {
			t.Fatalf("got %+v", got)
		}
	})

	t.Run("new task defaulted to today is not named", func(t *testing.T) {
		got := PickCheckinFocus([]CheckinCandidate{
			cand(types.TaskDocument{Content: "just made", StartDate: at(0), Timestamp: today.Add(time.Hour)}),
		}, now, loc)
		if got != nil {
			t.Fatalf("expected nil, got %+v", got)
		}
	})

	t.Run("tasks with their own nudge are left out", func(t *testing.T) {
		got := PickCheckinFocus([]CheckinCandidate{
			cand(types.TaskDocument{Content: "reminder", Deadline: at(18), Reminders: []*types.Reminder{{TriggerTime: *at(15)}}}),
			cand(types.TaskDocument{Content: "timed", StartDate: at(0), StartTime: at(14)}),
			cand(types.TaskDocument{Content: "plan", Deadline: at(18), Plan: &types.TaskPlan{Step: "open it", At: *at(16)}}),
			cand(types.TaskDocument{Content: "parked", Deadline: at(18), ParkedAt: &yesterday}),
		}, now, loc)
		if got != nil {
			t.Fatalf("expected nil, got %+v", got)
		}
	})

	t.Run("a reminder that already fired doesn't block", func(t *testing.T) {
		got := PickCheckinFocus([]CheckinCandidate{
			cand(types.TaskDocument{Content: "fired", Deadline: at(18), Reminders: []*types.Reminder{{TriggerTime: *at(8), Sent: true}}}),
		}, now, loc)
		if got == nil || got.Content != "fired" {
			t.Fatalf("got %+v", got)
		}
	})

	t.Run("an automatic follow-up doesn't block", func(t *testing.T) {
		got := PickCheckinFocus([]CheckinCandidate{
			cand(types.TaskDocument{Content: "due", Deadline: at(12), Reminders: []*types.Reminder{{TriggerTime: *at(15), Type: FollowUpReminderType}}}),
		}, now, loc)
		if got == nil || got.Content != "due" {
			t.Fatalf("got %+v", got)
		}
	})

	t.Run("higher priority wins a tie", func(t *testing.T) {
		got := PickCheckinFocus([]CheckinCandidate{
			cand(types.TaskDocument{Content: "low", Deadline: at(18), Priority: 1}),
			cand(types.TaskDocument{Content: "high", Deadline: at(18), Priority: 3}),
		}, now, loc)
		if got == nil || got.Content != "high" {
			t.Fatalf("got %+v", got)
		}
	})
}

func TestCheckinMessageHasNoCounts(t *testing.T) {
	title, body := CheckinMessage(CheckinFocus{Content: "File taxes", Kind: CheckinFocusDueToday})
	if title != "File taxes" || body == "" {
		t.Fatalf("got %q / %q", title, body)
	}
}
