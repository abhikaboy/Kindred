package weekrecap

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

const (
	baselineWeeks   = 3
	habitLookback   = 12
	habitGridWeeks  = 6
	quieterRatio    = 0.6
	peakMinTotal    = 8
	peakMinThisWeek = 3
	slipMinMoves    = 2
	slipMinDaysOpen = 14
	maxPeopleShown  = 3
)

type habitLite struct {
	ID, Title, Frequency string
	Dates                []time.Time
}

type kudosLite struct {
	SenderID, Name, Icon string
	Message, TaskName    string
	Type                 string // message, image, video, gif
	Congrats             bool
	At                   time.Time
}

type openTaskLite struct {
	ID, CategoryID, Title string
	CreatedAt             time.Time
	Deadline              *time.Time
	Reschedules           int
	HasFuturePlan         bool
}

type computeInput struct {
	Now           time.Time
	Loc           *time.Location
	Completed     []time.Time // completion instants
	FirstActivity *time.Time  // earliest completion ever, nil if none
	PlanClosed    int         // days this week the Plan ring closed
	Habits        []habitLite
	Kudos         []kudosLite // received during the recap week
	Open          []openTaskLite
}

// recapWindow returns the local Monday that starts the recap week: this week
// on Sunday, otherwise the last full week.
func recapWindow(now time.Time, loc *time.Location) time.Time {
	l := now.In(loc)
	day := time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, loc)
	monOffset := (int(day.Weekday()) + 6) % 7
	monday := day.AddDate(0, 0, -monOffset)
	if day.Weekday() != time.Sunday {
		monday = monday.AddDate(0, 0, -7)
	}
	return monday
}

func weekOf(t time.Time, loc *time.Location) time.Time {
	l := t.In(loc)
	day := time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, loc)
	return day.AddDate(0, 0, -((int(day.Weekday()) + 6) % 7))
}

func countIn(ts []time.Time, start, end time.Time) int {
	n := 0
	for _, t := range ts {
		if !t.Before(start) && t.Before(end) {
			n++
		}
	}
	return n
}

func compute(in computeInput) WeekRecapResponse {
	loc := in.Loc
	if loc == nil {
		loc = time.UTC
	}
	start := recapWindow(in.Now, loc)
	end := start.AddDate(0, 0, 7)
	cur := countIn(in.Completed, start, end)

	// Baseline: up to 3 prior weeks, only those after the user's first activity.
	nBase := 0
	if in.FirstActivity != nil && in.FirstActivity.Before(start) {
		first := weekOf(*in.FirstActivity, loc)
		for i := 1; i <= baselineWeeks; i++ {
			if !start.AddDate(0, 0, -7*i).Before(first) {
				nBase = i
			}
		}
	}
	isFirst := nBase == 0

	var weeks []WeekRecapBar
	baseSum := 0
	for i := nBase; i >= 1; i-- {
		ws := start.AddDate(0, 0, -7*i)
		v := countIn(in.Completed, ws, ws.AddDate(0, 0, 7))
		baseSum += v
		weeks = append(weeks, WeekRecapBar{Label: ws.Format("Jan 2"), Value: v})
	}
	weeks = append(weeks, WeekRecapBar{Label: "This week", Value: cur, Current: true})

	days := make([]WeekRecapBar, 7)
	bigIdx, bigVal := -1, 0
	for i := 0; i < 7; i++ {
		ds := start.AddDate(0, 0, i)
		v := countIn(in.Completed, ds, ds.AddDate(0, 0, 1))
		days[i] = WeekRecapBar{Label: ds.Weekday().String()[:1], Value: v}
		if v > bigVal {
			bigIdx, bigVal = i, v
		}
	}
	bigDay := ""
	if bigIdx >= 0 {
		days[bigIdx].Current = true
		bigDay = start.AddDate(0, 0, bigIdx).Weekday().String()
	}

	usual := 0
	if nBase > 0 {
		usual = int(float64(baseSum)/float64(nBase) + 0.5)
	}
	variant := "usual"
	switch {
	case isFirst:
		variant = "first"
	case usual > 0 && float64(cur) < quieterRatio*float64(usual):
		variant = "quieter"
	case cur >= usual+maxInt(2, (usual+5)/7): // ~15% above, at least 2
		variant = "bigger"
	}

	habit, habitRun := habitCard(in.Habits, start, in.Now, loc)
	peak, peakHour := peakCard(in.Completed, start, end, nBase, loc)

	resp := WeekRecapResponse{
		WeekStart:   start.Format("2006-01-02"),
		WeekEnd:     end.AddDate(0, 0, -1).Format("2006-01-02"),
		RangeLabel:  rangeLabel(start, end.AddDate(0, 0, -1)),
		Variant:     variant,
		IsFirstWeek: isFirst,
		Cards:       []WeekRecapCard{},
	}

	resp.Cards = append(resp.Cards, weekCard(variant, cur, usual, nBase, bigDay, in.PlanClosed, weeks, days, habit, habitRun))
	supporters := supportersCard(in.Kudos, loc)
	if !isFirst {
		if variant != "quieter" && peak != nil {
			resp.Cards = append(resp.Cards, *peak)
		}
		if habit != nil {
			resp.Cards = append(resp.Cards, habit.card)
		}
		if supporters != nil {
			resp.Cards = append(resp.Cards, *supporters)
		}
		if s := slippedCard(in.Open, variant == "quieter", peakHour, in.Now, loc); s != nil {
			resp.Cards = append(resp.Cards, *s)
		}
	}
	resp.Cards = append(resp.Cards, shareCard(isFirst, cur, in.PlanClosed, habit, habitRun))
	resp.Teaser = teaser(cur, habit, habitRun, supporters)
	return resp
}

