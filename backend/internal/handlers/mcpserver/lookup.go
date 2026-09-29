package mcpserver

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// workspace is one of the caller's workspaces, loaded with its categories and open tasks.
type workspace struct {
	name       string
	color      string
	categories []categoryRef
}

type categoryRef struct {
	doc category.CategoryDocument
}

func (w workspace) summaries() []categorySummary {
	out := make([]categorySummary, 0, len(w.categories))
	for _, c := range w.categories {
		if c.doc.Name == proxyCategoryName {
			continue
		}
		out = append(out, categorySummary{
			ID:        c.doc.ID.Hex(),
			Name:      c.doc.Name,
			Workspace: w.name,
			OpenTasks: len(c.doc.Tasks),
			Inbox:     c.doc.IsInbox,
		})
	}
	return out
}

// loadWorkspaces reads the caller's workspaces through the category service, which already hides released tasks.
func (t *tools) loadWorkspaces(c caller) ([]workspace, error) {
	results, err := t.categories.GetWorkspaces(c.userID)
	if err != nil {
		return nil, errors.New("could not load workspaces")
	}
	out := make([]workspace, 0, len(results))
	for _, r := range results {
		w := workspace{name: r.Name}
		if r.Color != nil {
			w.color = *r.Color
		}
		for _, doc := range r.Categories {
			w.categories = append(w.categories, categoryRef{doc: doc})
		}
		sort.SliceStable(w.categories, func(i, j int) bool {
			return strings.ToLower(w.categories[i].doc.Name) < strings.ToLower(w.categories[j].doc.Name)
		})
		out = append(out, w)
	}
	sort.SliceStable(out, func(i, j int) bool { return strings.ToLower(out[i].name) < strings.ToLower(out[j].name) })
	return out, nil
}

func findWorkspace(ws []workspace, name string) *workspace {
	for i := range ws {
		if strings.EqualFold(ws[i].name, name) {
			return &ws[i]
		}
	}
	return nil
}

func findCategory(ws []workspace, rawID string) (categoryRef, error) {
	id, err := primitive.ObjectIDFromHex(strings.TrimSpace(rawID))
	if err != nil {
		return categoryRef{}, errors.New("category_id is not a valid id")
	}
	for _, w := range ws {
		for _, c := range w.categories {
			if c.doc.ID == id {
				return c, nil
			}
		}
	}
	return categoryRef{}, errors.New("category not found")
}

func findTask(ws []workspace, id primitive.ObjectID) (task.TaskDocument, categoryRef, bool) {
	for _, w := range ws {
		for _, c := range w.categories {
			for _, tk := range c.doc.Tasks {
				if tk.ID == id {
					return tk, c, true
				}
			}
		}
	}
	return task.TaskDocument{}, categoryRef{}, false
}

// selectCategories narrows to a workspace and/or category, rejecting names or ids the caller doesn't own.
func selectCategories(ws []workspace, wsName, categoryID string) ([]categoryRef, error) {
	wsName, categoryID = strings.TrimSpace(wsName), strings.TrimSpace(categoryID)
	if wsName != "" {
		w := findWorkspace(ws, wsName)
		if w == nil {
			return nil, fmt.Errorf("workspace %q not found", wsName)
		}
		ws = []workspace{*w}
	}
	if categoryID != "" {
		c, err := findCategory(ws, categoryID)
		if err != nil {
			return nil, err
		}
		return []categoryRef{c}, nil
	}
	var out []categoryRef
	for _, w := range ws {
		out = append(out, w.categories...)
	}
	return out, nil
}

func summarize(tk task.TaskDocument, cat categoryRef, loc *time.Location) taskSummary {
	s := taskSummary{
		ID:          tk.ID.Hex(),
		Content:     tk.Content,
		CategoryID:  tk.CategoryID.Hex(),
		Priority:    tk.Priority,
		Difficulty:  tk.Value,
		StartDate:   formatTime(tk.StartDate, loc),
		Deadline:    formatTime(tk.Deadline, loc),
		Notes:       tk.Notes,
		Recurring:   tk.Recurring,
		Someday:     tk.SomedayAt != nil,
		InProgress:  tk.Active,
		Completed:   tk.TimeCompleted != nil,
		CompletedAt: formatTime(tk.TimeCompleted, loc),
	}
	if !cat.doc.ID.IsZero() {
		s.CategoryID = cat.doc.ID.Hex()
		s.Category = cat.doc.Name
		s.Workspace = cat.doc.WorkspaceName
	}
	return s
}

func formatTime(t *time.Time, loc *time.Location) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return t.In(loc).Format(time.RFC3339)
}

// sortByDeadline puts dated tasks first, soonest first, keeping the original order otherwise.
func sortByDeadline(ts []taskSummary) {
	sort.SliceStable(ts, func(i, j int) bool {
		a, b := ts[i].Deadline, ts[j].Deadline
		if a == "" || b == "" {
			return a != "" && b == ""
		}
		ta, _ := time.Parse(time.RFC3339, a)
		tb, _ := time.Parse(time.RFC3339, b)
		return ta.Before(tb)
	})
}

var localLayouts = []string{"2006-01-02T15:04:05", "2006-01-02T15:04", "2006-01-02 15:04:05", "2006-01-02 15:04"}

// parseWhen reads RFC 3339, a local date-time, or a bare date in loc. hasTime is false for a bare date (local midnight).
func parseWhen(raw string, loc *time.Location) (t *time.Time, hasTime bool, err error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, false, nil
	}
	if v, err := time.Parse(time.RFC3339, raw); err == nil {
		return &v, true, nil
	}
	for _, layout := range localLayouts {
		if v, err := time.ParseInLocation(layout, raw, loc); err == nil {
			return &v, true, nil
		}
	}
	if v, err := time.ParseInLocation("2006-01-02", raw, loc); err == nil {
		return &v, false, nil
	}
	return nil, false, fmt.Errorf("could not read %q; use YYYY-MM-DD or RFC 3339", raw)
}

// parseBound is parseWhen for filters: a bare date as an upper bound covers the whole day.
func parseBound(raw string, loc *time.Location, upper bool) (*time.Time, error) {
	t, hasTime, err := parseWhen(raw, loc)
	if err != nil || t == nil {
		return t, err
	}
	if upper && !hasTime {
		end := t.AddDate(0, 0, 1).Add(-time.Nanosecond)
		return &end, nil
	}
	return t, nil
}
