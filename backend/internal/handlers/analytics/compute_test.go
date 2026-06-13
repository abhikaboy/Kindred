package analytics

import (
	"testing"
	"time"
)

// fixedNow is a Wednesday (2025-05-14) used as "now" across tests so week/month
// math is deterministic.
var fixedNow = time.Date(2025, 5, 14, 12, 0, 0, 0, time.UTC)

func ptr(t time.Time) *time.Time { return &t }

func task(catID string, completed time.Time, deadline *time.Time, kudos int) AnalyticsTaskLite {
	return AnalyticsTaskLite{CategoryID: catID, CompletedAt: completed, Deadline: deadline, KudosCount: kudos}
}

func baseCategories() []AnalyticsCategoryMeta {
	return []AnalyticsCategoryMeta{
		{ID: "school", Name: "School", Workspace: "Academics"},
		{ID: "intern", Name: "Internship", Workspace: "Work"},
		{ID: "gym", Name: "Gym", Workspace: "Personal"},
	}
}

func TestWindowBounds_Week(t *testing.T) {
	curStart, curEnd, prevStart, prevEnd, unit := windowBounds(RangeWeek, fixedNow)
	if unit != "day" {
		t.Fatalf("unit = %q, want day", unit)
	}
	// 2025-05-14 is a Wednesday; Monday of that week is 2025-05-12.
	if got := curStart.Format("2006-01-02"); got != "2025-05-12" {
		t.Errorf("curStart = %s, want 2025-05-12", got)
	}
	if got := curEnd.Format("2006-01-02"); got != "2025-05-19" {
		t.Errorf("curEnd = %s, want 2025-05-19", got)
	}
	if got := prevStart.Format("2006-01-02"); got != "2025-05-05" {
		t.Errorf("prevStart = %s, want 2025-05-05", got)
	}
	if !prevEnd.Equal(curStart) {
		t.Errorf("prevEnd should equal curStart")
	}
}

func TestWindowBounds_Month(t *testing.T) {
	curStart, curEnd, prevStart, _, unit := windowBounds(RangeMonth, fixedNow)
	if unit != "week" {
		t.Fatalf("unit = %q, want week", unit)
	}
	if got := curStart.Format("2006-01-02"); got != "2025-05-01" {
		t.Errorf("curStart = %s, want 2025-05-01", got)
	}
	if got := curEnd.Format("2006-01-02"); got != "2025-06-01" {
		t.Errorf("curEnd = %s, want 2025-06-01", got)
	}
	if got := prevStart.Format("2006-01-02"); got != "2025-04-01" {
		t.Errorf("prevStart = %s, want 2025-04-01", got)
	}
}

func TestLevelForCount(t *testing.T) {
	cases := map[int]int{0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 20: 4}
	for in, want := range cases {
		if got := levelForCount(in); got != want {
			t.Errorf("levelForCount(%d) = %d, want %d", in, got, want)
		}
	}
}

func TestPctChangeAndPctInt(t *testing.T) {
	if got := pctChange(0, 0); got != 0 {
		t.Errorf("pctChange(0,0) = %v, want 0", got)
	}
	if got := pctChange(0, 5); got != 100 {
		t.Errorf("pctChange(0,5) = %v, want 100", got)
	}
	if got := pctChange(10, 12); got != 20 {
		t.Errorf("pctChange(10,12) = %v, want 20", got)
	}
	if got := pctInt(2, 4); got != 50 {
		t.Errorf("pctInt(2,4) = %d, want 50", got)
	}
	if got := pctInt(1, 0); got != 0 {
		t.Errorf("pctInt(1,0) = %d, want 0", got)
	}
}

