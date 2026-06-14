package analytics

import (
	"strings"
	"testing"
	"time"
)

func TestComputeBestTime_Peak(t *testing.T) {
	wed18 := time.Date(2025, 5, 14, 18, 0, 0, 0, time.UTC) // Wednesday 6 PM
	resp := computeAnalytics(computeInput{
		Range:      RangeWeek,
		Now:        fixedNow,
		Categories: baseCategories(),
		Completed: []AnalyticsTaskLite{
			task("school", wed18, nil, 0),
			task("school", wed18, nil, 0),
			task("intern", wed18, nil, 0),
		},
	})
	if resp.BestTime.MaxCount != 3 {
		t.Errorf("bestTime.maxCount = %d, want 3", resp.BestTime.MaxCount)
	}
	if !strings.Contains(resp.BestTime.Takeaway, "Wed") || !strings.Contains(resp.BestTime.Takeaway, "6 PM") {
		t.Errorf("bestTime.takeaway = %q, want to mention Wed + 6 PM", resp.BestTime.Takeaway)
	}
}

func TestComputeAttention_FlagsAndOrder(t *testing.T) {
	pastDue := ptr(fixedNow.AddDate(0, 0, -1))
	resp := computeAnalytics(computeInput{
		Range:      RangeWeek,
		Now:        fixedNow,
		Categories: baseCategories(),
		OpenTasks: []AnalyticsOpenTaskLite{
			{ID: "a", Title: "Past due task", CategoryID: "school", CreatedAt: fixedNow.AddDate(0, 0, -2), Deadline: pastDue},
			{ID: "b", Title: "Old no-deadline", CategoryID: "intern", CreatedAt: fixedNow.AddDate(0, 0, -10)},
			{ID: "c", Title: "Fresh", CategoryID: "gym", CreatedAt: fixedNow},
		},
	})
	if len(resp.Attention.Tasks) != 2 {
		t.Fatalf("attention tasks = %d, want 2 (fresh task excluded)", len(resp.Attention.Tasks))
	}
	if resp.Attention.Tasks[0].ID != "a" {
		t.Errorf("expected past-due task first, got %q", resp.Attention.Tasks[0].ID)
	}
	if !hasReason(resp.Attention.Tasks[0].Reasons, "Past due") {
		t.Errorf("first task missing 'Past due': %v", resp.Attention.Tasks[0].Reasons)
	}
}

func TestComputeAttention_RespectsWorkspaceScope(t *testing.T) {
	resp := computeAnalytics(computeInput{
		Range:           RangeWeek,
		Now:             fixedNow,
		WorkspaceFilter: "Work", // only Internship
		Categories:      baseCategories(),
		OpenTasks: []AnalyticsOpenTaskLite{
			{ID: "a", Title: "School old", CategoryID: "school", CreatedAt: fixedNow.AddDate(0, 0, -10)},
			{ID: "b", Title: "Intern old", CategoryID: "intern", CreatedAt: fixedNow.AddDate(0, 0, -10)},
		},
	})
	if len(resp.Attention.Tasks) != 1 || resp.Attention.Tasks[0].ID != "b" {
		t.Fatalf("workspace filter should keep only Internship task, got %+v", resp.Attention.Tasks)
	}
}

func TestComputeAnalytics_ExcludesProxyCategories(t *testing.T) {
	mon := time.Date(2025, 5, 12, 9, 0, 0, 0, time.UTC)
	resp := computeAnalytics(computeInput{
		Range:            RangeWeek,
		Now:              fixedNow,
		Categories:       baseCategories(),
		ProxyCategoryIDs: map[string]bool{"proxy": true},
		Completed: []AnalyticsTaskLite{
			task("school", mon, nil, 0),
			task("proxy", mon, nil, 0),
			task("proxy", mon, nil, 0),
		},
		OpenTasks: []AnalyticsOpenTaskLite{
			{ID: "p", Title: "Proxy old", CategoryID: "proxy", CreatedAt: fixedNow.AddDate(0, 0, -10)},
		},
	})
	if resp.Progress.Total != 1 {
		t.Errorf("progress total = %d, want 1 (proxy tasks excluded)", resp.Progress.Total)
	}
	for _, s := range resp.CategoryShare.Slices {
		if s.CategoryID == "proxy" {
			t.Errorf("proxy category should not appear in category share")
		}
	}
	if len(resp.Attention.Tasks) != 0 {
		t.Errorf("proxy open task should be excluded from attention, got %d", len(resp.Attention.Tasks))
	}
}

func TestComputeKudosEffectAndSupportCoverage(t *testing.T) {
	completed := time.Date(2025, 5, 13, 12, 0, 0, 0, time.UTC) // Tuesday, in the week window
	mk := func(kudos int, hours float64, tagged bool) AnalyticsTaskLite {
		return AnalyticsTaskLite{
			CategoryID:  "school",
			CreatedAt:   completed.Add(-time.Duration(hours * float64(time.Hour))),
			CompletedAt: completed,
			KudosCount:  kudos,
			HasTag:      tagged,
		}
	}
	cur := []AnalyticsTaskLite{
		mk(1, 1, false), mk(2, 2, false), mk(1, 1, false), // with kudos, fast
		mk(0, 10, false), mk(0, 12, false), mk(0, 11, false), // no kudos, slow
	}
	resp := computeAnalytics(computeInput{Range: RangeWeek, Now: fixedNow, Categories: baseCategories(), Completed: cur})

	ke := resp.KudosEffect
	if !ke.HasComparison {
		t.Fatalf("expected HasComparison true (with=%d without=%d)", ke.WithCount, ke.WithoutCount)
	}
	if ke.WithKudosMedianHours >= ke.WithoutKudosMedianHours {
		t.Errorf("with-kudos median %v should be < without %v", ke.WithKudosMedianHours, ke.WithoutKudosMedianHours)
	}
	if !strings.Contains(ke.Takeaway, "faster") {
		t.Errorf("kudos-effect takeaway = %q, want it to mention faster", ke.Takeaway)
	}

	sc := resp.SupportCoverage
	if sc.Total != 6 || sc.Supported != 3 || sc.Pct != 50 {
		t.Errorf("support coverage = %d/%d (%d%%), want 3/6 (50%%)", sc.Supported, sc.Total, sc.Pct)
	}
}