func rangeLabel(a, b time.Time) string {
	if a.Month() == b.Month() {
		return fmt.Sprintf("%s – %d", a.Format("Jan 2"), b.Day())
	}
	return fmt.Sprintf("%s – %s", a.Format("Jan 2"), b.Format("Jan 2"))
}

func plural(n int, one, many string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, one)
	}
	return fmt.Sprintf("%d %s", n, many)
}

func weekCard(variant string, cur, usual, nBase int, bigDay string, planClosed int, weeks, days []WeekRecapBar, habit *habitPick, run int) WeekRecapCard {
	c := WeekRecapCard{Kind: "week"}
	from := fmt.Sprintf("from your last %s", plural(nBase, "week", "weeks"))
	if nBase == 1 {
		from = "from last week"
	}
	biggest := ""
	if bigDay != "" && cur > 1 {
		biggest = fmt.Sprintf(" %s was your biggest day.", bigDay)
	}
	switch variant {
	case "first":
		c.Days = days
		if cur == 0 {
			c.Headline = "Your first week on Kindred."
			c.Body = "Nothing finished yet, and that's fine. Next Sunday there'll be something of your own to look back on."
		} else {
			c.Headline = fmt.Sprintf("Your first week: %s.", plural(cur, "task", "tasks"))
			c.Body = "Next Sunday this becomes your usual, so there's something of your own to compare with."
		}
		if planClosed > 0 {
			c.Caption = fmt.Sprintf("Plan closed %s", plural(planClosed, "day", "days"))
		}
		return c
	case "quieter":
		c.Headline = fmt.Sprintf("A quieter week: %s.", plural(cur, "task", "tasks"))
		c.Body = fmt.Sprintf("Your usual is %d. Rest weeks are part of the pattern.", usual)
		if habit != nil && habit.thisWeek > 0 {
			c.Body = fmt.Sprintf("Your usual is %d. Rest weeks are part of the pattern, and %s still happened %s.", usual, habit.title, timesWord(habit.thisWeek))
		}
	case "bigger":
		c.Headline = fmt.Sprintf("%s, %d more than your usual.", plural(cur, "task", "tasks"), cur-usual)
		c.Body = fmt.Sprintf("Your usual is %d, %s.%s", usual, from, biggest)
	default:
		switch {
		case cur == usual:
			c.Headline = fmt.Sprintf("%s, right on your usual.", plural(cur, "task", "tasks"))
		case cur > usual:
			c.Headline = fmt.Sprintf("%s, a little over your usual.", plural(cur, "task", "tasks"))
		default:
			c.Headline = fmt.Sprintf("%s, close to your usual.", plural(cur, "task", "tasks"))
		}
		c.Body = fmt.Sprintf("Your usual is %d, %s.%s", usual, from, biggest)
	}
	u := usual
	c.Usual = &u
	c.Weeks = weeks
	c.Caption = "Dashed line is your usual · your weeks only"
	if planClosed > 0 {
		c.Caption = fmt.Sprintf("Plan closed %s · dashed line is your usual", plural(planClosed, "day", "days"))
	}
	return c
}

func timesWord(n int) string {
	switch n {
	case 1:
		return "once"
	case 2:
		return "twice"
	}
	return fmt.Sprintf("%d times", n)
}

