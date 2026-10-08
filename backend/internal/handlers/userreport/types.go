package userreport

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// UserReportKnown is one plain row in the inventory of what we hold.
type UserReportKnown struct {
	Label  string `json:"label"`
	Value  string `json:"value"`
	Detail string `json:"detail,omitempty"`
	Source string `json:"source" enum:"activity,stated,inferred" doc:"stated = you told us; inferred = we worked it out"`
}

// UserReportAction is a link to where the user can act on an observation.
type UserReportAction struct {
	Label  string `json:"label"`
	Kind   string `json:"kind" enum:"task,account,activity,home" doc:"task: target is a task id; account: a user id; activity: a view name; home: empty"`
	Target string `json:"target"`
}

// UserReportNoticed is one ranked observation, compared with the user's own past.
type UserReportNoticed struct {
	Kind     string            `json:"kind" enum:"weeks,habit,stalled,supporters,kudos,ontime,peak"`
	Headline string            `json:"headline"`
	Evidence string            `json:"evidence"`
	Strength string            `json:"strength" enum:"strong,moderate"`
	Action   *UserReportAction `json:"action,omitempty"`
}

// UserReportResponse covers the last 90 days in the user's timezone.
type UserReportResponse struct {
	GeneratedAt time.Time           `json:"generatedAt"`
	RangeLabel  string              `json:"rangeLabel" doc:"e.g. 'Jul 11 – Oct 8'"`
	Known       []UserReportKnown   `json:"known"`
	Noticed     []UserReportNoticed `json:"noticed" doc:"At most 5, strongest evidence first"`
	NotYet      []string            `json:"notYet" doc:"What we could say with more data"`
	PlainText   string              `json:"plainText" doc:"The whole report as plain text, for copying"`
}

type GetUserReportInput struct{}

type GetUserReportOutput struct {
	Body UserReportResponse
}

type Handler struct {
	service *Service
}

// Routes registers GET /v1/user/report.
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	h := &Handler{service: newService(collections)}
	huma.Register(api, huma.Operation{
		OperationID: "get-user-report",
		Method:      http.MethodGet,
		Path:        "/v1/user/report",
		Summary:     "Get the personal report",
		Description: "What we hold about the user, what we noticed over the last 90 days, and what needs more data. Computed in the user's timezone.",
		Tags:        []string{"Analytics"},
	}, h.GetUserReport)
}

func (h *Handler) GetUserReport(ctx context.Context, _ *GetUserReportInput) (*GetUserReportOutput, error) {
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
		slog.Error("user report: failed to build", "error", err, "user_id", uid)
		return nil, huma.Error500InternalServerError("Unable to build your report. Please try again.", err)
	}
	return &GetUserReportOutput{Body: resp}, nil
}
