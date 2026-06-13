package analytics

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GetAnalytics returns the dashboard payload for the authenticated user.
func (h *Handler) GetAnalytics(ctx context.Context, input *GetAnalyticsInput) (*GetAnalyticsOutput, error) {
	uid, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("Not authenticated")
	}
	userID, err := primitive.ObjectIDFromHex(uid)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	rng := input.Range
	switch rng {
	case RangeWeek, RangeMonth, RangeSixMonth:
	default:
		rng = RangeWeek
	}

	resp, err := h.service.GetAnalytics(userID, rng, input.Workspace, input.Category)
	if err != nil {
		slog.Error("analytics: failed to build dashboard", "error", err, "user_id", uid, "range", rng)
		return nil, huma.Error500InternalServerError("Unable to load analytics. Please try again.", err)
	}

	return &GetAnalyticsOutput{Body: resp}, nil
}
