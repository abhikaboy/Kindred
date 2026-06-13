package analytics

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

// --- lite inputs -------------------------------------------------------------
// These decouple the pure computation from MongoDB documents so it can be unit
// tested with synthetic data. The service maps Mongo docs into these.

type AnalyticsTaskLite struct {
	CategoryID  string
	CompletedAt time.Time
	Deadline    *time.Time
	KudosCount  int
}

type AnalyticsCategoryMeta struct {
	ID        string
	Name      string
	Workspace string
}

type AnalyticsHabitLite struct {
	TemplateID      string
	CategoryID      string
	Title           string
	Frequency       string
	Streak          int
	CompletionDates []time.Time
	NextDueAt       *time.Time
}

type AnalyticsOpenTaskLite struct {
	ID         string
	Title      string
	CategoryID string
	CreatedAt  time.Time
	Deadline   *time.Time
	Priority   int
	KudosCount int
}

type computeInput struct {
	Range            string
	Now              time.Time
	WorkspaceFilter  string
	CategoryFilter   string
	Completed        []AnalyticsTaskLite // covers the heatmap window (>= 91 days) and both periods
	Categories       []AnalyticsCategoryMeta
	Habits           []AnalyticsHabitLite
	OpenTasks        []AnalyticsOpenTaskLite
	ProxyCategoryIDs map[string]bool // sentinel "!-proxy-!" categories — excluded everywhere
	SupportCurrent   int             // kudos received in the current period
	SupportPrev      int             // kudos received in the previous period
}

// --- palette / thresholds ----------------------------------------------------

var palette = []string{
	"#854DFF", // Kindred purple
	"#2DD4BF", // teal
	"#F59E0B", // amber
	"#EC4899", // pink
	"#3B82F6", // blue
	"#22C55E", // green
	"#A855F7", // violet
	"#F97316", // orange
}

const (
	otherColor = "#6B7280"
	otherID    = "other"
	otherName  = "Other"

	heatmapDays = 91 // trailing 13 weeks
)

func levelForCount(c int) int {
	switch {
	case c <= 0:
		return 0
	case c <= 2:
		return 1
	case c <= 4:
		return 2
	case c <= 6:
		return 3
	default:
		return 4
	}
}

// --- date helpers ------------------------------------------------------------

func startOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

func startOfWeekMonday(t time.Time) time.Time {
	d := startOfDay(t)
	offset := (int(d.Weekday()) + 6) % 7 // Sunday=0 -> 6, Monday=1 -> 0
	return d.AddDate(0, 0, -offset)
}

func startOfMonth(t time.Time) time.Time {
	y, m, _ := t.Date()
	return time.Date(y, m, 1, 0, 0, 0, 0, t.Location())
}

func daysInMonth(t time.Time) int {
	return startOfMonth(t).AddDate(0, 1, -1).Day()
}

func shortWeekday(w time.Weekday) string {
	return [...]string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}[int(w)]
}

func windowBounds(rng string, now time.Time) (curStart, curEnd, prevStart, prevEnd time.Time, unit string) {
	switch rng {
	case RangeMonth:
		curStart = startOfMonth(now)
		curEnd = curStart.AddDate(0, 1, 0)
		prevStart = curStart.AddDate(0, -1, 0)
		prevEnd = curStart
		unit = "week"
	case RangeSixMonth:
		curStart = startOfMonth(now).AddDate(0, -5, 0)
		curEnd = startOfMonth(now).AddDate(0, 1, 0)
		prevStart = curStart.AddDate(0, -6, 0)
		prevEnd = curStart
		unit = "month"
	default: // week
		curStart = startOfWeekMonday(now)
		curEnd = curStart.AddDate(0, 0, 7)
		prevStart = curStart.AddDate(0, 0, -7)
		prevEnd = curStart
		unit = "day"
	}
	return
}

func bucketCount(unit string, curStart time.Time) int {
	switch unit {
	case "day":
		return 7
	case "week":
		return (daysInMonth(curStart)-1)/7 + 1
	case "month":
		return 6
	}
	return 7
}

