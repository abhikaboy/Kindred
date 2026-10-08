package userreport

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/analytics"
	"github.com/abhikaboy/Kindred/internal/handlers/weekrecap"
)

const (
	rangeDays         = 90
	maxNoticed        = 5
	recentWeeks       = 2
	minBaselineWeeks  = 4
	minUsualPerWeek   = 3
	busierRatio       = 1.15
	quieterRatio      = 0.7
	minHabitRunWeeks  = 3
	habitLookback     = 13
	stalledDays       = 14
	minSupporterKudos = 3
	minKudosSample    = 3 // mirrors analytics' kudos-effect gate
	minOnTimeSample   = 5 // tasks with a deadline in each half
	minOnTimeShift    = 10
	maxInferredFacts  = 3
)

type factLite struct {
	Content string
	Stated  bool
}

type computeInput struct {
	Now           time.Time // in the user's location
	Corpus        analytics.Corpus
	FirstActivity *time.Time
	Supporters    []analytics.AnalyticsSupporter
	Facts         []factLite
	KudosReceived int
	KudosSent     int
	RingDays      int
}

func rangeStart(now time.Time) time.Time {
	d := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return d.AddDate(0, 0, -(rangeDays - 1))
}

type candidate struct {
	n      UserReportNoticed
	notYet string
}

func compute(in computeInput) UserReportResponse {
	now := in.Now
	loc := now.Location()
	start := rangeStart(now)
	done := []analytics.AnalyticsTaskLite{}
	for _, t := range in.Corpus.Completed {
		if !in.Corpus.ProxyIDs[t.CategoryID] && !t.CompletedAt.Before(start) && !t.CompletedAt.After(now) {
			t.CompletedAt = t.CompletedAt.In(loc)
			t.CreatedAt = t.CreatedAt.In(loc)
			done = append(done, t)
		}
	}

	resp := UserReportResponse{
		GeneratedAt: now,
		RangeLabel:  fmt.Sprintf("%s – %s", start.Format("Jan 2"), now.Format("Jan 2")),
		Known:       known(in, done, start),
		Noticed:     []UserReportNoticed{},
		NotYet:      []string{},
	}
	// Ordered by research evidence strength: own-past comparison, habit runs, stalled tasks first.
	for _, c := range []candidate{
		weeksVsUsual(done, in.FirstActivity, now),
		habitRun(in.Corpus.Habits, now),
		stalled(in.Corpus, now),
		supporters(in.Supporters),
		kudosEffect(done),
		onTimeTrend(done, now),
		peakTime(done, now),
	} {
		if c.n.Headline != "" && len(resp.Noticed) < maxNoticed {
			resp.Noticed = append(resp.Noticed, c.n)
		} else if c.notYet != "" {
			resp.NotYet = append(resp.NotYet, c.notYet)
		}
	}
	resp.PlainText = plainText(resp)
	return resp
}

func plural(n int, one, many string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, one)
	}
	return fmt.Sprintf("%d %s", n, many)
}

