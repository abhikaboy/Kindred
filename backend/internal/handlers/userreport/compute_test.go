package userreport

import (
	"strings"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/analytics"
)

var ny, _ = time.LoadLocation("America/New_York")

// Wednesday, Oct 7 2026, noon in New York.
var now = time.Date(2026, 10, 7, 12, 0, 0, 0, ny)

func task(at time.Time, kudos int, openHours float64) analytics.AnalyticsTaskLite {
	return analytics.AnalyticsTaskLite{CategoryID: "c1", CompletedAt: at.UTC(), CreatedAt: at.Add(-time.Duration(openHours * float64(time.Hour))).UTC(), KudosCount: kudos}
}

// weekly puts n completions at 3 PM local on the Monday..Friday of each week ending before thisMon.
func weekly(perWeek []int) []analytics.AnalyticsTaskLite {
	thisMon := time.Date(2026, 10, 5, 15, 0, 0, 0, ny)
	out := []analytics.AnalyticsTaskLite{}
	for i, n := range perWeek { // perWeek[0] is the oldest
		ws := thisMon.AddDate(0, 0, -7*(len(perWeek)-i))
		for k := 0; k < n; k++ {
			out = append(out, task(ws.AddDate(0, 0, k%5), 0, 30))
		}
	}
	return out
}

func find(r UserReportResponse, kind string) *UserReportNoticed {
	for i := range r.Noticed {
		if r.Noticed[i].Kind == kind {
			return &r.Noticed[i]
		}
	}
	return nil
}