func formatHour(h int) string {
	switch {
	case h == 0:
		return "12 AM"
	case h < 12:
		return fmt.Sprintf("%d AM", h)
	case h == 12:
		return "12 PM"
	}
	return fmt.Sprintf("%d PM", h-12)
}

func partOfDay(h int) int {
	switch {
	case h >= 5 && h < 12:
		return 0
	case h >= 12 && h < 17:
		return 1
	case h >= 17 && h < 22:
		return 2
	}
	return 3
}

var partNames = [4]string{"morning", "afternoon", "evening", "late night"}
var partHeadlines = [4]string{
	"You get going in the morning.",
	"Afternoons are when things get done.",
	"Evenings are when things get done.",
	"Late nights are when things get done.",
}

// peakCard uses this week plus the baseline weeks so one odd day doesn't decide it.
func peakCard(completed []time.Time, start, end time.Time, nBase int, loc *time.Location) (*WeekRecapCard, *int) {
	from := start.AddDate(0, 0, -7*nBase)
	hours := make([]int, 24)
	var parts, curParts [4]int
	total, curTotal := 0, 0
	for _, t := range completed {
		if t.Before(from) || !t.Before(end) {
			continue
		}
		h := t.In(loc).Hour()
		hours[h]++
		parts[partOfDay(h)]++
		total++
		if !t.Before(start) {
			curParts[partOfDay(h)]++
			curTotal++
		}
	}
	if total < peakMinTotal || curTotal < peakMinThisWeek {
		return nil, nil
	}
	best := 0
	for p := 1; p < 4; p++ {
		if parts[p] > parts[best] {
			best = p
		}
	}
	peakHour := -1
	for h := 0; h < 24; h++ {
		if partOfDay(h) == best && (peakHour < 0 || hours[h] > hours[peakHour]) {
			peakHour = h
		}
	}
	c := &WeekRecapCard{Kind: "peak", Headline: partHeadlines[best], Hours: hours}
	ph := peakHour
	c.PeakHour = &ph
	if curParts[best] > 0 {
		c.Body = fmt.Sprintf("%d of your %d tasks this week landed in the %s, most around %s.", curParts[best], curTotal, partNames[best], formatHour(peakHour))
	} else {
		c.Body = fmt.Sprintf("Over the last few weeks, most of your tasks landed around %s.", formatHour(peakHour))
	}
	if nBase > 0 {
		c.Caption = fmt.Sprintf("From your last %s · a pattern, not a rule", plural(nBase+1, "week", "weeks"))
	} else {
		c.Caption = "From this week · a pattern, not a rule"
	}
	return c, &ph
}

type habitPick struct {
	title    string
	run      int
	thisWeek int
	total    int
	card     WeekRecapCard
}

// weekKept treats a week as kept when the habit mostly happened: a missed day
// that was made up still counts, so one miss never erases the run.
func weekKept(freq string, n int) bool {
	if freq == "daily" {
		return n >= 4
	}
	return n >= 1
}

func habitCard(habits []habitLite, start, now time.Time, loc *time.Location) (*habitPick, int) {
	var best *habitPick
	for _, h := range habits {
		if h.Frequency != "daily" && h.Frequency != "weekly" {
			continue
		}
		run, repaired, total := 0, false, 0
		for w := 0; w < habitLookback; w++ {
			ws := start.AddDate(0, 0, -7*w)
			n := countDays(h.Dates, ws, loc)
			if !weekKept(h.Frequency, n) {
				break
			}
			run++
			total += n
			if h.Frequency == "daily" && n < 7 {
				repaired = true
			}
		}
		if run == 0 {
			continue
		}
		if best != nil && (run < best.run || (run == best.run && total <= best.total)) {
			continue
		}
		thisWeek := countDays(h.Dates, start, loc)
		p := &habitPick{title: h.Title, run: run, thisWeek: thisWeek, total: total}
		c := WeekRecapCard{Kind: "habit", HabitGrid: habitGrid(h.Dates, start, now, loc, minInt(run+1, habitGridWeeks))}
		if run == 1 {
			c.Headline = fmt.Sprintf("%s, kept this week.", h.Title)
		} else {
			c.Headline = fmt.Sprintf("%s, %d weeks in.", h.Title, run)
		}
		switch {
		case h.Frequency == "weekly":
			c.Body = fmt.Sprintf("It happened at least once every week for %s.", plural(run, "week", "weeks"))
		case repaired:
			c.Body = "Some weeks had a quiet day, and the run held because you kept coming back."
		default:
			c.Body = fmt.Sprintf("Every day, %s running.", plural(run, "week", "weeks"))
		}
		if h.Frequency == "daily" {
			c.Caption = "A quiet day doesn't break a run"
		}
		p.card = c
		best = p
	}
	if best == nil {
		return nil, 0
	}
	return best, best.run
}