func bucketIndex(unit string, curStart, t time.Time) int {
	switch unit {
	case "day":
		return int(startOfDay(t).Sub(curStart).Hours() / 24)
	case "week":
		return (t.Day() - 1) / 7
	case "month":
		return (t.Year()-curStart.Year())*12 + int(t.Month()) - int(curStart.Month())
	}
	return 0
}

func bucketLabel(unit string, curStart time.Time, idx int) string {
	switch unit {
	case "day":
		return shortWeekday(curStart.AddDate(0, 0, idx).Weekday())
	case "week":
		return fmt.Sprintf("W%d", idx+1)
	case "month":
		return curStart.AddDate(0, idx, 0).Month().String()[:3]
	}
	return ""
}

func bucketStart(unit string, curStart time.Time, idx int) time.Time {
	switch unit {
	case "day":
		return curStart.AddDate(0, 0, idx)
	case "week":
		return curStart.AddDate(0, 0, idx*7)
	case "month":
		return curStart.AddDate(0, idx, 0)
	}
	return curStart
}

// --- small numeric helpers ---------------------------------------------------

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func pctChange(prev, cur int) float64 {
	if prev == 0 {
		if cur == 0 {
			return 0
		}
		return 100
	}
	return math.Round(float64(cur-prev) / float64(prev) * 100)
}

func pctInt(part, whole int) int {
	if whole == 0 {
		return 0
	}
	return int(math.Round(float64(part) / float64(whole) * 100))
}

func direction(delta float64) string {
	switch {
	case delta > 0:
		return "up"
	case delta < 0:
		return "down"
	default:
		return "flat"
	}
}

func rangeSuffix(rng string) string {
	switch rng {
	case RangeMonth:
		return "vs last month"
	case RangeSixMonth:
		return "vs prior 6 months"
	default:
		return "vs last week"
	}
}

func signedPct(d float64) string {
	if d >= 0 {
		return fmt.Sprintf("+%d%%", int(d))
	}
	return fmt.Sprintf("%d%%", int(d))
}

func signedInt(d int) string {
	if d >= 0 {
		return fmt.Sprintf("+%d", d)
	}
	return fmt.Sprintf("%d", d)
}

// --- task helpers ------------------------------------------------------------

func tasksInWindow(tasks []AnalyticsTaskLite, start, end time.Time) []AnalyticsTaskLite {
	out := make([]AnalyticsTaskLite, 0, len(tasks))
	for _, t := range tasks {
		if !t.CompletedAt.Before(start) && t.CompletedAt.Before(end) {
			out = append(out, t)
		}
	}
	return out
}

func countByCategory(tasks []AnalyticsTaskLite) map[string]int {
	m := map[string]int{}
	for _, t := range tasks {
		m[t.CategoryID]++
	}
	return m
}

// orderCategories returns category IDs sorted by descending count (ties broken
// by ID for determinism).
func orderCategories(counts map[string]int) []string {
	ids := make([]string, 0, len(counts))
	for id := range counts {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool {
		if counts[ids[i]] != counts[ids[j]] {
			return counts[ids[i]] > counts[ids[j]]
		}
		return ids[i] < ids[j]
	})
	return ids
}

func onTimeStats(tasks []AnalyticsTaskLite) (withDeadline, onTime int) {
	for _, t := range tasks {
		if t.Deadline == nil {
			continue
		}
		withDeadline++
		if !t.CompletedAt.After(*t.Deadline) {
			onTime++
		}
	}
	return
}

func sumKudos(tasks []AnalyticsTaskLite) int {
	total := 0
	for _, t := range tasks {
		total += t.KudosCount
	}
	return total
}

// --- main computation --------------------------------------------------------

