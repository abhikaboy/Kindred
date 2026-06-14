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

// GetLayout returns the user's saved dashboard layout (empty if never set).
func (h *Handler) GetLayout(ctx context.Context, input *GetLayoutInput) (*GetLayoutOutput, error) {
	userID, err := currentUserID(ctx)
	if err != nil {
		return nil, err
	}
	layout, err := h.service.GetLayout(userID)
	if err != nil {
		slog.Error("analytics: failed to load layout", "error", err, "user_id", userID.Hex())
		return nil, huma.Error500InternalServerError("Unable to load layout.", err)
	}
	return &GetLayoutOutput{Body: layout}, nil
}

// UpdateLayout persists the user's dashboard layout.
func (h *Handler) UpdateLayout(ctx context.Context, input *UpdateLayoutInput) (*UpdateLayoutOutput, error) {
	userID, err := currentUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := h.service.UpdateLayout(userID, input.Body); err != nil {
		slog.Error("analytics: failed to save layout", "error", err, "user_id", userID.Hex())
		return nil, huma.Error500InternalServerError("Unable to save layout.", err)
	}
	return &UpdateLayoutOutput{Body: input.Body}, nil
}

// currentUserID resolves the authenticated user from context.
func currentUserID(ctx context.Context) (primitive.ObjectID, error) {
	uid, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return primitive.ObjectID{}, huma.Error401Unauthorized("Not authenticated")
	}
	userID, err := primitive.ObjectIDFromHex(uid)
	if err != nil {
		return primitive.ObjectID{}, huma.Error400BadRequest("Invalid user ID", err)
	}
	return userID, nil
}
