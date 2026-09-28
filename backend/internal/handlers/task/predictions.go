package task

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Task predictions: "Suggested for you" in quick capture. Signals are mined
// deterministically from the user's own history, and the model only turns a
// signal into a concrete next task, so every suggestion has a grounded reason.

const (
	predictionHistoryDays  = 120
	predictionHistoryLimit = 400
	predictionLimit        = 3
	predictionCacheTTL     = 2 * time.Hour
	dayDuration            = 24 * time.Hour
)

type PredictionCategory struct {
	ID        string
	Name      string
	Workspace string
	OpenCount int
}

type PredictionOpenTask struct {
	Content    string
	CategoryID string
	Deadline   *time.Time
}

type PredictionHistoryTask struct {
	Content       string
	CategoryID    string
	TimeCompleted time.Time
	Recurring     bool
}

// PredictionSignal is one reason a new task could be needed right now.
type PredictionSignal struct {
	ID         string
	Kind       string // follow_up | deadline | category_rhythm | weekday
	CategoryID string
	Detail     string // context for the model
	Reason     string // user-facing, shown under the suggestion
}

type PredictionSignals struct {
	Signals    []PredictionSignal
	Categories []PredictionCategory
	// Every title the user already has or had, so predictions never replay one
	KnownTitles []string
}

type TaskPrediction struct {
	Content    string `json:"content" doc:"Suggested task text, ready to drop into the composer"`
	Reason     string `json:"reason" doc:"Why this is suggested now"`
	Kind       string `json:"kind" doc:"Signal behind the suggestion: follow_up, deadline, category_rhythm or weekday"`
	CategoryID string `json:"categoryId,omitempty" doc:"Category the task most likely belongs in"`
}

// predictionDraft mirrors gemini.PredictTasksFlowOutput's items.
type predictionDraft struct {
	Content    string `json:"content"`
	SignalID   string `json:"signalId"`
	CategoryID string `json:"categoryId,omitempty"`
}

var weekdayPlural = []string{"Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"}

func dayIndex(t time.Time, loc *time.Location) int {
	y, m, d := t.In(loc).Date()
	return int(time.Date(y, m, d, 0, 0, 0, 0, time.UTC).Unix() / 86400)
}

func medianInt(xs []int) float64 {
	s := append([]int(nil), xs...)
	sort.Ints(s)
	n := len(s)
	if n%2 == 1 {
		return float64(s[n/2])
	}
	return float64(s[n/2-1]+s[n/2]) / 2
}

func rhythmPhrase(days float64) string {
	switch {
	case days <= 1.5:
		return "most days"
	case days >= 6 && days <= 8:
		return "weekly"
	case days >= 13 && days <= 16:
		return "every 2 weeks"
	case days >= 27 && days <= 33:
		return "monthly"
	}
	return fmt.Sprintf("every %d days", int(days+0.5))
}

func quoteTitle(s string) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > 32 {
		s = strings.TrimSpace(string(r[:31])) + "…"
	}
	return "“" + s + "”"
}

func dueDayPhrase(deadline, now time.Time, loc *time.Location) string {
	switch days := dayIndex(deadline, loc) - dayIndex(now, loc); {
	case days <= 0:
		return "today"
	case days == 1:
		return "tomorrow"
	case days < 7:
		return deadline.In(loc).Weekday().String()
	default:
		return deadline.In(loc).Format("Jan 2")
	}
}

