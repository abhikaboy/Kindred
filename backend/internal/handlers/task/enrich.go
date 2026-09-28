package task

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
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

// Auto enrichment: an occasional pass over the user's open tasks that proposes
// a schedule and missing details. It is always two steps — the preview says
// exactly what would change and why, and nothing is written until the user
// applies the changes they kept.

const (
	enrichMinCandidates = 3
	enrichMaxCandidates = 30
	enrichStaleDays     = 3
	enrichHorizonDays   = 30
	enrichCacheTTL      = time.Hour
)

type EnrichCandidate struct {
	ID           primitive.ObjectID
	CategoryID   primitive.ObjectID
	CategoryName string
	Content      string
	Priority     int
	Value        float64
	StartDate    *time.Time
	Timestamp    time.Time
	Stale        bool
}

type EnrichChange struct {
	TaskID       string               `json:"taskId"`
	CategoryID   string               `json:"categoryId"`
	TaskName     string               `json:"taskName" doc:"The task's current title"`
	CategoryName string               `json:"categoryName"`
	Updates      EditTaskUpdatesLocal `json:"updates" doc:"Fields that would change; time fields are RFC3339"`
	Summary      []string             `json:"summary" doc:"Plain descriptions of each field change, e.g. 'Start Tue, Sep 29'"`
	Reason       string               `json:"reason" doc:"Why the change is proposed"`
}

// enrichDraft mirrors gemini.EnrichTaskDraft.
type enrichDraft struct {
	TaskID    string   `json:"taskId"`
	Content   *string  `json:"content,omitempty"`
	Priority  *int     `json:"priority,omitempty"`
	Value     *float64 `json:"value,omitempty"`
	StartDate *string  `json:"startDate,omitempty"`
	StartTime *string  `json:"startTime,omitempty"`
	Deadline  *string  `json:"deadline,omitempty"`
	Reason    string   `json:"reason"`
}

// --- Loading ---

// loadEnrichInputs returns the open, non-recurring tasks that have no real
// schedule (no deadline or start time, and a start day that is missing or has
// gone stale), plus how many tasks already sit on each upcoming day.
func (s *Service) loadEnrichInputs(ctx context.Context, userID primitive.ObjectID, now time.Time, loc *time.Location) ([]EnrichCandidate, map[string]int, error) {
	cursor, err := s.Tasks.Find(ctx, bson.M{"user": userID, "isBlueprint": bson.M{"$ne": true}}, options.Find().SetProjection(bson.M{
		"name": 1, "tasks._id": 1, "tasks.content": 1, "tasks.priority": 1, "tasks.value": 1,
		"tasks.recurring": 1, "tasks.templateID": 1, "tasks.deadline": 1, "tasks.startDate": 1,
		"tasks.startTime": 1, "tasks.timestamp": 1, "tasks.autoCategorize": 1,
	}))
	if err != nil {
		return nil, nil, err
	}
	var catDocs []struct {
		ID    primitive.ObjectID `bson:"_id"`
		Name  string             `bson:"name"`
		Tasks []TaskDocument     `bson:"tasks"`
	}
	if err := cursor.All(ctx, &catDocs); err != nil {
		return nil, nil, err
	}

	today := startOfDay(now, loc)
	staleBefore := today.AddDate(0, 0, -enrichStaleDays)
	busy := map[string]int{}
	var out []EnrichCandidate
	for _, c := range catDocs {
		for _, t := range c.Tasks {
			if t.StartDate != nil && !t.StartDate.Before(today) {
				busy[t.StartDate.In(loc).Format("2006-01-02")]++
			}
			if t.Recurring || t.TemplateID != nil || t.AutoCategorize {
				continue
			}
			if t.Deadline != nil || t.StartTime != nil {
				continue
			}
			stale := t.StartDate != nil && t.StartDate.Before(staleBefore)
			if t.StartDate != nil && !stale {
				continue
			}
			out = append(out, EnrichCandidate{
				ID: t.ID, CategoryID: c.ID, CategoryName: c.Name, Content: t.Content,
				Priority: t.Priority, Value: t.Value, StartDate: t.StartDate, Timestamp: t.Timestamp, Stale: stale,
			})
		}
	}
	// Oldest first: those are the ones most likely to have been forgotten
	sort.Slice(out, func(i, j int) bool { return out[i].Timestamp.Before(out[j].Timestamp) })
	return out, busy, nil
}