func computeAnalytics(in computeInput) AnalyticsResponse {
	now := in.Now
	curStart, curEnd, prevStart, prevEnd, unit := windowBounds(in.Range, now)

	metaByID := map[string]AnalyticsCategoryMeta{}
	for _, c := range in.Categories {
		metaByID[c.ID] = c
	}
	nameOf := func(id string) string {
		if m, ok := metaByID[id]; ok && m.Name != "" {
			return m.Name
		}
		return "Uncategorized"
	}
	workspaceOf := func(id string) string {
		if m, ok := metaByID[id]; ok {
			return m.Workspace
		}
		return ""
	}
	inScope := func(catID string) bool {
		if in.ProxyCategoryIDs[catID] {
			return false // sentinel "!-proxy-!" categories are not real
		}
		if in.CategoryFilter != "" && catID != in.CategoryFilter {
			return false
		}
		if in.WorkspaceFilter != "" && workspaceOf(catID) != in.WorkspaceFilter {
			return false
		}
		return true
	}

	scoped := make([]AnalyticsTaskLite, 0, len(in.Completed))
	for _, t := range in.Completed {
		if inScope(t.CategoryID) {
			scoped = append(scoped, t)
		}
	}

	cur := tasksInWindow(scoped, curStart, curEnd)
	prev := tasksInWindow(scoped, prevStart, prevEnd)

	curByCat := countByCategory(cur)
	orderedCats := orderCategories(curByCat)
	colorByID := map[string]string{}
	for i, id := range orderedCats {
		colorByID[id] = palette[i%len(palette)]
	}

	top := orderedCats
	if len(top) > 4 {
		top = top[:4]
	}
	topSet := map[string]bool{}
	for _, id := range top {
		topSet[id] = true
	}
	hasOther := len(orderedCats) > len(top)

	nb := bucketCount(unit, curStart)

	resp := AnalyticsResponse{
		Range:           in.Range,
		WorkspaceFilter: in.WorkspaceFilter,
		CategoryFilter:  in.CategoryFilter,
		GeneratedAt:     now,
	}
	resp.Signals = computeSignals(in.Range, cur, prev, in.SupportCurrent, in.SupportPrev)
	resp.Progress = computeProgress(unit, curStart, nb, cur, prev, top, topSet, hasOther, colorByID, nameOf)
	resp.CategoryShare = computeShare(unit, curStart, nb, cur, orderedCats, top, topSet, colorByID, nameOf)
	resp.Heatmap = computeHeatmap(scoped, now)
	resp.Habits = computeHabits(in.Habits, inScope, curStart, curEnd)
	resp.CategoryHealth = computeCategoryHealth(unit, curStart, nb, cur, orderedCats, colorByID, nameOf, workspaceOf)
	resp.WorkspaceHealth = computeWorkspaceHealth(cur, workspaceOf)
	resp.BestTime = computeBestTime(cur, now)
	resp.Attention = computeAttention(in.OpenTasks, inScope, nameOf, workspaceOf, now)

	return resp
}

func computeBestTime(cur []AnalyticsTaskLite, now time.Time) AnalyticsBestTime {
	grid := map[int]map[int]int{} // weekday(Mon=0) -> hour -> count
	maxCount := 0
	peakWd, peakHour, peakCount := 0, 0, 0
	for _, t := range cur {
		wd := (int(t.CompletedAt.Weekday()) + 6) % 7
		h := t.CompletedAt.Hour()
		if grid[wd] == nil {
			grid[wd] = map[int]int{}
		}
		grid[wd][h]++
		if grid[wd][h] > peakCount {
			peakCount = grid[wd][h]
			peakWd, peakHour = wd, h
		}
	}

	cells := []AnalyticsBestTimeCell{}
	for wd := 0; wd < 7; wd++ {
		for h := 0; h < 24; h++ {
			c := grid[wd][h]
			if c == 0 {
				continue
			}
			if c > maxCount {
				maxCount = c
			}
			cells = append(cells, AnalyticsBestTimeCell{Weekday: wd, Hour: h, Count: c, Level: levelForCount(c)})
		}
	}

	return AnalyticsBestTime{Cells: cells, MaxCount: maxCount, Takeaway: bestTimeTakeaway(peakWd, peakHour, peakCount)}
}

func bestTimeTakeaway(peakWd, peakHour, peakCount int) string {
	if peakCount == 0 {
		return "Not enough activity yet to find your peak time."
	}
	return fmt.Sprintf("Your peak time is %s around %s.", monWeekdayName(peakWd), formatHour12(peakHour))
}