func TestComputeSignals_MomentumTimingSupport(t *testing.T) {
	// 3 done this week, 2 on time of 2 with deadlines.
	on := fixedNow
	dl := ptr(fixedNow.Add(24 * time.Hour)) // deadline in the future => on time
	cur := []AnalyticsTaskLite{
		task("school", on, dl, 1),
		task("school", on, dl, 0),
		task("gym", on, nil, 0),
	}
	prev := []AnalyticsTaskLite{task("school", on.AddDate(0, 0, -7), nil, 0)} // 1 prev

	sig := computeSignals(RangeWeek, cur, prev, 5, 3)
	if sig.Momentum.RawValue != 3 {
		t.Errorf("momentum raw = %v, want 3", sig.Momentum.RawValue)
	}
	if sig.Momentum.Value != "3 done" {
		t.Errorf("momentum value = %q", sig.Momentum.Value)
	}
	// 1 -> 3 is +200%
	if sig.Momentum.Delta != 200 {
		t.Errorf("momentum delta = %v, want 200", sig.Momentum.Delta)
	}
	if sig.Timing.Value != "100%" {
		t.Errorf("timing value = %q, want 100%%", sig.Timing.Value)
	}
	if sig.Support.Value != "5 Kudos" {
		t.Errorf("support value = %q, want 5 Kudos", sig.Support.Value)
	}
	if sig.Support.DeltaLabel != "+2 vs last week" {
		t.Errorf("support delta label = %q", sig.Support.DeltaLabel)
	}
}

func TestComputeAnalytics_WeekProgressBucketsAndShare(t *testing.T) {
	mon := time.Date(2025, 5, 12, 9, 0, 0, 0, time.UTC) // Monday
	tue := time.Date(2025, 5, 13, 9, 0, 0, 0, time.UTC)
	completed := []AnalyticsTaskLite{
		task("school", mon, nil, 0),
		task("school", tue, nil, 1),
		task("intern", tue, nil, 0),
		task("gym", mon, nil, 0),
	}
	in := computeInput{
		Range:      RangeWeek,
		Now:        fixedNow,
		Completed:  completed,
		Categories: baseCategories(),
	}
	resp := computeAnalytics(in)

	if resp.Progress.Total != 4 {
		t.Fatalf("progress total = %d, want 4", resp.Progress.Total)
	}
	if resp.Progress.BucketUnit != "day" {
		t.Errorf("bucket unit = %q, want day", resp.Progress.BucketUnit)
	}
	if len(resp.Progress.Buckets) != 7 {
		t.Fatalf("want 7 day buckets, got %d", len(resp.Progress.Buckets))
	}
	// Monday is bucket 0 with 2 done; Tuesday bucket 1 with 2 done.
	if resp.Progress.Buckets[0].Total != 2 {
		t.Errorf("Mon total = %d, want 2", resp.Progress.Buckets[0].Total)
	}
	if resp.Progress.Buckets[1].Total != 2 {
		t.Errorf("Tue total = %d, want 2", resp.Progress.Buckets[1].Total)
	}
	// Share: school leads with 2/4 = 50%.
	if len(resp.CategoryShare.Slices) == 0 || resp.CategoryShare.Slices[0].Name != "School" {
		t.Fatalf("expected School to lead share, got %+v", resp.CategoryShare.Slices)
	}
	if resp.CategoryShare.Slices[0].Pct != 50 {
		t.Errorf("School share = %v, want 50", resp.CategoryShare.Slices[0].Pct)
	}
}

func TestComputeAnalytics_WorkspaceFilter(t *testing.T) {
	mon := time.Date(2025, 5, 12, 9, 0, 0, 0, time.UTC)
	completed := []AnalyticsTaskLite{
		task("school", mon, nil, 0),
		task("intern", mon, nil, 0),
		task("gym", mon, nil, 0),
	}
	in := computeInput{
		Range:           RangeWeek,
		Now:             fixedNow,
		WorkspaceFilter: "Work",
		Completed:       completed,
		Categories:      baseCategories(),
	}
	resp := computeAnalytics(in)
	if resp.Progress.Total != 1 {
		t.Errorf("with Work filter, total = %d, want 1 (only Internship)", resp.Progress.Total)
	}
	if len(resp.CategoryShare.Slices) != 1 || resp.CategoryShare.Slices[0].Name != "Internship" {
		t.Errorf("expected only Internship slice, got %+v", resp.CategoryShare.Slices)
	}
}