func known(in computeInput, done []analytics.AnalyticsTaskLite, start time.Time) []UserReportKnown {
	rows := []UserReportKnown{}
	finished := UserReportKnown{Label: "Tasks finished", Value: fmt.Sprintf("%d in the last 90 days", len(done)), Source: "activity"}
	if in.FirstActivity != nil {
		finished.Detail = "Your first one was on " + in.FirstActivity.In(start.Location()).Format("Jan 2, 2006")
	}
	rows = append(rows, finished)

	added := 0
	for _, t := range done {
		if !t.CreatedAt.Before(start) {
			added++
		}
	}
	for _, t := range in.Corpus.OpenTasks {
		if !t.CreatedAt.Before(start) {
			added++
		}
	}
	rows = append(rows, UserReportKnown{
		Label: "Tasks added", Value: fmt.Sprintf("%d in the last 90 days", added),
		Detail: plural(len(in.Corpus.OpenTasks), "task is", "tasks are") + " open right now", Source: "activity",
	})
	rows = append(rows, UserReportKnown{
		Label: "Ring days", Value: plural(in.RingDays, "day", "days") + " with Plan, Do and Share data",
		Detail: "Counted in your timezone", Source: "activity",
	})
	rows = append(rows, UserReportKnown{
		Label: "Kudos", Value: fmt.Sprintf("%d received, %d sent", in.KudosReceived, in.KudosSent), Source: "activity",
	})

	names := []string{}
	for _, h := range in.Corpus.Habits {
		active := h.NextDueAt != nil
		for _, d := range h.CompletionDates {
			if !d.Before(start) {
				active = true
				break
			}
		}
		if active {
			names = append(names, h.Title)
		}
	}
	habits := UserReportKnown{Label: "Habits", Value: plural(len(names), "active habit", "active habits"), Source: "activity"}
	if len(names) > 0 {
		shown := names
		if len(shown) > 3 {
			shown = append(append([]string{}, names[:3]...), plural(len(names)-3, "more", "more"))
		}
		habits.Detail = strings.Join(shown, ", ")
	}
	rows = append(rows, habits)

	ws := map[string]bool{}
	for _, c := range in.Corpus.Categories {
		if c.Workspace != "" {
			ws[c.Workspace] = true
		}
	}
	rows = append(rows, UserReportKnown{
		Label: "Workspaces", Value: fmt.Sprintf("%s, %s", plural(len(ws), "workspace", "workspaces"), plural(len(in.Corpus.Categories), "category", "categories")),
		Source: "activity",
	})

	inferred := 0
	for _, f := range in.Facts {
		if strings.TrimSpace(f.Content) == "" {
			continue
		}
		if f.Stated {
			rows = append(rows, UserReportKnown{Label: "You told us", Value: f.Content, Source: "stated"})
		} else if inferred < maxInferredFacts {
			inferred++
			rows = append(rows, UserReportKnown{Label: "We inferred", Value: f.Content, Detail: "Anything you tell us takes priority", Source: "inferred"})
		}
	}
	return rows
}

func countBetween(done []analytics.AnalyticsTaskLite, a, b time.Time) int {
	n := 0
	for _, t := range done {
		if !t.CompletedAt.Before(a) && t.CompletedAt.Before(b) {
			n++
		}
	}
	return n
}

// weeksVsUsual compares the last two full weeks with the user's own earlier weeks.
func weeksVsUsual(done []analytics.AnalyticsTaskLite, first *time.Time, now time.Time) candidate {
	loc := now.Location()
	thisMon := weekrecap.WeekOf(now, loc)
	start := rangeStart(now)
	firstMon := start
	if first != nil {
		if f := weekrecap.WeekOf(*first, loc); f.After(firstMon) {
			firstMon = f
		}
	}
	recent := make([]int, recentWeeks)
	for i := 0; i < recentWeeks; i++ {
		ws := thisMon.AddDate(0, 0, -7*(recentWeeks-i))
		recent[i] = countBetween(done, ws, ws.AddDate(0, 0, 7))
	}
	base, sum := 0, 0
	for ws := thisMon.AddDate(0, 0, -7*(recentWeeks+1)); !ws.Before(firstMon) && !ws.Before(start); ws = ws.AddDate(0, 0, -7) {
		sum += countBetween(done, ws, ws.AddDate(0, 0, 7))
		base++
	}
	if base < minBaselineWeeks {
		return candidate{notYet: fmt.Sprintf("How your weeks compare needs %s more of history.", plural(minBaselineWeeks-base, "week", "weeks"))}
	}
	usual := int(math.Round(float64(sum) / float64(base)))
	if usual < minUsualPerWeek {
		return candidate{notYet: "How your weeks compare needs a few more finished tasks each week."}
	}
	avg := float64(recent[0]+recent[1]) / recentWeeks
	ev := fmt.Sprintf("%d and %d tasks finished in the last two weeks, against your usual %d a week over %d earlier weeks.", recent[0], recent[1], usual, base)
	n := UserReportNoticed{Kind: "weeks", Evidence: ev, Strength: "strong"}
	switch {
	case avg >= busierRatio*float64(usual):
		n.Headline = "Your last two weeks were busier than your usual."
	case avg <= quieterRatio*float64(usual):
		n.Headline = "Your last two weeks were quieter than usual, and that's okay."
		n.Action = &UserReportAction{Label: "Pick one thing for today", Kind: "home"}
	default:
		n.Headline = "You've been steady: the last two weeks match your usual."
	}
	return candidate{n: n}
}

