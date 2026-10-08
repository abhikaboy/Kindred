package analytics

import (
	"strings"
	"testing"
	"time"
)

// A completion at 02:00 UTC Monday is 10 PM Sunday in New York: it must land
// in the previous local week and on Sunday's heatmap cell, not Monday's.
func TestComputeAnalytics_UsesUserTimezone(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Skip("tzdata unavailable")
	}
	now := time.Date(2025, 5, 14, 12, 0, 0, 0, ny) // Wednesday local
	lateSunday := time.Date(2025, 5, 12, 2, 0, 0, 0, time.UTC)
	resp := computeAnalytics(computeInput{
		Range:      RangeWeek,
		Now:        now,
		Categories: baseCategories(),
		Completed:  []AnalyticsTaskLite{task("school", lateSunday, nil, 0)},
	})
	if resp.Progress.Total != 0 {
		t.Errorf("progress.total = %d, want 0 (task is in last local week)", resp.Progress.Total)
	}
	if resp.Progress.PrevTotal != 1 {
		t.Errorf("progress.prevTotal = %d, want 1", resp.Progress.PrevTotal)
	}
	found := false
	for _, d := range resp.Heatmap.Days {
		if d.Count > 0 {
			found = true
			if d.Date != "2025-05-11" {
				t.Errorf("heatmap day = %s, want 2025-05-11 (local Sunday)", d.Date)
			}
		}
	}
	if !found {
		t.Error("heatmap missing the completion")
	}
}

func TestComputeBestTime_LocalHour(t *testing.T) {
	ny, _ := time.LoadLocation("America/New_York")
	if ny == nil {
		t.Skip("tzdata unavailable")
	}
	now := time.Date(2025, 5, 14, 23, 0, 0, 0, ny)
	var completed []AnalyticsTaskLite
	for i := 0; i < 12; i++ { // 13:00 UTC = 9 AM EDT, Tuesday
		completed = append(completed, task("school", time.Date(2025, 5, 13, 13, 0, 0, 0, time.UTC), nil, 0))
	}
	resp := computeAnalytics(computeInput{Range: RangeWeek, Now: now, Categories: baseCategories(), Completed: completed})
	if len(resp.BestTime.Cells) != 1 || resp.BestTime.Cells[0].Hour != 9 || resp.BestTime.Cells[0].Weekday != 1 {
		t.Fatalf("cells = %+v, want one Tue 9 AM cell", resp.BestTime.Cells)
	}
	if !resp.BestTime.HasPattern || !strings.Contains(resp.BestTime.Takeaway, "9 AM") {
		t.Errorf("takeaway = %q hasPattern=%v", resp.BestTime.Takeaway, resp.BestTime.HasPattern)
	}
}

func TestComputeBestTime_GatedOnThinData(t *testing.T) {
	wed18 := time.Date(2025, 5, 14, 18, 0, 0, 0, time.UTC)
	resp := computeAnalytics(computeInput{
		Range: RangeWeek, Now: fixedNow, Categories: baseCategories(),
		Completed: []AnalyticsTaskLite{task("school", wed18, nil, 0), task("school", wed18, nil, 0), task("school", wed18, nil, 0)},
	})
	if resp.BestTime.HasPattern {
		t.Error("hasPattern = true on 3 completions")
	}
	if strings.Contains(resp.BestTime.Takeaway, "peak time is") {
		t.Errorf("takeaway made a claim on thin data: %q", resp.BestTime.Takeaway)
	}
	if len(resp.BestTime.Cells) == 0 {
		t.Error("cells should still be returned as evidence")
	}
	if resp.PeakTime != nil {
		t.Errorf("peakTime = %+v, want nil on thin data", resp.PeakTime)
	}
}

func morningCompletions(n int) []AnalyticsTaskLite {
	out := []AnalyticsTaskLite{}
	for i := 0; i < n; i++ {
		day := fixedNow.AddDate(0, 0, -1-i%30)
		out = append(out, task("school", time.Date(day.Year(), day.Month(), day.Day(), 9+i%2, 15, 0, 0, time.UTC), nil, 0))
	}
	for i := 0; i < 10; i++ { // scattered noise
		day := fixedNow.AddDate(0, 0, -2-i)
		out = append(out, task("gym", time.Date(day.Year(), day.Month(), day.Day(), 13+i%8, 0, 0, 0, time.UTC), nil, 0))
	}
	return out
}

func TestComputePeakTime_Inferred(t *testing.T) {
	resp := computeAnalytics(computeInput{Range: RangeWeek, Now: fixedNow, Categories: baseCategories(), Completed: morningCompletions(20)})
	p := resp.PeakTime
	if p == nil {
		t.Fatal("peakTime = nil, want inferred 9 AM")
	}
	if p.Hour != 9 || p.Source != "inferred" || p.SampleSize != 30 {
		t.Errorf("peakTime = %+v", p)
	}
	if !strings.Contains(p.Reason, "around 9 AM") || !strings.Contains(p.Reason, "20 of your last 30") {
		t.Errorf("reason = %q", p.Reason)
	}
}

func TestComputePeakTime_StatedOverridesInferred(t *testing.T) {
	resp := computeAnalytics(computeInput{
		Range: RangeWeek, Now: fixedNow, Categories: baseCategories(),
		Completed:  morningCompletions(20),
		StatedPeak: &statedPeak{StartHour: 17, EndHour: 21},
	})
	p := resp.PeakTime
	if p == nil || p.Source != "stated" || p.Hour != 18 {
		t.Fatalf("peakTime = %+v, want stated 6 PM", p)
	}
	if !strings.Contains(p.Reason, "evenings") {
		t.Errorf("reason = %q", p.Reason)
	}

	// Stated works without any history, and adopts the inferred hour when it falls inside.
	resp = computeAnalytics(computeInput{
		Range: RangeWeek, Now: fixedNow, Categories: baseCategories(),
		Completed:  morningCompletions(20),
		StatedPeak: &statedPeak{StartHour: 6, EndHour: 12},
	})
	if resp.PeakTime == nil || resp.PeakTime.Hour != 9 {
		t.Errorf("peakTime = %+v, want 9 (inferred inside stated window)", resp.PeakTime)
	}
	resp = computeAnalytics(computeInput{Range: RangeWeek, Now: fixedNow, StatedPeak: &statedPeak{StartHour: 6, EndHour: 12}})
	if resp.PeakTime == nil || resp.PeakTime.Hour != 8 {
		t.Errorf("peakTime = %+v, want 8 with no history", resp.PeakTime)
	}
}