func hasNotYet(r UserReportResponse, sub string) bool {
	for _, s := range r.NotYet {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

func TestEmptyReport(t *testing.T) {
	r := compute(computeInput{Now: now})
	if len(r.Noticed) != 0 {
		t.Fatalf("expected nothing noticed, got %+v", r.Noticed)
	}
	if !hasNotYet(r, "Peak time needs 20 more finished tasks") || !hasNotYet(r, "weeks compare") {
		t.Fatalf("missing notYet rows: %v", r.NotYet)
	}
	if len(r.Known) < 6 || r.Known[0].Value != "0 in the last 90 days" {
		t.Fatalf("unexpected known: %+v", r.Known)
	}
	if r.RangeLabel != "Jul 10 – Oct 7" {
		t.Fatalf("range label %q", r.RangeLabel)
	}
}

func TestWeeksVsUsualGates(t *testing.T) {
	first := time.Date(2026, 8, 17, 9, 0, 0, 0, ny) // seven weeks before this Monday
	busy := compute(computeInput{Now: now, FirstActivity: &first, Corpus: analytics.Corpus{Completed: weekly([]int{5, 5, 5, 5, 5, 9, 9})}})
	n := find(busy, "weeks")
	if n == nil || n.Strength != "strong" || !strings.Contains(n.Headline, "busier") || !strings.Contains(n.Evidence, "usual 5") {
		t.Fatalf("busier not noticed: %+v", n)
	}
	first6 := first.AddDate(0, 0, 7)
	quiet := compute(computeInput{Now: now, FirstActivity: &first6, Corpus: analytics.Corpus{Completed: weekly([]int{6, 6, 6, 6, 2, 2})}})
	if q := find(quiet, "weeks"); q == nil || !strings.Contains(q.Headline, "quieter") || q.Action == nil || q.Action.Kind != "home" {
		t.Fatalf("quieter not noticed: %+v", q)
	}
	// Only three earlier weeks since first activity: gated.
	recent := now.AddDate(0, 0, -36)
	short := compute(computeInput{Now: now, FirstActivity: &recent, Corpus: analytics.Corpus{Completed: weekly([]int{5, 5, 5, 9, 9})}})
	if find(short, "weeks") != nil || !hasNotYet(short, "1 week more") {
		t.Fatalf("expected gate, got %+v / %v", short.Noticed, short.NotYet)
	}
	// A low usual makes no claim.
	low := compute(computeInput{Now: now, FirstActivity: &first, Corpus: analytics.Corpus{Completed: weekly([]int{1, 1, 1, 1, 1, 5, 5})}})
	if find(low, "weeks") != nil {
		t.Fatal("usual below the gate should not be compared")
	}
}

func TestHabitRunCountsRecovery(t *testing.T) {
	thisMon := time.Date(2026, 10, 5, 8, 0, 0, 0, ny)
	dates := []time.Time{}
	for w := 1; w <= 5; w++ { // five full weeks, five days each
		for d := 0; d < 5; d++ {
			dates = append(dates, thisMon.AddDate(0, 0, -7*w+d))
		}
	}
	r := compute(computeInput{Now: now, Corpus: analytics.Corpus{Habits: []analytics.AnalyticsHabitLite{{Title: "Stretch", Frequency: "daily", CompletionDates: dates}}}})
	n := find(r, "habit")
	if n == nil || !strings.Contains(n.Headline, "5 weeks in") || !strings.Contains(n.Evidence, "came back") {
		t.Fatalf("habit run: %+v", n)
	}
	short := compute(computeInput{Now: now, Corpus: analytics.Corpus{Habits: []analytics.AnalyticsHabitLite{{Title: "Stretch", Frequency: "daily", CompletionDates: dates[:10]}}}})
	if find(short, "habit") != nil || !hasNotYet(short, "Habit runs") {
		t.Fatal("two-week run should be gated")
	}
}

func TestStalledTasks(t *testing.T) {
	c := analytics.Corpus{
		Categories: []analytics.AnalyticsCategoryMeta{{ID: "c1", Name: "Work"}},
		OpenTasks: []analytics.AnalyticsOpenTaskLite{
			{ID: "t1", Title: "Draft intro", CategoryID: "c1", CreatedAt: now.AddDate(0, 0, -20)},
			{ID: "t2", Title: "Fresh", CategoryID: "c1", CreatedAt: now.AddDate(0, 0, -8)},
		},
	}
	n := find(compute(computeInput{Now: now, Corpus: c}), "stalled")
	if n == nil || !strings.Contains(n.Headline, "“Draft intro” has been waiting 20 days") || n.Action == nil || n.Action.Kind != "task" || n.Action.Target != "t1" {
		t.Fatalf("stalled: %+v", n)
	}
	c.OpenTasks = c.OpenTasks[1:]
	if find(compute(computeInput{Now: now, Corpus: c}), "stalled") != nil {
		t.Fatal("an 8-day task is not stalled")
	}
}

func TestSupportersGate(t *testing.T) {
	few := compute(computeInput{Now: now, Supporters: []analytics.AnalyticsSupporter{{ID: "u1", Name: "Sam", Count: 2}}})
	if find(few, "supporters") != nil {
		t.Fatal("two Kudos should not be enough")
	}
	r := compute(computeInput{Now: now, Supporters: []analytics.AnalyticsSupporter{{ID: "u1", Name: "Sam", Count: 6}, {ID: "u2", Name: "Ana", Count: 3}}})
	n := find(r, "supporters")
	if n == nil || n.Headline != "Sam keeps showing up for you." || !strings.Contains(n.Evidence, "Ana showed up too") || n.Action.Target != "u1" {
		t.Fatalf("supporters: %+v", n)
	}
	if strings.Contains(strings.ToLower(n.Headline+n.Evidence), "top") {
		t.Fatal("no ranking language")
	}
}

func TestKudosEffectOnlyWithComparison(t *testing.T) {
	base := now.AddDate(0, 0, -10)
	var tasks []analytics.AnalyticsTaskLite
	for i := 0; i < 3; i++ {
		tasks = append(tasks, task(base.Add(time.Duration(i)*time.Hour), 1, 10), task(base.Add(time.Duration(i)*time.Hour), 0, 72))
	}
	n := find(compute(computeInput{Now: now, Corpus: analytics.Corpus{Completed: tasks}}), "kudos")
	if n == nil || !strings.Contains(n.Evidence, "not proof") || !strings.Contains(n.Evidence, "10 hours") || !strings.Contains(n.Evidence, "3 days") {
		t.Fatalf("kudos effect: %+v", n)
	}
	r := compute(computeInput{Now: now, Corpus: analytics.Corpus{Completed: tasks[:4]}})
	if find(r, "kudos") != nil || !hasNotYet(r, "1 more finished task with Kudos") {
		t.Fatalf("expected gate: %v", r.NotYet)
	}
}

func TestOnTimeTrend(t *testing.T) {
	var tasks []analytics.AnalyticsTaskLite
	for i := 0; i < 6; i++ {
		early := task(now.AddDate(0, 0, -70+i), 0, 5)
		dl := early.CompletedAt.Add(-time.Hour) // late
		early.Deadline = &dl
		late := task(now.AddDate(0, 0, -10+i), 0, 5)
		dl2 := late.CompletedAt.Add(time.Hour)
		late.Deadline = &dl2
		tasks = append(tasks, early, late)
	}
	n := find(compute(computeInput{Now: now, Corpus: analytics.Corpus{Completed: tasks}}), "ontime")
	if n == nil || !strings.Contains(n.Evidence, "100% finished by the deadline in the last 45 days, up from 0%") {
		t.Fatalf("on-time: %+v", n)
	}
}

func TestPeakTimeInUserTimezone(t *testing.T) {
	var tasks []analytics.AnalyticsTaskLite
	for i := 0; i < 24; i++ {
		tasks = append(tasks, task(time.Date(2026, 9, 1+i, 15, 30, 0, 0, ny), 0, 5)) // 19:30 UTC; the 2-hour window starts at 2 PM local
	}
	n := find(compute(computeInput{Now: now, Corpus: analytics.Corpus{Completed: tasks}}), "peak")
	if n == nil || !strings.Contains(n.Headline, "2 PM") || n.Evidence == "" {
		t.Fatalf("peak: %+v", n)
	}
}

func TestRankingCapAndVoice(t *testing.T) {
	first := time.Date(2026, 8, 17, 9, 0, 0, 0, ny)
	tasks := weekly([]int{6, 6, 6, 6, 6, 12, 12})
	for i := 0; i < 6; i++ {
		tasks = append(tasks, task(now.AddDate(0, 0, -5).Add(time.Duration(i)*time.Minute), 1, 2))
	}
	thisMon := time.Date(2026, 10, 5, 8, 0, 0, 0, ny)
	var dates []time.Time
	for d := 1; d <= 35; d++ {
		dates = append(dates, thisMon.AddDate(0, 0, -d))
	}
	in := computeInput{
		Now: now, FirstActivity: &first,
		Corpus: analytics.Corpus{
			Completed:  tasks,
			Habits:     []analytics.AnalyticsHabitLite{{Title: "Read", Frequency: "daily", CompletionDates: dates}},
			OpenTasks:  []analytics.AnalyticsOpenTaskLite{{ID: "t1", Title: "Taxes", CategoryID: "c1", CreatedAt: now.AddDate(0, 0, -30)}},
			Categories: []analytics.AnalyticsCategoryMeta{{ID: "c1", Name: "Home", Workspace: "Life"}},
		},
		Supporters: []analytics.AnalyticsSupporter{{ID: "u1", Name: "Sam", Count: 5}},
		Facts:      []factLite{{Content: "Plans the night before", Stated: true}, {Content: "Prefers short tasks"}},
	}
	r := compute(in)
	if len(r.Noticed) != maxNoticed {
		t.Fatalf("expected %d noticed, got %d", maxNoticed, len(r.Noticed))
	}
	want := []string{"weeks", "habit", "stalled", "supporters"}
	for i, k := range want {
		if r.Noticed[i].Kind != k {
			t.Fatalf("rank %d: want %s got %s", i, k, r.Noticed[i].Kind)
		}
	}
	text := strings.ToLower(r.PlainText)
	for _, bad := range []string{"streak", "!", "you should", "failed"} {
		if strings.Contains(text, bad) {
			t.Fatalf("report contains %q:\n%s", bad, r.PlainText)
		}
	}
	var stated, inferred bool
	for _, k := range r.Known {
		stated = stated || (k.Source == "stated" && k.Label == "You told us")
		inferred = inferred || (k.Source == "inferred" && k.Label == "We inferred")
	}
	if !stated || !inferred {
		t.Fatalf("facts not labelled: %+v", r.Known)
	}
}
