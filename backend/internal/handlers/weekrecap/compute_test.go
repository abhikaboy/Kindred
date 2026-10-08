package weekrecap

import (
	"strings"
	"testing"
	"time"
)

var ny, _ = time.LoadLocation("America/New_York")

// Sunday Oct 4 2026, 6 PM in New York. Recap week is Mon Sep 28 - Sun Oct 4.
var sunday = time.Date(2026, 10, 4, 18, 0, 0, 0, ny)

func at(day, hour int) time.Time { return time.Date(2026, 9, day, hour, 0, 0, 0, ny) }

func repeat(t time.Time, n int) []time.Time {
	out := []time.Time{}
	for i := 0; i < n; i++ {
		out = append(out, t)
	}
	return out
}

func cardOf(r WeekRecapResponse, kind string) *WeekRecapCard {
	for i := range r.Cards {
		if r.Cards[i].Kind == kind {
			return &r.Cards[i]
		}
	}
	return nil
}

func TestRecapWindow(t *testing.T) {
	if got := recapWindow(sunday, ny).Format("2006-01-02"); got != "2026-09-28" {
		t.Fatalf("sunday window = %s", got)
	}
	wed := time.Date(2026, 10, 7, 9, 0, 0, 0, ny)
	if got := recapWindow(wed, ny).Format("2006-01-02"); got != "2026-09-28" {
		t.Fatalf("wednesday window = %s, want last full week", got)
	}
}

func TestTimezoneBucketing(t *testing.T) {
	// 01:00 UTC Monday Sep 28 is 9 PM Sunday Sep 27 in New York: last week, not this one.
	edge := time.Date(2026, 9, 28, 1, 0, 0, 0, time.UTC)
	first := at(1, 9)
	r := compute(computeInput{Now: sunday, Loc: ny, Completed: []time.Time{edge}, FirstActivity: &first})
	if w := cardOf(r, "week"); w.Weeks[len(w.Weeks)-1].Value != 0 {
		t.Fatalf("edge completion counted in recap week: %+v", w.Weeks)
	}
}

func TestFirstWeekIsShortAndHonest(t *testing.T) {
	c := append(repeat(at(29, 9), 3), repeat(at(30, 10), 2)...)
	first := c[0]
	r := compute(computeInput{Now: sunday, Loc: ny, Completed: c, FirstActivity: &first, PlanClosed: 4})
	if !r.IsFirstWeek || r.Variant != "first" || len(r.Cards) != 2 {
		t.Fatalf("got variant=%s cards=%d", r.Variant, len(r.Cards))
	}
	w := r.Cards[0]
	if w.Usual != nil || len(w.Days) != 7 || w.Headline != "Your first week: 5 tasks." {
		t.Fatalf("week card %+v", w)
	}
	if r.Cards[1].Headline != "I finished my first week on Kindred." || !strings.Contains(r.Cards[1].Body, "Plan ring closed 4 days") {
		t.Fatalf("share %+v", r.Cards[1])
	}
}

func TestBiggerWeekAgainstOwnUsual(t *testing.T) {
	var c []time.Time
	c = append(c, repeat(at(8, 9), 12)...)  // week of Sep 7
	c = append(c, repeat(at(15, 9), 12)...) // Sep 14
	c = append(c, repeat(at(22, 9), 12)...) // Sep 21
	c = append(c, repeat(at(29, 9), 10)...) // Tue Sep 29
	c = append(c, repeat(time.Date(2026, 10, 1, 9, 0, 0, 0, ny), 6)...)
	first := c[0]
	r := compute(computeInput{Now: sunday, Loc: ny, Completed: c, FirstActivity: &first})
	w := cardOf(r, "week")
	if r.Variant != "bigger" || w.Headline != "16 tasks, 4 more than your usual." || *w.Usual != 12 {
		t.Fatalf("variant=%s headline=%q", r.Variant, w.Headline)
	}
	if !strings.Contains(w.Body, "Tuesday was your biggest day") || len(w.Weeks) != 4 {
		t.Fatalf("body=%q weeks=%d", w.Body, len(w.Weeks))
	}
	p := cardOf(r, "peak")
	if p == nil || *p.PeakHour != 9 || p.Headline != "You get going in the morning." {
		t.Fatalf("peak %+v", p)
	}
}