func habitRun(habits []analytics.AnalyticsHabitLite, now time.Time) candidate {
	loc := now.Location()
	thisMon := weekrecap.WeekOf(now, loc)
	bestTitle, bestRun, bestRepaired, any := "", 0, false, false
	for _, h := range habits {
		f := strings.ToLower(h.Frequency)
		if f != "daily" && f != "weekly" {
			continue
		}
		any = true
		run, rep := weekrecap.HabitRun(f, h.CompletionDates, thisMon, loc, habitLookback)
		if run == 0 { // this week may still be in progress
			run, rep = weekrecap.HabitRun(f, h.CompletionDates, thisMon.AddDate(0, 0, -7), loc, habitLookback)
		}
		if run > bestRun {
			bestTitle, bestRun, bestRepaired = h.Title, run, rep
		}
	}
	if bestRun < minHabitRunWeeks {
		if !any {
			return candidate{}
		}
		return candidate{notYet: fmt.Sprintf("Habit runs show up once a habit has been kept %d weeks in a row.", minHabitRunWeeks)}
	}
	ev := fmt.Sprintf("Kept every week for %d weeks.", bestRun)
	if bestRepaired {
		ev = fmt.Sprintf("Kept for %d weeks. Some weeks had a quiet day, and the run held because you came back.", bestRun)
	}
	return candidate{n: UserReportNoticed{
		Kind: "habit", Headline: fmt.Sprintf("%s is your longest run, %d weeks in.", bestTitle, bestRun),
		Evidence: ev, Strength: "strong",
		Action: &UserReportAction{Label: "See your habits", Kind: "activity", Target: "patterns"},
	}}
}

func stalled(c analytics.Corpus, now time.Time) candidate {
	meta := map[string]analytics.AnalyticsCategoryMeta{}
	for _, m := range c.Categories {
		meta[m.ID] = m
	}
	att := analytics.Attention(c.OpenTasks,
		func(id string) bool { return !c.ProxyIDs[id] },
		func(id string) string { return meta[id].Name },
		func(id string) string { return meta[id].Workspace }, now)
	var old []analytics.AnalyticsAttentionTask
	for _, t := range att.Tasks {
		if t.DaysOpen >= stalledDays {
			old = append(old, t)
		}
	}
	if len(old) == 0 {
		return candidate{}
	}
	oldest := old[0]
	for _, t := range old {
		if t.DaysOpen > oldest.DaysOpen {
			oldest = t
		}
	}
	n := UserReportNoticed{Kind: "stalled", Strength: "strong",
		Action: &UserReportAction{Label: "Open task", Kind: "task", Target: oldest.ID}}
	if len(old) == 1 {
		n.Headline = fmt.Sprintf("“%s” has been waiting %d days.", oldest.Title, oldest.DaysOpen)
		n.Evidence = "A smaller first step, a new date, or letting it go all count as progress."
	} else {
		n.Headline = fmt.Sprintf("%d tasks have been waiting two weeks or more.", len(old))
		n.Evidence = fmt.Sprintf("The oldest, “%s”, was added %d days ago.", oldest.Title, oldest.DaysOpen)
	}
	return candidate{n: n}
}

func supporters(top []analytics.AnalyticsSupporter) candidate {
	if len(top) == 0 || top[0].Count < minSupporterKudos {
		return candidate{notYet: "Who's in your corner shows up after a few more Kudos from friends."}
	}
	p := top[0]
	ev := fmt.Sprintf("%s sent you %s in the last 90 days.", p.Name, plural(p.Count, "Kudos", "Kudos"))
	others := []string{}
	for _, o := range top[1:] {
		if o.Count >= 2 && len(others) < 2 {
			others = append(others, o.Name)
		}
	}
	if len(others) > 0 {
		ev += " " + strings.Join(others, " and ") + " showed up too."
	}
	return candidate{n: UserReportNoticed{
		Kind: "supporters", Headline: fmt.Sprintf("%s keeps showing up for you.", p.Name), Evidence: ev, Strength: "moderate",
		Action: &UserReportAction{Label: "Say thanks", Kind: "account", Target: p.ID},
	}}
}