func monWeekdayName(monIdx int) string {
	names := [...]string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	if monIdx < 0 || monIdx > 6 {
		return ""
	}
	return names[monIdx]
}

func formatHour12(h int) string {
	switch {
	case h == 0:
		return "12 AM"
	case h < 12:
		return fmt.Sprintf("%d AM", h)
	case h == 12:
		return "12 PM"
	default:
		return fmt.Sprintf("%d PM", h-12)
	}
}

func computeAttention(open []AnalyticsOpenTaskLite, inScope func(string) bool, nameOf, workspaceOf func(string) string, now time.Time) AnalyticsAttention {
	tasks := []AnalyticsAttentionTask{}
	for _, t := range open {
		if !inScope(t.CategoryID) {
			continue
		}
		daysOpen := int(now.Sub(t.CreatedAt).Hours() / 24)
		if daysOpen < 0 {
			daysOpen = 0
		}
		pastDue := t.Deadline != nil && t.Deadline.Before(now)
		flagged := pastDue || daysOpen >= 7 || (t.Deadline == nil && daysOpen >= 5)
		if !flagged {
			continue
		}
		reasons := []string{}
		if pastDue {
			reasons = append(reasons, "Past due")
		}
		if t.Deadline == nil {
			reasons = append(reasons, "No deadline")
		}
		if t.KudosCount == 0 {
			reasons = append(reasons, "No Kudos")
		}
		if t.Priority >= 3 {
			reasons = append(reasons, "High priority")
		}
		if daysOpen >= 7 {
			reasons = append(reasons, fmt.Sprintf("Open %d days", daysOpen))
		}
		at := AnalyticsAttentionTask{
			ID:         t.ID,
			Title:      t.Title,
			Category:   nameOf(t.CategoryID),
			CategoryID: t.CategoryID,
			Workspace:  workspaceOf(t.CategoryID),
			DaysOpen:   daysOpen,
			Reasons:    reasons,
		}
		if t.Deadline != nil {
			s := t.Deadline.Format(time.RFC3339)
			at.Deadline = &s
		}
		tasks = append(tasks, at)
	}

	sort.SliceStable(tasks, func(i, j int) bool {
		pi, pj := hasReason(tasks[i].Reasons, "Past due"), hasReason(tasks[j].Reasons, "Past due")
		if pi != pj {
			return pi
		}
		return tasks[i].DaysOpen > tasks[j].DaysOpen
	})
	if len(tasks) > 10 {
		tasks = tasks[:10]
	}
	return AnalyticsAttention{Tasks: tasks}
}

func hasReason(reasons []string, want string) bool {
	for _, r := range reasons {
		if r == want {
			return true
		}
	}
	return false
}

func computeSignals(rng string, cur, prev []AnalyticsTaskLite, supportCur, supportPrev int) AnalyticsSignals {
	suffix := rangeSuffix(rng)

	doneCur, donePrev := len(cur), len(prev)
	momDelta := pctChange(donePrev, doneCur)
	momentum := AnalyticsSignal{
		Label:      "Momentum",
		Value:      fmt.Sprintf("%d done", doneCur),
		RawValue:   float64(doneCur),
		Delta:      momDelta,
		DeltaLabel: fmt.Sprintf("%s %s", signedPct(momDelta), suffix),
		Direction:  direction(momDelta),
	}

	wdCur, otCur := onTimeStats(cur)
	wdPrev, otPrev := onTimeStats(prev)
	onTimeCur := pctInt(otCur, wdCur)
	onTimePrev := pctInt(otPrev, wdPrev)
	timeDelta := float64(onTimeCur - onTimePrev)
	timing := AnalyticsSignal{
		Label:      "Timing",
		Value:      fmt.Sprintf("%d%%", onTimeCur),
		RawValue:   float64(onTimeCur),
		Delta:      timeDelta,
		DeltaLabel: fmt.Sprintf("%s pts", signedInt(onTimeCur-onTimePrev)),
		Direction:  direction(timeDelta),
	}

	supDelta := float64(supportCur - supportPrev)
	support := AnalyticsSignal{
		Label:      "Support",
		Value:      fmt.Sprintf("%d Kudos", supportCur),
		RawValue:   float64(supportCur),
		Delta:      supDelta,
		DeltaLabel: fmt.Sprintf("%s %s", signedInt(supportCur-supportPrev), suffix),
		Direction:  direction(supDelta),
	}

	return AnalyticsSignals{Momentum: momentum, Timing: timing, Support: support}
}