func TestQuieterWeekNamesWhatHappened(t *testing.T) {
	var c []time.Time
	for _, d := range []int{8, 15, 22} {
		c = append(c, repeat(at(d, 9), 12)...)
	}
	c = append(c, repeat(at(29, 9), 5)...)
	first := c[0]
	habit := habitLite{ID: "h", Title: "Morning walk", Frequency: "weekly", Dates: []time.Time{at(29, 7), at(30, 7), at(22, 7)}}
	r := compute(computeInput{Now: sunday, Loc: ny, Completed: c, FirstActivity: &first, Habits: []habitLite{habit}})
	w := cardOf(r, "week")
	if r.Variant != "quieter" || w.Headline != "A quieter week: 5 tasks." || !strings.Contains(w.Body, "Morning walk still happened twice") {
		t.Fatalf("variant=%s %q %q", r.Variant, w.Headline, w.Body)
	}
	if cardOf(r, "peak") != nil {
		t.Fatal("quieter week should skip peak time")
	}
	if s := cardOf(r, "slipped"); s == nil || s.Action != nil || !strings.Contains(s.Headline, "one plan") {
		t.Fatalf("quieter week should offer one small try: %+v", s)
	}
}

func TestHabitRunSurvivesAMiss(t *testing.T) {
	var dates []time.Time
	for w := 0; w < 6; w++ {
		for d := 0; d < 7; d++ {
			if w == 3 && d == 0 {
				continue // a quiet Monday
			}
			dates = append(dates, time.Date(2026, 8, 24+7*w+d, 7, 0, 0, 0, ny))
		}
	}
	first := dates[0]
	r := compute(computeInput{Now: sunday, Loc: ny, Completed: []time.Time{first}, FirstActivity: &first,
		Habits: []habitLite{{ID: "h", Title: "Morning walk", Frequency: "daily", Dates: dates}}})
	h := cardOf(r, "habit")
	if h == nil || h.Headline != "Morning walk, 6 weeks in." || !strings.Contains(h.Body, "run held") {
		t.Fatalf("habit %+v", h)
	}
	for _, c := range r.Cards {
		if strings.Contains(strings.ToLower(c.Headline+c.Body+c.Caption), "streak") {
			t.Fatalf("card says streak: %+v", c)
		}
	}
	if !strings.Contains(r.Teaser, "6 weeks of Morning walk") {
		t.Fatalf("teaser %q", r.Teaser)
	}
}

func TestSupportersByRecencyWithoutCounts(t *testing.T) {
	first := at(1, 9)
	k := []kudosLite{
		{SenderID: "a", Name: "Maya Lin", Message: "You've got this", TaskName: "Draft the grant intro", At: at(29, 10)},
		{SenderID: "a", Name: "Maya Lin", Message: "again", At: at(29, 11)},
		{SenderID: "b", Name: "Jonah", Type: "gif", TaskName: "Morning walk", At: time.Date(2026, 10, 1, 9, 0, 0, 0, ny)},
	}
	r := compute(computeInput{Now: sunday, Loc: ny, Completed: []time.Time{first}, FirstActivity: &first, Kudos: k})
	s := cardOf(r, "supporters")
	if s == nil || s.Headline != "Jonah and Maya showed up for you." || len(s.People) != 2 {
		t.Fatalf("supporters %+v", s)
	}
	if s.People[0].Line != "Sent a GIF" {
		t.Fatalf("line %q", s.People[0].Line)
	}
}

func TestSlippedTaskGetsOnePlanAction(t *testing.T) {
	first := at(1, 9)
	open := []openTaskLite{
		{ID: "t1", CategoryID: "c1", Title: "Draft the grant intro", CreatedAt: at(10, 9), Reschedules: 3},
		{ID: "t2", CategoryID: "c1", Title: "Fresh", CreatedAt: at(30, 9)},
	}
	r := compute(computeInput{Now: sunday, Loc: ny, Completed: []time.Time{first}, FirstActivity: &first, Open: open})
	s := cardOf(r, "slipped")
	if s == nil || s.Action == nil || s.Action.TaskID != "t1" {
		t.Fatalf("slipped %+v", s)
	}
	if !strings.Contains(s.Body, "moved 3 times") || s.Action.Label != "Plan it for tomorrow" {
		t.Fatalf("body=%q label=%q", s.Body, s.Action.Label)
	}
	want := time.Date(2026, 10, 5, 9, 0, 0, 0, ny).Format(time.RFC3339)
	if s.Action.At != want {
		t.Fatalf("at=%s want %s", s.Action.At, want)
	}
}

func TestEmptyUserStillGetsAStory(t *testing.T) {
	r := compute(computeInput{Now: sunday, Loc: ny})
	if len(r.Cards) != 2 || r.Cards[0].Headline != "Your first week on Kindred." {
		t.Fatalf("%+v", r.Cards)
	}
}
