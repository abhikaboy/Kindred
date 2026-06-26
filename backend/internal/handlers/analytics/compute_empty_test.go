package analytics

import (
	"encoding/json"
	"strings"
	"testing"
)

// With no completed tasks, every array field must serialize as [] (not null),
// so the frontend can iterate without null guards. Regression for the
// `segments: null` crash.
func TestComputeAnalytics_EmptyDataEmitsEmptySlices(t *testing.T) {
	resp := computeAnalytics(computeInput{
		Range:      RangeWeek,
		Now:        fixedNow,
		Completed:  nil,
		Categories: baseCategories(),
		Habits:     nil,
	})

	if resp.Progress.Buckets == nil {
		t.Fatal("progress.buckets is nil")
	}
	for i, b := range resp.Progress.Buckets {
		if b.Segments == nil {
			t.Errorf("bucket %d segments is nil, want empty slice", i)
		}
	}
	if resp.Progress.Legend == nil {
		t.Error("progress.legend is nil")
	}
	if resp.CategoryShare.Slices == nil {
		t.Error("categoryShare.slices is nil")
	}
	if resp.CategoryShare.OverTime == nil {
		t.Error("categoryShare.overTime is nil")
	}
	if resp.Heatmap.Days == nil {
		t.Error("heatmap.days is nil")
	}
	if resp.Habits.Rows == nil {
		t.Error("habits.rows is nil")
	}
	if resp.CategoryHealth.Rows == nil {
		t.Error("categoryHealth.rows is nil")
	}
	if resp.WorkspaceHealth.Rows == nil {
		t.Error("workspaceHealth.rows is nil")
	}

	// The marshaled payload must contain no JSON null arrays for these keys.
	blob, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	for _, bad := range []string{`"segments":null`, `"overTime":null`, `"buckets":null`, `"days":null`, `"rows":null`} {
		if strings.Contains(string(blob), bad) {
			t.Errorf("payload contains %s", bad)
		}
	}
}

// Month range produces weekly bands (previously only sixmonth did).
func TestComputeShare_MonthRangeHasBands(t *testing.T) {
	// 2025-05-12 is in week-of-month bucket 1 (days 8-14 -> index 1).
	mid := fixedNow // 2025-05-14
	resp := computeAnalytics(computeInput{
		Range:      RangeMonth,
		Now:        fixedNow,
		Completed:  []AnalyticsTaskLite{task("school", mid, nil, 0)},
		Categories: baseCategories(),
	})
	if len(resp.CategoryShare.OverTime) == 0 {
		t.Fatal("month range should emit weekly bands")
	}
}