func computeProgress(unit string, curStart time.Time, nb int, cur, prev []AnalyticsTaskLite, top []string, topSet map[string]bool, hasOther bool, colorByID map[string]string, nameOf func(string) string) AnalyticsProgress {
	buckets := make([]AnalyticsProgressBucket, nb)
	segCounts := make([]map[string]int, nb)
	for i := 0; i < nb; i++ {
		buckets[i] = AnalyticsProgressBucket{
			Label:    bucketLabel(unit, curStart, i),
			Date:     bucketStart(unit, curStart, i).Format("2006-01-02"),
			Segments: []AnalyticsProgressSegment{},
		}
		segCounts[i] = map[string]int{}
	}

	for _, t := range cur {
		idx := bucketIndex(unit, curStart, t.CompletedAt)
		if idx < 0 || idx >= nb {
			continue
		}
		key := t.CategoryID
		if !topSet[key] {
			key = otherID
		}
		segCounts[idx][key]++
		buckets[idx].Total++
	}

	for i := 0; i < nb; i++ {
		for _, cid := range top {
			if c := segCounts[i][cid]; c > 0 {
				buckets[i].Segments = append(buckets[i].Segments, AnalyticsProgressSegment{
					CategoryID: cid, Name: nameOf(cid), Color: colorByID[cid], Count: c,
				})
			}
		}
		if c := segCounts[i][otherID]; c > 0 {
			buckets[i].Segments = append(buckets[i].Segments, AnalyticsProgressSegment{
				CategoryID: otherID, Name: otherName, Color: otherColor, Count: c,
			})
		}
	}

	legend := make([]AnalyticsLegendItem, 0, len(top)+1)
	for _, cid := range top {
		legend = append(legend, AnalyticsLegendItem{CategoryID: cid, Name: nameOf(cid), Color: colorByID[cid]})
	}
	if hasOther {
		legend = append(legend, AnalyticsLegendItem{CategoryID: otherID, Name: otherName, Color: otherColor})
	}

	total := len(cur)
	prevTotal := len(prev)
	return AnalyticsProgress{
		Total:      total,
		PrevTotal:  prevTotal,
		Delta:      pctChange(prevTotal, total),
		BucketUnit: unit,
		Buckets:    buckets,
		Legend:     legend,
		Takeaway:   progressTakeaway(unit, buckets, nameOf),
	}
}

func progressTakeaway(unit string, buckets []AnalyticsProgressBucket, nameOf func(string) string) string {
	best := -1
	bestTotal := 0
	for i, b := range buckets {
		if b.Total > bestTotal {
			bestTotal = b.Total
			best = i
		}
	}
	if best < 0 || bestTotal == 0 {
		return "No completed tasks in this period yet."
	}
	b := buckets[best]
	topName := ""
	topCount := 0
	for _, s := range b.Segments {
		if s.Count > topCount {
			topCount = s.Count
			topName = s.Name
		}
	}
	noun := map[string]string{"day": "day", "week": "week", "month": "month"}[unit]
	if topName != "" {
		return fmt.Sprintf("%s carried the %s: %d done, mostly %s.", b.Label, noun, bestTotal, topName)
	}
	return fmt.Sprintf("%s carried the %s with %d done.", b.Label, noun, bestTotal)
}

