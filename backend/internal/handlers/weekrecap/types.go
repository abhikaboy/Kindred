package weekrecap

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// WeekRecapBar is one bar in a week or day chart.
type WeekRecapBar struct {
	Label   string `json:"label" doc:"Short label, e.g. 'Sep 7', 'This week', 'M'"`
	Value   int    `json:"value" doc:"Tasks finished"`
	Current bool   `json:"current" doc:"True for the recap week (or its biggest day)"`
}

// WeekRecapPerson is someone who sent the user Kudos during the week.
type WeekRecapPerson struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Icon    string `json:"icon"`
	Line    string `json:"line" doc:"What they sent, e.g. a quoted message or 'Sent a photo'"`
	Context string `json:"context" doc:"Where and when, e.g. 'on Draft the grant intro · Tue'"`
}

// WeekRecapAction is the single one-tap action on a card.
type WeekRecapAction struct {
	Kind       string `json:"kind" enum:"plan" doc:"plan = PUT the plan below to /v1/user/tasks/{categoryId}/{taskId}/plan"`
	Label      string `json:"label" doc:"Button copy"`
	TaskID     string `json:"taskId"`
	CategoryID string `json:"categoryId"`
	Step       string `json:"step"`
	Size       string `json:"size" enum:"2m,10m,full"`
	At         string `json:"at" doc:"RFC3339 time, already resolved in the user's timezone"`
	Done       string `json:"done" doc:"Confirmation copy after the action succeeds"`
}

// WeekRecapCard is one card in the story. Optional fields depend on kind.
type WeekRecapCard struct {
	Kind      string            `json:"kind" enum:"week,peak,habit,supporters,slipped,share"`
	Headline  string            `json:"headline"`
	Body      string            `json:"body"`
	Caption   string            `json:"caption,omitempty"`
	Weeks     []WeekRecapBar    `json:"weeks,omitempty" doc:"week: your last weeks plus this one"`
	Usual     *int              `json:"usual,omitempty" doc:"week: your own average from prior weeks; absent in the first week"`
	Days      []WeekRecapBar    `json:"days,omitempty" doc:"week (first week only): Mon..Sun"`
	Hours     []int             `json:"hours,omitempty" doc:"peak: 24 completion counts by local hour"`
	PeakHour  *int              `json:"peakHour,omitempty" doc:"peak: local hour 0-23"`
	HabitGrid [][]int           `json:"habitGrid,omitempty" doc:"habit: oldest week first, Mon..Sun; 1 done, 0 not, -1 not yet"`
	People    []WeekRecapPerson `json:"people,omitempty"`
	Action    *WeekRecapAction  `json:"action,omitempty"`
	ShareText string            `json:"shareText,omitempty" doc:"share: plain-text version for copying"`
}

// WeekRecapResponse is the full story, computed in the user's timezone.
type WeekRecapResponse struct {
	WeekStart   string          `json:"weekStart" doc:"Local Monday, YYYY-MM-DD"`
	WeekEnd     string          `json:"weekEnd" doc:"Local Sunday, YYYY-MM-DD"`
	RangeLabel  string          `json:"rangeLabel" doc:"e.g. 'Sep 29 – Oct 5'"`
	Variant     string          `json:"variant" enum:"first,quieter,usual,bigger"`
	IsFirstWeek bool            `json:"isFirstWeek"`
	Teaser      string          `json:"teaser" doc:"One line for the entry point"`
	Cards       []WeekRecapCard `json:"cards"`
}

type GetWeekRecapInput struct{}

type GetWeekRecapOutput struct {
	Body WeekRecapResponse
}

type Handler struct {
	service *Service
}

// Routes registers GET /v1/user/week-recap.
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	h := &Handler{service: newService(collections)}
	huma.Register(api, huma.Operation{
		OperationID: "get-week-recap",
		Method:      http.MethodGet,
		Path:        "/v1/user/week-recap",
		Summary:     "Get the weekly story",
		Description: "Returns the 'Your week' story cards for the authenticated user, computed in their timezone. On Sunday it covers the current Mon-Sun week; otherwise the last full week.",
		Tags:        []string{"Analytics"},
	}, h.GetWeekRecap)
}

func (h *Handler) GetWeekRecap(ctx context.Context, _ *GetWeekRecapInput) (*GetWeekRecapOutput, error) {
	uid, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("Not authenticated")
	}
	userID, err := primitive.ObjectIDFromHex(uid)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}
	resp, err := h.service.Get(ctx, userID, auth.GetTimezoneOrDefault(ctx))
	if err != nil {
		slog.Error("week recap: failed to build", "error", err, "user_id", uid)
		return nil, huma.Error500InternalServerError("Unable to load your week. Please try again.", err)
	}
	return &GetWeekRecapOutput{Body: resp}, nil
}