func formatHours(h float64) string {
	if h < 48 {
		return plural(int(math.Round(h)), "hour", "hours")
	}
	return plural(int(math.Round(h/24)), "day", "days")
}

func kudosEffect(done []analytics.AnalyticsTaskLite) candidate {
	k := analytics.KudosEffect(done)
	if !k.HasComparison {
		need, which := minKudosSample-k.WithCount, "with"
		if need <= 0 {
			need, which = minKudosSample-k.WithoutCount, "without"
		}
		return candidate{notYet: fmt.Sprintf("Whether Kudos line up with finishing sooner needs %s %s Kudos.",
			plural(need, "more finished task", "more finished tasks"), which)}
	}
	if k.WithKudosMedianHours >= k.WithoutKudosMedianHours {
		return candidate{}
	}
	return candidate{n: UserReportNoticed{
		Kind: "kudos", Headline: "Tasks that got Kudos tended to finish sooner.", Strength: "moderate",
		Evidence: fmt.Sprintf("A typical one took %s with Kudos and %s without, across %d and %d tasks. It's a pattern, not proof.",
			formatHours(k.WithKudosMedianHours), formatHours(k.WithoutKudosMedianHours), k.WithCount, k.WithoutCount),
	}}
}

func onTimeTrend(done []analytics.AnalyticsTaskLite, now time.Time) candidate {
	mid := rangeStart(now).AddDate(0, 0, rangeDays/2)
	var early, late []analytics.AnalyticsTaskLite
	for _, t := range done {
		if t.CompletedAt.Before(mid) {
			early = append(early, t)
		} else {
			late = append(late, t)
		}
	}
	ed, eo := analytics.OnTimeStats(early)
	ld, lo := analytics.OnTimeStats(late)
	if ed < minOnTimeSample || ld < minOnTimeSample {
		return candidate{notYet: "An on-time trend needs a few more finished tasks with deadlines."}
	}
	ep, lp := eo*100/ed, lo*100/ld
	if abs(lp-ep) < minOnTimeShift {
		return candidate{}
	}
	n := UserReportNoticed{Kind: "ontime", Strength: "moderate",
		Evidence: fmt.Sprintf("%d%% finished by the deadline in the last 45 days, up from %d%% before.", lp, ep)}
	n.Headline = "You're finishing more things by their deadline."
	if lp < ep {
		n.Headline = "Deadlines have been harder to hit lately."
		n.Evidence = fmt.Sprintf("%d%% finished by the deadline in the last 45 days, compared with %d%% before. Fewer or roomier dates can help.", lp, ep)
	}
	return candidate{n: n}
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func peakTime(done []analytics.AnalyticsTaskLite, now time.Time) candidate {
	p := analytics.PeakTime(done, now, nil) // stated hours already appear under "You told us"
	if p == nil {
		if len(done) < analytics.PeakMinTasks {
			return candidate{notYet: fmt.Sprintf("Peak time needs %s.", plural(analytics.PeakMinTasks-len(done), "more finished task", "more finished tasks"))}
		}
		return candidate{notYet: "Your finish times are still spread out, so there's no clear peak yet."}
	}
	head, ev, _ := strings.Cut(p.Reason, ". ")
	return candidate{n: UserReportNoticed{Kind: "peak", Headline: head + ".", Evidence: ev, Strength: "moderate"}}
}

func plainText(r UserReportResponse) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Your report, %s\n", r.RangeLabel)
	if len(r.Noticed) > 0 {
		b.WriteString("\nWhat we noticed\n")
		for _, n := range r.Noticed {
			fmt.Fprintf(&b, "- %s %s\n", n.Headline, n.Evidence)
		}
	}
	b.WriteString("\nWhat we know about you\n")
	for _, k := range r.Known {
		line := fmt.Sprintf("- %s: %s", k.Label, k.Value)
		if k.Detail != "" {
			line += " (" + k.Detail + ")"
		}
		b.WriteString(line + "\n")
	}
	if len(r.NotYet) > 0 {
		b.WriteString("\nNot yet\n")
		for _, s := range r.NotYet {
			b.WriteString("- " + s + "\n")
		}
	}
	return strings.TrimRight(b.String(), "\n")
}
