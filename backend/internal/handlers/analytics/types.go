package analytics

import (
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

// Range values accepted by the analytics endpoint.
const (
	RangeWeek     = "week"
	RangeMonth    = "month"
	RangeSixMonth = "sixmonth"
)

// GetAnalyticsInput is the request for the dashboard endpoint. All filters are
// optional; an empty workspace/category means "all".
type GetAnalyticsInput struct {
	Range     string `query:"range" enum:"week,month,sixmonth" default:"week" doc:"Time range: week, month, or sixmonth"`
	Workspace string `query:"workspace" doc:"Workspace name filter (optional; empty = all workspaces)"`
	Category  string `query:"category" doc:"Category ID filter (optional; empty = all categories)"`
}

type GetAnalyticsOutput struct {
	Body AnalyticsResponse `json:"body"`
}

// AnalyticsResponse is the single widget-ready payload for the dashboard. Each
// field maps to one widget; the frontend renders without any extra computation.
type AnalyticsResponse struct {
	Range           string                   `json:"range"`
	WorkspaceFilter string                   `json:"workspaceFilter,omitempty"`
	CategoryFilter  string                   `json:"categoryFilter,omitempty"`
	GeneratedAt     time.Time                `json:"generatedAt"`
	Signals         AnalyticsSignals         `json:"signals"`
	Progress        AnalyticsProgress        `json:"progress"`
	CategoryShare   AnalyticsCategoryShare   `json:"categoryShare"`
	Heatmap         AnalyticsHeatmap         `json:"heatmap"`
	Habits          AnalyticsHabits          `json:"habits"`
	CategoryHealth  AnalyticsCategoryHealth  `json:"categoryHealth"`
	WorkspaceHealth AnalyticsWorkspaceHealth `json:"workspaceHealth"`
	BestTime        AnalyticsBestTime        `json:"bestTime"`
	Attention       AnalyticsAttention       `json:"attention"`
	KudosEffect     AnalyticsKudosEffect     `json:"kudosEffect"`
	SupportCoverage AnalyticsSupportCoverage `json:"supportCoverage"`
	TopSupporters   []AnalyticsSupporter     `json:"topSupporters"`
}

// AnalyticsKudosEffect compares median time-to-finish for tasks with vs without
// Kudos. Intentionally non-causal; HasComparison gates the comparison copy.
type AnalyticsKudosEffect struct {
	WithKudosMedianHours    float64 `json:"withKudosMedianHours"`
	WithoutKudosMedianHours float64 `json:"withoutKudosMedianHours"`
	WithCount               int     `json:"withCount"`
	WithoutCount            int     `json:"withoutCount"`
	HasComparison           bool    `json:"hasComparison"`
	Takeaway                string  `json:"takeaway"`
}

// AnalyticsSupportCoverage is the share of completed tasks that had support
// (Kudos or a tagged friend).
type AnalyticsSupportCoverage struct {
	Pct       int    `json:"pct"`
	Supported int    `json:"supported"`
	Total     int    `json:"total"`
	Takeaway  string `json:"takeaway"`
}

// AnalyticsSupporter is one person who sent the user Kudos in the period.
type AnalyticsSupporter struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Count int    `json:"count"`
}

// AnalyticsBestTimeCell is one weekday×hour bucket of completion activity.
// Weekday is Monday-indexed (0 = Mon … 6 = Sun).
type AnalyticsBestTimeCell struct {
	Weekday int `json:"weekday"`
	Hour    int `json:"hour"`
	Count   int `json:"count"`
	Level   int `json:"level"`
}

// AnalyticsBestTime backs the hour×weekday "best time of day" heatmap. Only
// non-zero cells are emitted; the client fills the rest of the grid.
type AnalyticsBestTime struct {
	Cells    []AnalyticsBestTimeCell `json:"cells"`
	MaxCount int                     `json:"maxCount"`
	Takeaway string                  `json:"takeaway"`
}

// AnalyticsAttentionTask is one open task flagged as needing attention.
type AnalyticsAttentionTask struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	Workspace  string   `json:"workspace"`
	Category   string   `json:"category"`
	CategoryID string   `json:"categoryId"`
	Deadline   *string  `json:"deadline,omitempty"`
	DaysOpen   int      `json:"daysOpen"`
	Reasons    []string `json:"reasons"`
}

type AnalyticsAttention struct {
	Tasks []AnalyticsAttentionTask `json:"tasks"`
}

// AnalyticsSignal is one stat in the signal strip (momentum / timing / support).
type AnalyticsSignal struct {
	Label      string  `json:"label"`
	Value      string  `json:"value"`      // formatted, e.g. "34 done", "81%", "27 Kudos"
	RawValue   float64 `json:"rawValue"`   // numeric for client-side comparisons
	Delta      float64 `json:"delta"`      // signed delta vs the previous comparable period
	DeltaLabel string  `json:"deltaLabel"` // e.g. "+18% vs last week", "+9 pts"
	Direction  string  `json:"direction"`  // up | down | flat
}

type AnalyticsSignals struct {
	Momentum AnalyticsSignal `json:"momentum"`
	Timing   AnalyticsSignal `json:"timing"`
	Support  AnalyticsSignal `json:"support"`
}

