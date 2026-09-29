package analytics

import (
	"testing"
	"time"
)

func TestComputeAttention_SkipsSomeday(t *testing.T) {
	now := time.Date(2025, 5, 20, 12, 0, 0, 0, time.UTC)
	old := now.AddDate(0, 0, -30)
	open := []AnalyticsOpenTaskLite{
		{ID: "normal", Title: "Old task", CategoryID: "c", CreatedAt: old},
		{ID: "someday", Title: "Learn piano", CategoryID: "c", CreatedAt: old, Someday: true},
	}
	all := func(string) bool { return true }
	name := func(string) string { return "Cat" }
	got := computeAttention(open, all, name, name, now)
	if len(got.Tasks) != 1 || got.Tasks[0].ID != "normal" {
		t.Fatalf("want only the normal task flagged, got %+v", got.Tasks)
	}
}