func computeShare(unit string, curStart time.Time, nb int, cur []AnalyticsTaskLite, orderedCats, top []string, topSet map[string]bool, colorByID map[string]string, nameOf func(string) string) AnalyticsCategoryShare {
	counts := countByCategory(cur)
	total := len(cur)

	// Donut slices: top 6 categories, remainder grouped into Other.
	slices := make([]AnalyticsShareSlice, 0, 7)
	otherCount := 0
	for i, cid := range orderedCats {
		if i < 6 {
			slices = append(slices, AnalyticsShareSlice{
				CategoryID: cid, Name: nameOf(cid), Color: colorByID[cid],
				Count: counts[cid], Pct: float64(pctInt(counts[cid], total)),
			})
		} else {
			otherCount += counts[cid]
		}
	}
	if otherCount > 0 {
		slices = append(slices, AnalyticsShareSlice{
			CategoryID: otherID, Name: otherName, Color: otherColor,
			Count: otherCount, Pct: float64(pctInt(otherCount, total)),
		})
	}

	// 100% stacked bands per bucket (month range → weekly bands, sixmonth → monthly).
	bands := []AnalyticsShareBand{}
	if unit == "week" || unit == "month" {
		segCounts := make([]map[string]int, nb)
		totals := make([]int, nb)
		for i := 0; i < nb; i++ {
			segCounts[i] = map[string]int{}
		}
		for _, t := range cur {
			idx := bucketIndex(unit, curStart, t.CompletedAt)
			if idx < 0 || idx >= nb {
				continue
			}
			key := t.CategoryID
			if !topSet[key] {
				key = otherID
			}
			segCounts[idx][key]++
			totals[idx]++
		}
		for i := 0; i < nb; i++ {
			band := AnalyticsShareBand{Label: bucketLabel(unit, curStart, i), Slices: []AnalyticsShareSlice{}}
			for _, cid := range top {
				if c := segCounts[i][cid]; c > 0 {
					band.Slices = append(band.Slices, AnalyticsShareSlice{
						CategoryID: cid, Name: nameOf(cid), Color: colorByID[cid],
						Count: c, Pct: float64(pctInt(c, totals[i])),
					})
				}
			}
			if c := segCounts[i][otherID]; c > 0 {
				band.Slices = append(band.Slices, AnalyticsShareSlice{
					CategoryID: otherID, Name: otherName, Color: otherColor,
					Count: c, Pct: float64(pctInt(c, totals[i])),
				})
			}
			bands = append(bands, band)
		}
	}

	return AnalyticsCategoryShare{
		Slices:   slices,
		OverTime: bands,
		Takeaway: shareTakeaway(slices),
	}
}

func shareTakeaway(slices []AnalyticsShareSlice) string {
	if len(slices) == 0 {
		return "No category activity in this period yet."
	}
	top := slices[0]
	if top.CategoryID == otherID {
		return "Your focus was spread across several categories."
	}
	return fmt.Sprintf("%s led this period at %d%%.", top.Name, int(top.Pct))
}

func computeHeatmap(scoped []AnalyticsTaskLite, now time.Time) AnalyticsHeatmap {
	end := startOfDay(now)
	start := end.AddDate(0, 0, -(heatmapDays - 1))

	counts := map[string]int{}
	weekdayTotals := [7]int{}
	total := 0
	for _, t := range scoped {
		d := startOfDay(t.CompletedAt)
		if d.Before(start) || d.After(end) {
			continue
		}
		key := d.Format("2006-01-02")
		counts[key]++
		weekdayTotals[int(d.Weekday())]++
		total++
	}

	days := make([]AnalyticsHeatmapDay, 0, heatmapDays)
	maxCount := 0
	for i := 0; i < heatmapDays; i++ {
		d := start.AddDate(0, 0, i)
		key := d.Format("2006-01-02")
		c := counts[key]
		if c > maxCount {
			maxCount = c
		}
		days = append(days, AnalyticsHeatmapDay{Date: key, Count: c, Level: levelForCount(c)})
	}

	return AnalyticsHeatmap{
		Days:     days,
		MaxCount: maxCount,
		Total:    total,
		Takeaway: heatmapTakeaway(weekdayTotals, total),
	}
}