// AnalyticsProgressSegment is one category's slice of a single stacked bar.
type AnalyticsProgressSegment struct {
	CategoryID string `json:"categoryId"`
	Name       string `json:"name"`
	Color      string `json:"color"`
	Count      int    `json:"count"`
}

// AnalyticsProgressBucket is one bar (a day, week, or month).
type AnalyticsProgressBucket struct {
	Label    string                     `json:"label"`
	Date     string                     `json:"date"` // ISO date of bucket start (YYYY-MM-DD)
	Total    int                        `json:"total"`
	Segments []AnalyticsProgressSegment `json:"segments"`
}

type AnalyticsLegendItem struct {
	CategoryID string `json:"categoryId"`
	Name       string `json:"name"`
	Color      string `json:"color"`
}

// AnalyticsProgress backs the stacked-bar Weekly/Monthly Progress widget.
type AnalyticsProgress struct {
	Total      int                       `json:"total"`
	PrevTotal  int                       `json:"prevTotal"`
	Delta      float64                   `json:"delta"`      // percent change vs previous period
	BucketUnit string                    `json:"bucketUnit"` // day | week | month
	Buckets    []AnalyticsProgressBucket `json:"buckets"`
	Legend     []AnalyticsLegendItem     `json:"legend"`
	Takeaway   string                    `json:"takeaway"`
}

// AnalyticsShareSlice is one wedge of the category-share donut.
type AnalyticsShareSlice struct {
	CategoryID string  `json:"categoryId"`
	Name       string  `json:"name"`
	Color      string  `json:"color"`
	Count      int     `json:"count"`
	Pct        float64 `json:"pct"`
}

// AnalyticsShareBand is one column of the 100% stacked band (per week/month).
type AnalyticsShareBand struct {
	Label  string                `json:"label"`
	Slices []AnalyticsShareSlice `json:"slices"`
}

type AnalyticsCategoryShare struct {
	Slices   []AnalyticsShareSlice `json:"slices"`
	OverTime []AnalyticsShareBand  `json:"overTime"`
	Takeaway string                `json:"takeaway"`
}

// AnalyticsHeatmapDay is one cell of the activity heatmap.
type AnalyticsHeatmapDay struct {
	Date  string `json:"date"` // YYYY-MM-DD
	Count int    `json:"count"`
	Level int    `json:"level"` // 0-4
}

type AnalyticsHeatmap struct {
	Days     []AnalyticsHeatmapDay `json:"days"`
	MaxCount int                   `json:"maxCount"`
	Total    int                   `json:"total"`
	Takeaway string                `json:"takeaway"`
}

// AnalyticsHabitRow is one recurring task in the Habits widget. Copy never uses
// the word "streak" (see RhythmLabel).
type AnalyticsHabitRow struct {
	TemplateID  string  `json:"templateId"`
	Title       string  `json:"title"`
	Frequency   string  `json:"frequency"`
	Completed   int     `json:"completed"`
	Total       int     `json:"total"`
	Dots        []bool  `json:"dots"`
	NextDueAt   *string `json:"nextDueAt,omitempty"`
	RhythmLabel string  `json:"rhythmLabel"`
	Status      string  `json:"status"` // healthy | steady | needs-reset | light
}

type AnalyticsHabits struct {
	Rows     []AnalyticsHabitRow `json:"rows"`
	Takeaway string              `json:"takeaway"`
}

// AnalyticsCategoryHealthRow is one row of the Category Health diagnostic.
type AnalyticsCategoryHealthRow struct {
	CategoryID string `json:"categoryId"`
	Name       string `json:"name"`
	Workspace  string `json:"workspace"`
	Color      string `json:"color"`
	Done       int    `json:"done"`
	OnTimePct  int    `json:"onTimePct"`
	Kudos      int    `json:"kudos"`
	Status     string `json:"status"` // healthy | steady | needs-attention | slipping | unsupported | light
	Sparkline  []int  `json:"sparkline"`
}

type AnalyticsCategoryHealth struct {
	Rows []AnalyticsCategoryHealthRow `json:"rows"`
}

// AnalyticsWorkspaceHealthRow is one row of the Workspace Health navigation widget.
type AnalyticsWorkspaceHealthRow struct {
	Workspace string `json:"workspace"`
	Done      int    `json:"done"`
	OnTimePct int    `json:"onTimePct"`
	Kudos     int    `json:"kudos"`
	Status    string `json:"status"`
}

type AnalyticsWorkspaceHealth struct {
	Rows []AnalyticsWorkspaceHealthRow `json:"rows"`
}

// --- handler wiring (kept here so the package reads top-down) ---

type Handler struct {
	service *Service
}

func newHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterGetAnalyticsOperation registers GET /v1/user/analytics.
func RegisterGetAnalyticsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-analytics",
		Method:      http.MethodGet,
		Path:        "/v1/user/analytics",
		Summary:     "Get analytics dashboard",
		Description: "Returns the widget-ready analytics payload for the authenticated user, filtered by range, workspace, and category.",
		Tags:        []string{"Analytics"},
	}, handler.GetAnalytics)
}

// Routes wires the analytics handler into the API.
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := newHandler(service)
	RegisterGetAnalyticsOperation(api, handler)
}