func TestComputeCategoryHealth_StatusFromOnTime(t *testing.T) {
	mon := time.Date(2025, 5, 12, 9, 0, 0, 0, time.UTC)
	late := ptr(mon.Add(-time.Hour))  // completed after deadline => late
	onTime := ptr(mon.Add(time.Hour)) // completed before deadline => on time
	completed := []AnalyticsTaskLite{
		// school: 1 on-time of 1 with deadline => 100% healthy
		task("school", mon, onTime, 1),
		// intern: 0 on-time of 1 => 0% slipping
		task("intern", mon, late, 0),
	}
	in := computeInput{Range: RangeWeek, Now: fixedNow, Completed: completed, Categories: baseCategories()}
	resp := computeAnalytics(in)

	got := map[string]string{}
	for _, r := range resp.CategoryHealth.Rows {
		got[r.Name] = r.Status
	}
	if got["School"] != "healthy" {
		t.Errorf("School status = %q, want healthy", got["School"])
	}
	if got["Internship"] != "slipping" {
		t.Errorf("Internship status = %q, want slipping", got["Internship"])
	}
	// Slipping should sort above healthy.
	if resp.CategoryHealth.Rows[0].Name != "Internship" {
		t.Errorf("expected Internship (slipping) first, got %q", resp.CategoryHealth.Rows[0].Name)
	}
}

func TestComputeHabits_NoStreakWordAndRhythm(t *testing.T) {
	d := func(day int) time.Time { return time.Date(2025, 5, day, 8, 0, 0, 0, time.UTC) }
	habits := []AnalyticsHabitLite{
		{
			TemplateID:      "gym",
			Title:           "Gym",
			Frequency:       "weekly",
			Streak:          9,
			CompletionDates: []time.Time{d(12)},
		},
		{
			TemplateID:      "budget",
			Title:           "Budget Check-in",
			Frequency:       "weekly",
			Streak:          0,
			CompletionDates: []time.Time{},
		},
	}
	in := computeInput{Range: RangeWeek, Now: fixedNow, Habits: habits, Categories: baseCategories()}
	resp := computeAnalytics(in)

	if len(resp.Habits.Rows) != 2 {
		t.Fatalf("want 2 habit rows, got %d", len(resp.Habits.Rows))
	}
	for _, r := range resp.Habits.Rows {
		if containsStreak(r.RhythmLabel) {
			t.Errorf("rhythm label %q must not contain the word streak", r.RhythmLabel)
		}
	}
	if containsStreak(resp.Habits.Takeaway) {
		t.Errorf("habits takeaway %q must not contain the word streak", resp.Habits.Takeaway)
	}
	// Gym kept its weekly rhythm => label mentions weeks consistent.
	var gym AnalyticsHabitRow
	for _, r := range resp.Habits.Rows {
		if r.Title == "Gym" {
			gym = r
		}
	}
	if gym.RhythmLabel != "9 weeks consistent" {
		t.Errorf("gym rhythm = %q, want '9 weeks consistent'", gym.RhythmLabel)
	}
}

func TestComputeHeatmap_TrailingWindow(t *testing.T) {
	completed := []AnalyticsTaskLite{
		task("school", fixedNow, nil, 0),
		task("school", fixedNow.AddDate(0, 0, -1), nil, 0),
		task("school", fixedNow.AddDate(0, 0, -200), nil, 0), // outside 91d window
	}
	in := computeInput{Range: RangeWeek, Now: fixedNow, Completed: completed, Categories: baseCategories()}
	resp := computeAnalytics(in)
	if len(resp.Heatmap.Days) != heatmapDays {
		t.Fatalf("heatmap days = %d, want %d", len(resp.Heatmap.Days), heatmapDays)
	}
	if resp.Heatmap.Total != 2 {
		t.Errorf("heatmap total = %d, want 2 (the 200-day-old task excluded)", resp.Heatmap.Total)
	}
}

func containsStreak(s string) bool {
	lower := []rune(s)
	_ = lower
	return indexFold(s, "streak") >= 0
}

// indexFold is a tiny case-insensitive substring search to avoid importing
// strings just for the test assertion intent.
func indexFold(haystack, needle string) int {
	h := toLower(haystack)
	n := toLower(needle)
	for i := 0; i+len(n) <= len(h); i++ {
		if h[i:i+len(n)] == n {
			return i
		}
	}
	return -1
}

func toLower(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'A' && c <= 'Z' {
			b[i] = c + 32
		}
	}
	return string(b)
}