func heatmapTakeaway(weekdayTotals [7]int, total int) string {
	if total == 0 {
		return "No activity recorded yet."
	}
	type wd struct {
		day   time.Weekday
		count int
	}
	ranked := make([]wd, 0, 7)
	for i := 0; i < 7; i++ {
		ranked = append(ranked, wd{time.Weekday(i), weekdayTotals[i]})
	}
	sort.SliceStable(ranked, func(i, j int) bool { return ranked[i].count > ranked[j].count })
	names := []string{}
	for _, r := range ranked {
		if r.count == 0 || len(names) >= 3 {
			break
		}
		names = append(names, shortWeekday(r.day))
	}
	if len(names) == 0 {
		return "No activity recorded yet."
	}
	return fmt.Sprintf("Most active on %s.", strings.Join(names, ", "))
}

func computeHabits(habits []AnalyticsHabitLite, inScope func(string) bool, curStart, curEnd time.Time) AnalyticsHabits {
	rows := make([]AnalyticsHabitRow, 0, len(habits))
	for _, h := range habits {
		if h.CategoryID != "" && !inScope(h.CategoryID) {
			continue
		}
		completed := 0
		for _, d := range h.CompletionDates {
			if !d.Before(curStart) && d.Before(curEnd) {
				completed++
			}
		}
		total := expectedOccurrences(h.Frequency, curStart, curEnd)
		if total < completed {
			total = completed
		}
		if total <= 0 {
			total = maxInt(completed, 1)
		}
		row := AnalyticsHabitRow{
			TemplateID:  h.TemplateID,
			Title:       h.Title,
			Frequency:   h.Frequency,
			Completed:   completed,
			Total:       total,
			Dots:        buildDots(total, completed),
			RhythmLabel: rhythmLabel(h.Frequency, h.Streak),
			Status:      habitStatus(completed, total),
		}
		if h.NextDueAt != nil {
			s := h.NextDueAt.Format(time.RFC3339)
			row.NextDueAt = &s
		}
		rows = append(rows, row)
	}

	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].Completed != rows[j].Completed {
			return rows[i].Completed > rows[j].Completed
		}
		return rows[i].Title < rows[j].Title
	})
	if len(rows) > 8 {
		rows = rows[:8]
	}

	return AnalyticsHabits{Rows: rows, Takeaway: habitsTakeaway(rows)}
}

func expectedOccurrences(freq string, start, end time.Time) int {
	days := int(end.Sub(start).Hours() / 24)
	if days < 1 {
		days = 1
	}
	switch strings.ToLower(freq) {
	case "daily":
		return days
	case "weekly":
		return maxInt(days/7, 1)
	case "monthly":
		return maxInt(days/30, 1)
	default:
		return days
	}
}

func buildDots(total, completed int) []bool {
	n := minInt(total, 12)
	if n <= 0 {
		return []bool{}
	}
	filled := minInt(completed, n)
	dots := make([]bool, n)
	for i := 0; i < filled; i++ {
		dots[i] = true
	}
	return dots
}

func rhythmLabel(freq string, streak int) string {
	if streak <= 0 {
		return "Needs a reset"
	}
	switch strings.ToLower(freq) {
	case "daily":
		return fmt.Sprintf("%d-day run", streak)
	case "weekly":
		return fmt.Sprintf("%d weeks consistent", streak)
	case "monthly":
		return fmt.Sprintf("%d months kept up", streak)
	default:
		return fmt.Sprintf("%d kept up", streak)
	}
}

func habitStatus(completed, total int) string {
	if completed == 0 {
		return "light"
	}
	ratio := float64(completed) / float64(total)
	switch {
	case ratio >= 1:
		return "healthy"
	case ratio >= 0.6:
		return "steady"
	default:
		return "needs-reset"
	}
}

func habitsTakeaway(rows []AnalyticsHabitRow) string {
	if len(rows) == 0 {
		return "No recurring tasks yet."
	}
	// Strongest = highest streak (parsed from completed ordering is by completed;
	// pick the row whose status is healthy, else the first row).
	strongest := rows[0]
	for _, r := range rows {
		if r.Status == "healthy" {
			strongest = r
			break
		}
	}
	for _, r := range rows {
		if r.Status == "needs-reset" {
			return fmt.Sprintf("%s is your strongest rhythm. %s needs a reset.", strongest.Title, r.Title)
		}
	}
	return fmt.Sprintf("%s is your strongest rhythm.", strongest.Title)
}