func startOfDay(t time.Time, loc *time.Location) time.Time {
	l := t.In(loc)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, loc)
}

// EnrichContext renders the model input. Tasks are addressed as T1..Tn so the
// model never has to copy an ObjectID.
func EnrichContext(cands []EnrichCandidate, busy map[string]int, now time.Time, loc *time.Location) string {
	today := startOfDay(now, loc)
	var b strings.Builder
	fmt.Fprintf(&b, "Today: %s (%s)\n\nAlready scheduled per day:\n", today.Format("Monday 2006-01-02"), loc.String())
	for i := 0; i < 14; i++ {
		d := today.AddDate(0, 0, i)
		fmt.Fprintf(&b, "- %s: %d\n", d.Format("Mon 2006-01-02"), busy[d.Format("2006-01-02")])
	}
	b.WriteString("\nTasks:\n")
	for i, c := range cands {
		age := int(today.Sub(startOfDay(c.Timestamp, loc)).Hours() / 24)
		fmt.Fprintf(&b, "T%d | %q | category: %s | priority %d | difficulty %g | added %d days ago", i+1, c.Content, c.CategoryName, c.Priority, c.Value, age)
		if c.Stale {
			fmt.Fprintf(&b, " | was planned for %s and never done", c.StartDate.In(loc).Format("2006-01-02"))
		}
		b.WriteString("\n")
	}
	return b.String()
}

// --- Draft validation ---

func parseLocalDay(s string, loc *time.Location) (time.Time, bool) {
	t, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(s), loc)
	return t, err == nil
}

func friendlyDay(t time.Time, today time.Time) string {
	switch int(t.Sub(today).Hours() / 24) {
	case 0:
		return "today"
	case 1:
		return "tomorrow"
	}
	return t.Format("Mon, Jan 2")
}

var priorityNames = map[int]string{1: "low", 2: "medium", 3: "high"}