// BuildPredictionSignals is pure so the ranking can be tested without Mongo.
func BuildPredictionSignals(cats []PredictionCategory, open []PredictionOpenTask, history []PredictionHistoryTask, now time.Time, loc *time.Location) PredictionSignals {
	catByID := map[string]PredictionCategory{}
	for _, c := range cats {
		catByID[c.ID] = c
	}
	known := make([]string, 0, len(open)+len(history))
	for _, t := range open {
		known = append(known, t.Content)
	}
	for _, t := range history {
		known = append(known, t.Content)
	}

	var signals []PredictionSignal
	add := func(s PredictionSignal) {
		s.ID = fmt.Sprintf("S%d", len(signals)+1)
		signals = append(signals, s)
	}
	today := dayIndex(now, loc)

	// Upcoming deadlines: something to prepare for, soonest first
	var upcoming []PredictionOpenTask
	for _, t := range open {
		if t.Deadline == nil {
			continue
		}
		if d := dayIndex(*t.Deadline, loc) - today; d >= 0 && d <= 7 {
			upcoming = append(upcoming, t)
		}
	}
	sort.Slice(upcoming, func(i, j int) bool { return upcoming[i].Deadline.Before(*upcoming[j].Deadline) })
	for i, t := range upcoming {
		if i == 3 {
			break
		}
		when := dueDayPhrase(*t.Deadline, now, loc)
		add(PredictionSignal{
			Kind:       "deadline",
			CategoryID: t.CategoryID,
			Detail:     fmt.Sprintf("Open task %q is due %s. Suggest a preparation step or sub-task that makes it easier, not the task itself.", t.Content, when),
			Reason:     fmt.Sprintf("Gets you ready for %s, due %s", quoteTitle(t.Content), when),
		})
	}

	// Recent one-off completions: the natural next step after them
	followUps := 0
	for _, t := range history { // newest first
		if followUps == 4 || now.Sub(t.TimeCompleted) > 3*dayDuration {
			break
		}
		if t.Recurring || len(strings.Fields(t.Content)) < 2 {
			continue
		}
		followUps++
		add(PredictionSignal{
			Kind:       "follow_up",
			CategoryID: t.CategoryID,
			Detail:     fmt.Sprintf("Recently completed %q. Suggest the logical next step that follows it, only if one clearly exists.", t.Content),
			Reason:     fmt.Sprintf("Next step after %s", quoteTitle(t.Content)),
		})
	}

	// Per-category rhythm and weekday habits
	type catStats struct {
		days     map[int]bool
		weekdays [7]int
		total    int
		titles   []string
	}
	stats := map[string]*catStats{}
	for _, t := range history {
		c, ok := catByID[t.CategoryID]
		if !ok || c.Name == InboxCategoryName {
			continue
		}
		st := stats[c.ID]
		if st == nil {
			st = &catStats{days: map[int]bool{}}
			stats[c.ID] = st
		}
		st.days[dayIndex(t.TimeCompleted, loc)] = true
		st.weekdays[t.TimeCompleted.In(loc).Weekday()]++
		st.total++
		if len(st.titles) < 6 {
			st.titles = append(st.titles, t.Content)
		}
	}

	type rhythmCand struct {
		cat     PredictionCategory
		rhythm  float64
		since   int
		dueness float64
		titles  []string
	}
	var rhythms []rhythmCand
	type weekdayCand struct {
		cat    PredictionCategory
		share  float64
		titles []string
	}
	var weekdays []weekdayCand
	wd := now.In(loc).Weekday()
	for id, st := range stats {
		if len(st.days) < 3 {
			continue
		}
		cat := catByID[id]
		sorted := make([]int, 0, len(st.days))
		for d := range st.days {
			sorted = append(sorted, d)
		}
		sort.Ints(sorted)
		gaps := make([]int, 0, len(sorted)-1)
		for i := 1; i < len(sorted); i++ {
			gaps = append(gaps, sorted[i]-sorted[i-1])
		}
		rhythm := medianInt(gaps)
		since := today - sorted[len(sorted)-1]
		dueness := float64(since) / rhythm
		// Nothing queued in a category that's due; past 4x the rhythm it has gone quiet
		if cat.OpenCount == 0 && since > 0 && dueness >= 1 && dueness <= 4 {
			rhythms = append(rhythms, rhythmCand{cat, rhythm, since, dueness, st.titles})
		}
		if share := float64(st.weekdays[wd]) / float64(st.total); st.weekdays[wd] >= 3 && share >= 0.4 && since > 0 {
			weekdays = append(weekdays, weekdayCand{cat, share, st.titles})
		}
	}
	sort.Slice(rhythms, func(i, j int) bool { return rhythms[i].dueness > rhythms[j].dueness })
	sort.Slice(weekdays, func(i, j int) bool { return weekdays[i].share > weekdays[j].share })

	for i, w := range weekdays {
		if i == 2 {
			break
		}
		add(PredictionSignal{
			Kind:       "weekday",
			CategoryID: w.cat.ID,
			Detail: fmt.Sprintf("Category %q (workspace %q) is mostly done on %s, and today is one. Recent tasks there: %s. Suggest a fresh task that fits this category's pattern, e.g. the next item in a progression.",
				w.cat.Name, w.cat.Workspace, weekdayPlural[wd], strings.Join(quoteAll(w.titles), ", ")),
			Reason: fmt.Sprintf("You usually get to %s on %s", w.cat.Name, weekdayPlural[wd]),
		})
	}
	seenCat := map[string]bool{}
	for _, s := range signals {
		if s.Kind == "weekday" {
			seenCat[s.CategoryID] = true
		}
	}
	added := 0
	for _, r := range rhythms {
		if added == 3 || seenCat[r.cat.ID] {
			continue
		}
		added++
		add(PredictionSignal{
			Kind:       "category_rhythm",
			CategoryID: r.cat.ID,
			Detail: fmt.Sprintf("Category %q (workspace %q) usually gets a task done %s but nothing in it is open and it was last touched %d days ago. Recent tasks there: %s. Suggest a fresh task that fits this category's pattern, e.g. the next item in a progression.",
				r.cat.Name, r.cat.Workspace, rhythmPhrase(r.rhythm), r.since, strings.Join(quoteAll(r.titles), ", ")),
			Reason: fmt.Sprintf("Nothing queued in %s, usually %s", r.cat.Name, rhythmPhrase(r.rhythm)),
		})
	}

	return PredictionSignals{Signals: signals, Categories: cats, KnownTitles: known}
}

