package task

import (
	"testing"
	"time"
)

// Sunday, Sept 27 2026
var predNow = time.Date(2026, 9, 27, 10, 0, 0, 0, time.UTC)

func daysAgo(n int) time.Time { return predNow.Add(-time.Duration(n) * dayDuration) }

func kinds(s PredictionSignals) map[string]PredictionSignal {
	out := map[string]PredictionSignal{}
	for _, sig := range s.Signals {
		out[sig.Kind+":"+sig.CategoryID] = sig
	}
	return out
}

func TestBuildPredictionSignals(t *testing.T) {
	cats := []PredictionCategory{
		{ID: "fit", Name: "Fitness", Workspace: "Health", OpenCount: 0},
		{ID: "school", Name: "CS 101", Workspace: "School", OpenCount: 1},
		{ID: "home", Name: "Chores", Workspace: "Home", OpenCount: 0},
	}
	due := predNow.Add(2 * dayDuration)
	far := predNow.Add(20 * dayDuration)
	open := []PredictionOpenTask{
		{Content: "Midterm exam", CategoryID: "school", Deadline: &due},
		{Content: "Final project", CategoryID: "school", Deadline: &far},
	}
	history := []PredictionHistoryTask{
		{Content: "Submit visa form", CategoryID: "home", TimeCompleted: daysAgo(1)},
		{Content: "Leg day", CategoryID: "fit", TimeCompleted: daysAgo(4)},
		{Content: "Push day", CategoryID: "fit", TimeCompleted: daysAgo(6)},
		{Content: "Pull day", CategoryID: "fit", TimeCompleted: daysAgo(8)},
		{Content: "Leg day", CategoryID: "fit", TimeCompleted: daysAgo(10)},
		// Chores every Sunday
		{Content: "Laundry", CategoryID: "home", TimeCompleted: daysAgo(7)},
		{Content: "Laundry", CategoryID: "home", TimeCompleted: daysAgo(14)},
		{Content: "Laundry", CategoryID: "home", TimeCompleted: daysAgo(21)},
	}

	got := kinds(BuildPredictionSignals(cats, open, history, predNow, time.UTC))

	if _, ok := got["deadline:school"]; !ok {
		t.Error("expected a prep signal for the midterm due in 2 days")
	}
	if len(got) > 0 && got["deadline:school"].Reason != "Gets you ready for “Midterm exam”, due Tuesday" {
		t.Errorf("unexpected deadline reason %q", got["deadline:school"].Reason)
	}
	if _, ok := got["follow_up:home"]; !ok {
		t.Error("expected a follow-up signal for yesterday's visa form")
	}
	if sig, ok := got["category_rhythm:fit"]; !ok || sig.Reason != "Nothing queued in Fitness, usually every 2 days" {
		t.Errorf("expected Fitness rhythm signal, got %+v", sig)
	}
	if sig, ok := got["weekday:home"]; !ok || sig.Reason != "You usually get to Chores on Sundays" {
		t.Errorf("expected Sunday chores signal, got %+v", sig)
	}
	if _, ok := got["category_rhythm:school"]; ok {
		t.Error("a category with open tasks is not due")
	}
}

func TestFinalizePredictionsRejectsReplays(t *testing.T) {
	s := PredictionSignals{
		Signals: []PredictionSignal{
			{ID: "S1", Kind: "category_rhythm", CategoryID: "fit", Reason: "r1"},
			{ID: "S2", Kind: "follow_up", CategoryID: "home", Reason: "r2"},
			{ID: "S3", Kind: "deadline", CategoryID: "school", Reason: "r3"},
		},
		Categories:  []PredictionCategory{{ID: "fit"}, {ID: "home"}, {ID: "school"}},
		KnownTitles: []string{"Leg day", "Submit visa form", "Midterm exam"},
	}
	drafts := []predictionDraft{
		{Content: "leg day", SignalID: "S1"},                  // exact replay
		{Content: "Leg day workout", SignalID: "S1"},          // light rephrase
		{Content: "Plan next week's lifts", SignalID: "S1"},   // new
		{Content: "Another plan", SignalID: "S1"},             // signal already used
		{Content: "Book visa appointment", SignalID: "S2"},    // new
		{Content: "Make midterm cheat sheet", SignalID: "S9"}, // unknown signal
		{Content: "Make midterm cheat sheet", SignalID: "S3", CategoryID: "bogus"},
	}
	got := FinalizePredictions(drafts, s, 3)
	want := []TaskPrediction{
		{Content: "Plan next week's lifts", Reason: "r1", Kind: "category_rhythm", CategoryID: "fit"},
		{Content: "Book visa appointment", Reason: "r2", Kind: "follow_up", CategoryID: "home"},
		{Content: "Make midterm cheat sheet", Reason: "r3", Kind: "deadline", CategoryID: "school"},
	}
	if len(got) != len(want) {
		t.Fatalf("got %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("prediction %d: got %+v want %+v", i, got[i], want[i])
		}
	}
}