// FinalizeEnrichment turns model drafts into changes the user can review. It
// drops anything that points at an unknown task, falls outside sane ranges or
// does not actually change a field, so the preview only ever shows real edits.
func FinalizeEnrichment(drafts []enrichDraft, cands []EnrichCandidate, now time.Time, loc *time.Location) []EnrichChange {
	today := startOfDay(now, loc)
	horizon := today.AddDate(0, 0, enrichHorizonDays)
	seen := map[int]bool{}
	var out []EnrichChange
	for _, d := range drafts {
		var idx int
		if _, err := fmt.Sscanf(strings.TrimSpace(d.TaskID), "T%d", &idx); err != nil || idx < 1 || idx > len(cands) || seen[idx] {
			continue
		}
		c := cands[idx-1]
		var u EditTaskUpdatesLocal
		var summary []string

		if d.Content != nil {
			title := strings.TrimSpace(*d.Content)
			if title != "" && title != c.Content && len(title) <= len(c.Content)+20 {
				u.Content = &title
				summary = append(summary, fmt.Sprintf("Rename to %q", title))
			}
		}

		var start time.Time
		if d.StartDate != nil {
			if day, ok := parseLocalDay(*d.StartDate, loc); ok && !day.Before(today) && day.Before(horizon) {
				start = day
				if d.StartTime != nil {
					if hm, err := time.Parse("15:04", strings.TrimSpace(*d.StartTime)); err == nil {
						at := time.Date(day.Year(), day.Month(), day.Day(), hm.Hour(), hm.Minute(), 0, 0, loc)
						if at.After(now) {
							s := at.UTC().Format(time.RFC3339)
							u.StartTime = &s
						}
					}
				}
				s := day.UTC().Format(time.RFC3339)
				u.StartDate = &s
				label := "Start " + friendlyDay(day, today)
				if u.StartTime != nil {
					t, _ := time.Parse(time.RFC3339, *u.StartTime)
					label += " at " + t.In(loc).Format("3:04 PM")
				}
				if c.Stale {
					label = "Move to " + strings.TrimPrefix(label, "Start ")
				}
				summary = append(summary, label)
			}
		}

		if d.Deadline != nil {
			if day, ok := parseLocalDay(*d.Deadline, loc); ok && !day.Before(today) && day.Before(horizon) && (start.IsZero() || !day.Before(start)) {
				due := time.Date(day.Year(), day.Month(), day.Day(), 23, 59, 0, 0, loc).UTC().Format(time.RFC3339)
				u.Deadline = &due
				summary = append(summary, "Due "+friendlyDay(day, today))
			}
		}

		if d.Priority != nil && *d.Priority >= 1 && *d.Priority <= 3 && *d.Priority != c.Priority {
			p := *d.Priority
			u.Priority = &p
			summary = append(summary, "Priority "+priorityNames[p])
		}

		if d.Value != nil && *d.Value >= 1 && *d.Value <= 5 && *d.Value != c.Value {
			v := float64(int(*d.Value))
			u.Value = &v
			summary = append(summary, fmt.Sprintf("Difficulty %g of 5", v))
		}

		if len(summary) == 0 {
			continue
		}
		seen[idx] = true
		out = append(out, EnrichChange{
			TaskID: c.ID.Hex(), CategoryID: c.CategoryID.Hex(), TaskName: c.Content, CategoryName: c.CategoryName,
			Updates: u, Summary: summary, Reason: strings.TrimSpace(d.Reason),
		})
	}
	if out == nil {
		out = []EnrichChange{}
	}
	return out
}

// EnrichOverview is the one-line explanation shown before anything is applied.
func EnrichOverview(changes []EnrichChange) string {
	var scheduled, deadlines, details, renamed int
	for _, c := range changes {
		if c.Updates.StartDate != nil {
			scheduled++
		}
		if c.Updates.Deadline != nil {
			deadlines++
		}
		if c.Updates.Priority != nil || c.Updates.Value != nil {
			details++
		}
		if c.Updates.Content != nil {
			renamed++
		}
	}
	var parts []string
	plural := func(n int, one, many string) string {
		if n == 1 {
			return one
		}
		return fmt.Sprintf(many, n)
	}
	if scheduled > 0 {
		parts = append(parts, "schedule "+plural(scheduled, "1 task", "%d tasks")+" across the next two weeks")
	}
	if deadlines > 0 {
		parts = append(parts, "add "+plural(deadlines, "a due date", "%d due dates"))
	}
	if details > 0 {
		parts = append(parts, "set priority or difficulty on "+plural(details, "1 task", "%d tasks"))
	}
	if renamed > 0 {
		parts = append(parts, "tidy "+plural(renamed, "1 title", "%d titles"))
	}
	if len(parts) == 0 {
		return "Your tasks already look well organized."
	}
	sentence := parts[0]
	if len(parts) > 1 {
		sentence = strings.Join(parts[:len(parts)-1], ", ") + " and " + parts[len(parts)-1]
	}
	return "This will " + sentence + ". Nothing changes until you apply it, and you can drop any change first."
}

// sanitizeEnrichUpdates keeps only the fields enrichment is allowed to touch,
// so the apply endpoint can't be used as a general-purpose editor.
func sanitizeEnrichUpdates(u EditTaskUpdatesLocal) EditTaskUpdatesLocal {
	return EditTaskUpdatesLocal{
		Content: u.Content, Priority: u.Priority, Value: u.Value,
		Deadline: u.Deadline, StartDate: u.StartDate, StartTime: u.StartTime,
	}
}