func quoteAll(xs []string) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i] = fmt.Sprintf("%q", x)
	}
	return out
}

// PredictionContext renders the signals for the model prompt.
func PredictionContext(s PredictionSignals, now time.Time, loc *time.Location) string {
	var b strings.Builder
	local := now.In(loc)
	fmt.Fprintf(&b, "Now: %s, %s\n\nWorkspaces and categories:\n", local.Weekday(), local.Format("Jan 2 3:04pm"))
	for _, c := range s.Categories {
		fmt.Fprintf(&b, "- %s / %s (id: %s, %d open)\n", c.Workspace, c.Name, c.ID, c.OpenCount)
	}
	b.WriteString("\nSignals:\n")
	for _, sig := range s.Signals {
		fmt.Fprintf(&b, "- %s [%s, categoryId %s]: %s\n", sig.ID, sig.Kind, sig.CategoryID, sig.Detail)
	}
	b.WriteString("\nThe user's existing and past task titles (never repeat or rephrase one of these):\n")
	for i, t := range s.KnownTitles {
		if i == 80 {
			break
		}
		fmt.Fprintf(&b, "- %q\n", t)
	}
	return b.String()
}

func titleTokens(s string) map[string]bool {
	out := map[string]bool{}
	for _, w := range strings.FieldsFunc(strings.ToLower(s), func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9')
	}) {
		if len(w) > 2 {
			out[w] = true
		}
	}
	return out
}

func tooSimilar(a, b map[string]bool) bool {
	if len(a) == 0 || len(b) == 0 {
		return false
	}
	inter := 0
	for w := range a {
		if b[w] {
			inter++
		}
	}
	union := len(a) + len(b) - inter
	return float64(inter)/float64(union) >= 0.6
}

// FinalizePredictions attaches each draft's reason from its signal and drops
// anything that replays a known task, duplicates another draft, or is malformed.
func FinalizePredictions(drafts []predictionDraft, s PredictionSignals, limit int) []TaskPrediction {
	byID := map[string]PredictionSignal{}
	for _, sig := range s.Signals {
		byID[sig.ID] = sig
	}
	owned := map[string]bool{}
	for _, c := range s.Categories {
		owned[c.ID] = true
	}
	known := make([]map[string]bool, 0, len(s.KnownTitles))
	knownExact := map[string]bool{}
	for _, t := range s.KnownTitles {
		known = append(known, titleTokens(t))
		knownExact[strings.ToLower(strings.TrimSpace(t))] = true
	}

	out := []TaskPrediction{}
	usedSignal := map[string]bool{}
	var accepted []map[string]bool
	for _, d := range drafts {
		content := strings.TrimSpace(d.Content)
		sig, ok := byID[d.SignalID]
		if !ok || usedSignal[sig.ID] || content == "" || len([]rune(content)) > 80 || knownExact[strings.ToLower(content)] {
			continue
		}
		toks := titleTokens(content)
		dup := false
		for _, k := range append(known, accepted...) {
			if tooSimilar(toks, k) {
				dup = true
				break
			}
		}
		if dup {
			continue
		}
		catID := sig.CategoryID
		if d.CategoryID != "" && owned[d.CategoryID] {
			catID = d.CategoryID
		}
		if !owned[catID] {
			catID = ""
		}
		usedSignal[sig.ID] = true
		accepted = append(accepted, toks)
		out = append(out, TaskPrediction{Content: content, Reason: sig.Reason, Kind: sig.Kind, CategoryID: catID})
		if len(out) == limit {
			break
		}
	}
	return out
}

