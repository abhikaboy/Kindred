package task

import (
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func strp(s string) *string { return &s }
func intp(i int) *int       { return &i }

func TestFinalizeEnrichment(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	now := time.Date(2026, 9, 27, 10, 0, 0, 0, loc)
	cands := []EnrichCandidate{
		{ID: primitive.NewObjectID(), CategoryID: primitive.NewObjectID(), Content: "call dentist", Priority: 1, Value: 1},
		{ID: primitive.NewObjectID(), CategoryID: primitive.NewObjectID(), Content: "Pay rent", Priority: 1, Value: 1},
	}
	drafts := []enrichDraft{
		{TaskID: "T1", Content: strp("Call dentist"), StartDate: strp("2026-09-28"), StartTime: strp("09:30"), Reason: "Quick call"},
		{TaskID: "T1", Priority: intp(3)},                                           // duplicate id dropped
		{TaskID: "T9", StartDate: strp("2026-09-28")},                               // unknown id dropped
		{TaskID: "T2", StartDate: strp("2026-09-01"), Deadline: strp("2027-06-01")}, // past start and far deadline dropped
		{TaskID: "T2", Priority: intp(1)},                                           // no-op dropped
	}
	got := FinalizeEnrichment(drafts, cands, now, loc)
	if len(got) != 1 {
		t.Fatalf("want 1 change, got %d: %+v", len(got), got)
	}
	c := got[0]
	if c.TaskID != cands[0].ID.Hex() || *c.Updates.Content != "Call dentist" || c.Updates.StartTime == nil {
		t.Fatalf("unexpected change %+v", c)
	}
	if strings.Join(c.Summary, "; ") != `Rename to "Call dentist"; Start tomorrow at 9:30 AM` {
		t.Fatalf("unexpected summary %v", c.Summary)
	}
	if !strings.HasPrefix(EnrichOverview(got), "This will schedule 1 task") {
		t.Fatalf("unexpected overview %q", EnrichOverview(got))
	}
}