// --- Cache ---

type enrichCacheEntry struct {
	key      string
	at       time.Time
	changes  []EnrichChange
	overview string
}

var enrichCache sync.Map // userID -> enrichCacheEntry

func enrichFingerprint(cands []EnrichCandidate, now time.Time, loc *time.Location) string {
	ids := make([]string, len(cands))
	for i, c := range cands {
		ids[i] = c.ID.Hex() + c.Content
	}
	return startOfDay(now, loc).Format("2006-01-02") + "|" + strings.Join(ids, ",")
}

// --- Handlers ---

func resolveEnrichUser(ctx context.Context, tz string) (string, primitive.ObjectID, *time.Location, error) {
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return "", primitive.NilObjectID, nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return "", primitive.NilObjectID, nil, huma.Error400BadRequest("Invalid user ID format", err)
	}
	loc, err := time.LoadLocation(tz)
	if err != nil || tz == "" {
		loc = time.UTC
	}
	return userID, userObjID, loc, nil
}

type GetEnrichStatusInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Timezone      string `query:"timezone" doc:"User's timezone (IANA format)" example:"America/New_York"`
}

type GetEnrichStatusOutput struct {
	Body struct {
		Eligible       bool `json:"eligible" doc:"Whether enough tasks need attention to offer auto enrichment"`
		CandidateCount int  `json:"candidateCount" doc:"Open tasks with no schedule, or a stale one"`
		StaleCount     int  `json:"staleCount" doc:"Candidates whose planned day passed without being done"`
	}
}

// GetEnrichStatus handles GET /v1/user/tasks/enrich/status. It never calls the
// model, so the home screen can check it cheaply.
func (h *Handler) GetEnrichStatus(ctx context.Context, input *GetEnrichStatusInput) (*GetEnrichStatusOutput, error) {
	userID, userObjID, loc, err := resolveEnrichUser(ctx, input.Timezone)
	if err != nil {
		return nil, err
	}
	output := &GetEnrichStatusOutput{}
	if !geminiConfigured(h.geminiService) {
		return output, nil
	}
	cands, _, err := h.service.loadEnrichInputs(ctx, userObjID, time.Now(), loc)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Failed to load enrichment inputs", slog.String("userID", userID), slog.String("error", err.Error()))
		return output, nil
	}
	for _, c := range cands {
		if c.Stale {
			output.Body.StaleCount++
		}
	}
	output.Body.CandidateCount = len(cands)
	output.Body.Eligible = len(cands) >= enrichMinCandidates
	return output, nil
}

type PreviewEnrichInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Timezone string `json:"timezone,omitempty" doc:"User's timezone (IANA format)"`
	}
}

type PreviewEnrichOutput struct {
	Body struct {
		Overview string         `json:"overview" doc:"Plain explanation of what applying would do"`
		Changes  []EnrichChange `json:"changes"`
	}
}