// --- Loading ---

func (s *Service) loadPredictionInputs(ctx context.Context, userID primitive.ObjectID, now time.Time) ([]PredictionCategory, []PredictionOpenTask, []PredictionHistoryTask, error) {
	cursor, err := s.Tasks.Find(ctx, bson.M{"user": userID}, options.Find().SetProjection(bson.M{
		"name": 1, "workspaceName": 1, "isBlueprint": 1, "tasks.content": 1, "tasks.deadline": 1,
	}))
	if err != nil {
		return nil, nil, nil, err
	}
	var catDocs []struct {
		ID            primitive.ObjectID `bson:"_id"`
		Name          string             `bson:"name"`
		WorkspaceName string             `bson:"workspaceName"`
		Tasks         []struct {
			Content  string     `bson:"content"`
			Deadline *time.Time `bson:"deadline"`
		} `bson:"tasks"`
	}
	if err := cursor.All(ctx, &catDocs); err != nil {
		return nil, nil, nil, err
	}

	var cats []PredictionCategory
	var open []PredictionOpenTask
	for _, c := range catDocs {
		cats = append(cats, PredictionCategory{ID: c.ID.Hex(), Name: c.Name, Workspace: c.WorkspaceName, OpenCount: len(c.Tasks)})
		for _, t := range c.Tasks {
			open = append(open, PredictionOpenTask{Content: t.Content, CategoryID: c.ID.Hex(), Deadline: t.Deadline})
		}
	}

	hCursor, err := s.CompletedTasks.Find(ctx, bson.M{
		"user":           userID,
		"completionType": bson.M{"$ne": string(CompletionProgress)},
		"timeCompleted":  bson.M{"$gte": now.Add(-predictionHistoryDays * dayDuration)},
	}, options.Find().
		SetSort(bson.D{{Key: "timeCompleted", Value: -1}}).
		SetLimit(predictionHistoryLimit).
		SetProjection(bson.M{"content": 1, "categoryID": 1, "timeCompleted": 1, "recurring": 1}))
	if err != nil {
		return nil, nil, nil, err
	}
	var hDocs []struct {
		Content       string             `bson:"content"`
		CategoryID    primitive.ObjectID `bson:"categoryID"`
		TimeCompleted time.Time          `bson:"timeCompleted"`
		Recurring     bool               `bson:"recurring"`
	}
	if err := hCursor.All(ctx, &hDocs); err != nil {
		return nil, nil, nil, err
	}
	history := make([]PredictionHistoryTask, 0, len(hDocs))
	for _, h := range hDocs {
		history = append(history, PredictionHistoryTask{Content: h.Content, CategoryID: h.CategoryID.Hex(), TimeCompleted: h.TimeCompleted, Recurring: h.Recurring})
	}
	return cats, open, history, nil
}

// --- Cache ---

type predictionCacheEntry struct {
	key         string
	at          time.Time
	predictions []TaskPrediction
}

var predictionCache sync.Map // userID -> predictionCacheEntry

// predictionFingerprint changes whenever the inputs meaningfully do, so a new
// task or completion refreshes suggestions without waiting out the TTL.
func predictionFingerprint(open []PredictionOpenTask, history []PredictionHistoryTask, now time.Time, loc *time.Location) string {
	latest := ""
	if len(history) > 0 {
		latest = history[0].TimeCompleted.Format(time.RFC3339)
	}
	return fmt.Sprintf("%d|%d|%s", dayIndex(now, loc), len(open), latest)
}

// --- Model call ---