// countDays counts distinct local days with a completion in the week.
func countDays(dates []time.Time, ws time.Time, loc *time.Location) int {
	we := ws.AddDate(0, 0, 7)
	seen := map[string]bool{}
	for _, d := range dates {
		if !d.Before(ws) && d.Before(we) {
			seen[d.In(loc).Format("2006-01-02")] = true
		}
	}
	return len(seen)
}

func habitGrid(dates []time.Time, start, now time.Time, loc *time.Location, n int) [][]int {
	done := map[string]bool{}
	for _, d := range dates {
		done[d.In(loc).Format("2006-01-02")] = true
	}
	grid := [][]int{}
	for w := n - 1; w >= 0; w-- {
		ws := start.AddDate(0, 0, -7*w)
		row := make([]int, 7)
		for i := 0; i < 7; i++ {
			d := ws.AddDate(0, 0, i)
			switch {
			case done[d.Format("2006-01-02")]:
				row[i] = 1
			case d.After(now):
				row[i] = -1
			}
		}
		grid = append(grid, row)
	}
	return grid
}

func joinNames(names []string) string {
	switch len(names) {
	case 0:
		return ""
	case 1:
		return names[0]
	}
	return strings.Join(names[:len(names)-1], ", ") + " and " + names[len(names)-1]
}

func firstName(n string) string {
	if f := strings.Fields(n); len(f) > 0 {
		return f[0]
	}
	return n
}

func kudosLine(k kudosLite) string {
	switch k.Type {
	case "image":
		return "Sent a photo"
	case "video":
		return "Sent a video"
	case "gif":
		return "Sent a GIF"
	}
	m := strings.TrimSpace(k.Message)
	if m == "" {
		if k.Congrats {
			return "Congratulated you"
		}
		return "Cheered you on"
	}
	if r := []rune(m); len(r) > 60 {
		m = strings.TrimSpace(string(r[:57])) + "..."
	}
	return "“" + m + "”"
}

// supportersCard names people who did something, most recent first. No counts.
func supportersCard(kudos []kudosLite, loc *time.Location) *WeekRecapCard {
	if len(kudos) == 0 {
		return nil
	}
	sorted := append([]kudosLite(nil), kudos...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].At.After(sorted[j].At) })
	seen := map[string]bool{}
	people := []WeekRecapPerson{}
	var picks []kudosLite
	for _, k := range sorted {
		if seen[k.SenderID] {
			continue
		}
		seen[k.SenderID] = true
		picks = append(picks, k)
	}
	for _, k := range picks[:minInt(len(picks), maxPeopleShown)] {
		ctx := k.At.In(loc).Format("Mon")
		if k.TaskName != "" {
			ctx = fmt.Sprintf("on %s · %s", k.TaskName, ctx)
		}
		people = append(people, WeekRecapPerson{ID: k.SenderID, Name: k.Name, Icon: k.Icon, Line: kudosLine(k), Context: ctx})
	}
	names := []string{}
	for _, p := range people {
		names = append(names, firstName(p.Name))
	}
	if len(picks) > maxPeopleShown {
		names = append(names, "a few others")
	}
	c := &WeekRecapCard{Kind: "supporters", People: people}
	c.Headline = joinNames(names) + " showed up for you."
	lead := picks[0]
	verb := "cheered"
	if lead.Congrats {
		verb = "congratulated you on"
	}
	if lead.TaskName != "" {
		c.Body = fmt.Sprintf("%s %s %s on %s.", firstName(lead.Name), verb, lead.TaskName, lead.At.In(loc).Weekday())
	} else {
		c.Body = fmt.Sprintf("%s reached out on %s.", firstName(lead.Name), lead.At.In(loc).Weekday())
	}
	return c
}