func computeCategoryHealth(unit string, curStart time.Time, nb int, cur []AnalyticsTaskLite, orderedCats []string, colorByID map[string]string, nameOf func(string) string, workspaceOf func(string) string) AnalyticsCategoryHealth {
	rows := make([]AnalyticsCategoryHealthRow, 0, len(orderedCats))
	for _, cid := range orderedCats {
		catTasks := make([]AnalyticsTaskLite, 0)
		spark := make([]int, nb)
		for _, t := range cur {
			if t.CategoryID != cid {
				continue
			}
			catTasks = append(catTasks, t)
			if idx := bucketIndex(unit, curStart, t.CompletedAt); idx >= 0 && idx < nb {
				spark[idx]++
			}
		}
		done := len(catTasks)
		if done == 0 {
			continue
		}
		wd, ot := onTimeStats(catTasks)
		onTimePct := pctInt(ot, wd)
		kudos := sumKudos(catTasks)
		rows = append(rows, AnalyticsCategoryHealthRow{
			CategoryID: cid,
			Name:       nameOf(cid),
			Workspace:  workspaceOf(cid),
			Color:      colorByID[cid],
			Done:       done,
			OnTimePct:  onTimePct,
			Kudos:      kudos,
			Status:     healthStatus(done, wd, onTimePct),
			Sparkline:  spark,
		})
	}

	sort.SliceStable(rows, func(i, j int) bool {
		si, sj := statusSeverity(rows[i].Status), statusSeverity(rows[j].Status)
		if si != sj {
			return si > sj
		}
		return rows[i].Done > rows[j].Done
	})
	if len(rows) > 8 {
		rows = rows[:8]
	}
	return AnalyticsCategoryHealth{Rows: rows}
}

func healthStatus(done, withDeadline, onTimePct int) string {
	if done == 0 {
		return "light"
	}
	if withDeadline == 0 {
		return "steady" // no deadlines to judge timing against
	}
	switch {
	case onTimePct >= 85:
		return "healthy"
	case onTimePct >= 70:
		return "steady"
	case onTimePct >= 50:
		return "needs-attention"
	default:
		return "slipping"
	}
}

func statusSeverity(status string) int {
	switch status {
	case "slipping":
		return 4
	case "needs-attention", "needs-reset":
		return 3
	case "steady":
		return 2
	case "healthy":
		return 1
	default: // light
		return 0
	}
}

func computeWorkspaceHealth(cur []AnalyticsTaskLite, workspaceOf func(string) string) AnalyticsWorkspaceHealth {
	type agg struct {
		done         int
		withDeadline int
		onTime       int
		kudos        int
	}
	byWs := map[string]*agg{}
	order := []string{}
	for _, t := range cur {
		ws := workspaceOf(t.CategoryID)
		if ws == "" {
			ws = "Other"
		}
		a, ok := byWs[ws]
		if !ok {
			a = &agg{}
			byWs[ws] = a
			order = append(order, ws)
		}
		a.done++
		a.kudos += t.KudosCount
		if t.Deadline != nil {
			a.withDeadline++
			if !t.CompletedAt.After(*t.Deadline) {
				a.onTime++
			}
		}
	}

	rows := make([]AnalyticsWorkspaceHealthRow, 0, len(order))
	for _, ws := range order {
		a := byWs[ws]
		onTimePct := pctInt(a.onTime, a.withDeadline)
		rows = append(rows, AnalyticsWorkspaceHealthRow{
			Workspace: ws,
			Done:      a.done,
			OnTimePct: onTimePct,
			Kudos:     a.kudos,
			Status:    healthStatus(a.done, a.withDeadline, onTimePct),
		})
	}
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].Done > rows[j].Done })
	return AnalyticsWorkspaceHealth{Rows: rows}
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