// runGeminiFlow calls a flow on the gemini service by field name. Reflection
// avoids the gemini -> task import cycle; input and output cross via JSON.
func runGeminiFlow(ctx context.Context, service any, flowName string, input any, out any) error {
	if !geminiConfigured(service) {
		return fmt.Errorf("gemini service not available")
	}
	flow := reflect.ValueOf(service).Elem().FieldByName(flowName)
	if !flow.IsValid() || flow.IsNil() {
		return fmt.Errorf("gemini flow %s not configured", flowName)
	}
	run := flow.MethodByName("Run")
	in := reflect.New(run.Type().In(1))
	raw, err := json.Marshal(input)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(raw, in.Interface()); err != nil {
		return err
	}
	res := run.Call([]reflect.Value{reflect.ValueOf(ctx), in.Elem()})
	if errV := res[1]; !errV.IsNil() {
		if err, ok := errV.Interface().(error); ok {
			return err
		}
		return fmt.Errorf("gemini flow %s returned a non-error failure", flowName)
	}
	raw, err = json.Marshal(res[0].Interface())
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, out)
}

// --- Handler ---

type GetTaskPredictionsInput struct {
	Authorization string   `header:"Authorization" required:"true"`
	Timezone      string   `query:"timezone" doc:"User's timezone (IANA format)" example:"America/New_York"`
	Refresh       bool     `query:"refresh" doc:"Skip the cache and ask for a fresh set"`
	Exclude       []string `query:"exclude" doc:"Suggestion titles the user dismissed or has already seen; never returned"`
}

type GetTaskPredictionsOutput struct {
	Body struct {
		Predictions []TaskPrediction `json:"predictions" doc:"Up to three tasks the user will likely need next, each with the reason"`
	}
}

// GetTaskPredictions handles GET /v1/user/tasks/predictions. Suggestions are
// additive: any failure returns an empty list, never an error.
func (h *Handler) GetTaskPredictions(ctx context.Context, input *GetTaskPredictionsInput) (*GetTaskPredictionsOutput, error) {
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}
	loc, err := time.LoadLocation(input.Timezone)
	if err != nil || input.Timezone == "" {
		loc = time.UTC
	}

	output := &GetTaskPredictionsOutput{}
	output.Body.Predictions = []TaskPrediction{}
	now := time.Now()

	cats, open, history, err := h.service.loadPredictionInputs(ctx, userObjID, now)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Failed to load prediction inputs", slog.String("userID", userID), slog.String("error", err.Error()))
		return output, nil
	}

	key := predictionFingerprint(open, history, now, loc) + "|" + strings.Join(input.Exclude, "\x00")
	if cached, ok := predictionCache.Load(userID); ok && !input.Refresh {
		if entry, ok := cached.(predictionCacheEntry); ok && entry.key == key && now.Sub(entry.at) < predictionCacheTTL {
			output.Body.Predictions = entry.predictions
			return output, nil
		}
	}

	signals := BuildPredictionSignals(cats, open, history, now, loc)
	if len(signals.Signals) == 0 {
		return output, nil
	}
	// Excluded titles go first so they survive the prompt's title cap
	signals.KnownTitles = append(append([]string{}, input.Exclude...), signals.KnownTitles...)

	var drafts struct {
		Predictions []predictionDraft `json:"predictions"`
	}
	flowInput := map[string]string{"context": PredictionContext(signals, now, loc)}
	if err := runGeminiFlow(ctx, h.geminiService, "PredictTasksFlow", flowInput, &drafts); err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Task prediction model call failed", slog.String("userID", userID), slog.String("error", err.Error()))
		return output, nil
	}

	output.Body.Predictions = FinalizePredictions(drafts.Predictions, signals, predictionLimit)
	predictionCache.Store(userID, predictionCacheEntry{key: key, at: now, predictions: output.Body.Predictions})
	return output, nil
}

func RegisterGetTaskPredictionsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-task-predictions",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/predictions",
		Summary:     "Predict tasks the user will need next",
		Description: "Mines the user's category rhythms, weekday habits, upcoming deadlines and recent completions, then suggests new tasks grounded in them. Never replays an existing or past task. Returns an empty list when AI is unavailable, and consumes no credits.",
		Tags:        []string{"tasks", "ai"},
	}, handler.GetTaskPredictions)
}