// PreviewEnrich handles POST /v1/user/tasks/enrich/preview. Read-only.
func (h *Handler) PreviewEnrich(ctx context.Context, input *PreviewEnrichInput) (*PreviewEnrichOutput, error) {
	userID, userObjID, loc, err := resolveEnrichUser(ctx, input.Body.Timezone)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	cands, busy, err := h.service.loadEnrichInputs(ctx, userObjID, now, loc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to load tasks", err)
	}
	if len(cands) > enrichMaxCandidates {
		cands = cands[:enrichMaxCandidates]
	}

	output := &PreviewEnrichOutput{}
	output.Body.Changes = []EnrichChange{}
	if len(cands) == 0 {
		output.Body.Overview = EnrichOverview(nil)
		return output, nil
	}

	key := enrichFingerprint(cands, now, loc)
	if cached, ok := enrichCache.Load(userID); ok {
		entry := cached.(enrichCacheEntry)
		if entry.key == key && now.Sub(entry.at) < enrichCacheTTL {
			output.Body.Changes = entry.changes
			output.Body.Overview = entry.overview
			return output, nil
		}
	}

	var drafts struct {
		Changes []enrichDraft `json:"changes"`
	}
	flowInput := map[string]string{"context": EnrichContext(cands, busy, now, loc)}
	if err := runGeminiFlow(ctx, h.geminiService, "EnrichTasksFlow", flowInput, &drafts); err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Task enrichment model call failed", slog.String("userID", userID), slog.String("error", err.Error()))
		return nil, huma.Error503ServiceUnavailable("Couldn't look over your tasks right now. Try again in a bit.", err)
	}

	output.Body.Changes = FinalizeEnrichment(drafts.Changes, cands, now, loc)
	output.Body.Overview = EnrichOverview(output.Body.Changes)
	enrichCache.Store(userID, enrichCacheEntry{key: key, at: now, changes: output.Body.Changes, overview: output.Body.Overview})
	return output, nil
}

type ApplyEnrichInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Changes []struct {
			TaskID  string               `json:"taskId"`
			Updates EditTaskUpdatesLocal `json:"updates"`
		} `json:"changes" minItems:"1" maxItems:"50"`
	}
}

type ApplyEnrichOutput struct {
	Body struct {
		Tasks       []TaskDocument `json:"tasks"`
		EditedCount int            `json:"editedCount"`
	}
}

// ApplyEnrich handles POST /v1/user/tasks/enrich/apply with the changes the
// user kept from the preview.
func (h *Handler) ApplyEnrich(ctx context.Context, input *ApplyEnrichInput) (*ApplyEnrichOutput, error) {
	userID, userObjID, _, err := resolveEnrichUser(ctx, "")
	if err != nil {
		return nil, err
	}
	edits := &EditTasksFlowOutputLocal{}
	for _, c := range input.Body.Changes {
		taskObjID, err := primitive.ObjectIDFromHex(c.TaskID)
		if err != nil {
			continue
		}
		// The category comes from the user's own task, never the request
		current, err := h.service.GetTaskByID(taskObjID, userObjID)
		if err != nil || current.CategoryID.IsZero() {
			continue
		}
		edits.Instructions = append(edits.Instructions, EditTaskInstructionLocal{
			TaskID: c.TaskID, CategoryID: current.CategoryID.Hex(), Updates: sanitizeEnrichUpdates(c.Updates),
		})
	}
	tasks, _, count := h.applyEditInstructions(ctx, userObjID, userID, edits)
	enrichCache.Delete(userID)

	slog.LogAttrs(ctx, slog.LevelInfo, "Applied task enrichment", slog.String("userID", userID), slog.Int("edited", count))
	output := &ApplyEnrichOutput{}
	output.Body.Tasks = tasks
	output.Body.EditedCount = count
	return output, nil
}

func RegisterEnrichOperations(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-enrich-status",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/enrich/status",
		Summary:     "Check whether auto enrichment is worth offering",
		Description: "Counts open tasks with no schedule or a stale one. Does not call AI.",
		Tags:        []string{"tasks", "ai"},
	}, handler.GetEnrichStatus)
	huma.Register(api, huma.Operation{
		OperationID: "preview-enrich",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/enrich/preview",
		Summary:     "Preview auto enrichment",
		Description: "Proposes schedules, due dates, priority, difficulty and title cleanups for unscheduled tasks, with a reason for each. Changes nothing.",
		Tags:        []string{"tasks", "ai"},
	}, handler.PreviewEnrich)
	huma.Register(api, huma.Operation{
		OperationID: "apply-enrich",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/enrich/apply",
		Summary:     "Apply auto enrichment",
		Description: "Applies the previewed changes the user kept. Only schedule, due date, priority, difficulty and title can change.",
		Tags:        []string{"tasks", "ai"},
	}, handler.ApplyEnrich)
}