func slippedCard(open []openTaskLite, quieter bool, peakHour *int, now time.Time, loc *time.Location) *WeekRecapCard {
	var pick *openTaskLite
	reason := ""
	for i := range open {
		t := &open[i]
		if t.HasFuturePlan {
			continue
		}
		daysOpen := int(now.Sub(t.CreatedAt).Hours() / 24)
		r := ""
		switch {
		case t.Reschedules >= slipMinMoves:
			r = fmt.Sprintf("“%s” moved %s.", t.Title, timesWord(t.Reschedules))
		case t.Deadline != nil && t.Deadline.Before(now) && daysOpen >= 7:
			r = fmt.Sprintf("“%s” has been waiting since %s.", t.Title, t.Deadline.In(loc).Format("Jan 2"))
		case daysOpen >= slipMinDaysOpen:
			r = fmt.Sprintf("“%s” has been open %d days.", t.Title, daysOpen)
		default:
			continue
		}
		if pick == nil || t.Reschedules > pick.Reschedules || (t.Reschedules == pick.Reschedules && t.CreatedAt.Before(pick.CreatedAt)) {
			pick, reason = t, r
		}
	}

	if pick == nil {
		if !quieter {
			return nil
		}
		return &WeekRecapCard{
			Kind:     "slipped",
			Headline: "Next week, just one plan on Monday.",
			Body:     "Small weeks restart best with one thing. Pick it Monday morning and let the rest wait.",
		}
	}

	hour, why := 9, ""
	if peakHour != nil && *peakHour >= 6 && *peakHour <= 20 {
		hour, why = *peakHour, ", when you usually get going,"
	}
	at, dayWord := nextMonday(now, loc, hour)
	c := &WeekRecapCard{Kind: "slipped", Headline: "One thing to try next week."}
	c.Body = fmt.Sprintf("%s A 10-minute first step %s at %s%s might be easier to start.", reason, dayWord, formatHour(hour), why)
	c.Action = &WeekRecapAction{
		Kind:       "plan",
		Label:      "Plan it for " + dayWord,
		TaskID:     pick.ID,
		CategoryID: pick.CategoryID,
		Step:       "Start with 10 minutes",
		Size:       "10m",
		At:         at.Format(time.RFC3339),
		Done:       fmt.Sprintf("Planned: %s, %s · 10 min", capitalize(dayWord), formatHour(hour)),
	}
	return c
}

// nextMonday returns the next local Monday at hour (today if it's Monday and
// the hour is still ahead) plus how to say it.
func nextMonday(now time.Time, loc *time.Location, hour int) (time.Time, string) {
	l := now.In(loc)
	day := time.Date(l.Year(), l.Month(), l.Day(), hour, 0, 0, 0, loc)
	if day.Weekday() == time.Monday && day.After(l) {
		return day, "today"
	}
	add := (8 - int(day.Weekday())) % 7
	if add == 0 {
		add = 7
	}
	t := day.AddDate(0, 0, add)
	if add == 1 {
		return t, "tomorrow"
	}
	return t, "Monday"
}

func shareCard(isFirst bool, cur, planClosed int, habit *habitPick, run int) WeekRecapCard {
	c := WeekRecapCard{Kind: "share"}
	if isFirst {
		c.Headline = "I finished my first week on Kindred."
		parts := []string{}
		if cur > 0 {
			parts = append(parts, plural(cur, "task", "tasks"))
		}
		if planClosed > 0 {
			parts = append(parts, fmt.Sprintf("my Plan ring closed %s", plural(planClosed, "day", "days")))
		}
		if len(parts) > 0 {
			c.Body = capitalize(strings.Join(parts, ", and ")) + "."
		}
	} else {
		if cur > 0 {
			c.Headline = fmt.Sprintf("I finished %s this week.", plural(cur, "task", "tasks"))
		} else {
			c.Headline = "I took a quieter week."
		}
		parts := []string{}
		if planClosed > 0 {
			parts = append(parts, fmt.Sprintf("Closed my Plan ring %s.", plural(planClosed, "day", "days")))
		}
		if habit != nil && run >= 2 {
			parts = append(parts, fmt.Sprintf("%s is %d weeks in.", habit.title, run))
		}
		c.Body = strings.Join(parts, " ")
	}
	c.ShareText = strings.TrimSpace(c.Headline+" "+c.Body) + " kindredtodo.com"
	return c
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

var numberWords = []string{"", "one", "two", "three"}

func teaser(cur int, habit *habitPick, run int, supporters *WeekRecapCard) string {
	parts := []string{plural(cur, "task", "tasks")}
	if habit != nil && run >= 2 {
		parts = append(parts, fmt.Sprintf("%d weeks of %s", run, habit.title))
	}
	if supporters != nil {
		n := len(supporters.People)
		switch {
		case n == 1:
			parts = append(parts, "a friend who showed up")
		case n <= 3 && len(supporters.People) == n && !strings.Contains(supporters.Headline, "others"):
			parts = append(parts, numberWords[n]+" friends who showed up")
		default:
			parts = append(parts, "friends who showed up")
		}
	}
	return capitalize(joinNames(parts)) + "."
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
