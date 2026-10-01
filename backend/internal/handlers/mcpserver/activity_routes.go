package mcpserver

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	defaultActivityLimit = 20
	maxActivityLimit     = 100
)

type ActivityItem struct {
	ID        string    `json:"id" example:"507f1f77bcf86cd799439011"`
	Tool      string    `json:"tool" example:"create_task"`
	Summary   string    `json:"summary" example:"Created task \"Buy milk\" in Groceries"`
	OK        bool      `json:"ok"`
	TargetID  string    `json:"target_id,omitempty" example:"507f1f77bcf86cd799439011"`
	CreatedAt time.Time `json:"created_at"`
}

type ListActivityInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ConnectionID  string `query:"connection_id" doc:"Only activity from this token or OAuth grant id"`
	Limit         int    `query:"limit" minimum:"0" maximum:"100" doc:"Entries to return, default 20, max 100"`
}

type ListActivityOutput struct {
	Body []ActivityItem `json:"body"`
}

type activityHandler struct {
	audit *AuditLog
}

func RegisterActivityRoutes(api huma.API, audit *AuditLog) {
	h := &activityHandler{audit: audit}
	huma.Register(api, huma.Operation{
		OperationID: "list-mcp-activity",
		Method:      http.MethodGet,
		Path:        "/v1/user/mcp-activity",
		Summary:     "List recent MCP agent activity",
		Description: "Recent create and complete calls made by the caller's connected agents, newest first.",
		Tags:        []string{"mcp"},
	}, h.List)
}

func (h *activityHandler) List(ctx context.Context, input *ListActivityInput) (*ListActivityOutput, error) {
	userID, err := tokenCallerID(ctx)
	if err != nil {
		return nil, err
	}
	var connID *primitive.ObjectID
	if input.ConnectionID != "" {
		id, err := primitive.ObjectIDFromHex(input.ConnectionID)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid connection ID", err)
		}
		connID = &id
	}
	limit := input.Limit
	if limit <= 0 {
		limit = defaultActivityLimit
	}
	limit = min(limit, maxActivityLimit)

	entries, err := h.audit.Recent(ctx, userID, connID, limit)
	if err != nil {
		slog.Error("unable to list mcp activity", "userId", userID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load activity. Please try again.", err)
	}
	out := make([]ActivityItem, 0, len(entries))
	for _, e := range entries {
		item := ActivityItem{ID: e.ID.Hex(), Tool: e.Tool, Summary: e.Summary, OK: e.OK, CreatedAt: e.CreatedAt}
		if len(e.TargetIDs) > 0 {
			item.TargetID = e.TargetIDs[0].Hex()
		}
		out = append(out, item)
	}
	return &ListActivityOutput{Body: out}, nil
}
