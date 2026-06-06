package foryou

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

// GetForYouHuma assembles and returns the current user's For You feed.
func (h *Handler) GetForYouHuma(ctx context.Context, input *GetForYouInput) (*GetForYouOutput, error) {
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	timezone := input.Timezone
	if timezone == "" {
		timezone = auth.GetTimezoneOrDefault(ctx)
	}

	feed, err := h.service.GetForYou(ctx, userID, timezone)
	if err != nil {
		slog.Error("failed to build For You feed", "userId", userIDStr, "error", err)
		return nil, huma.Error500InternalServerError("Unable to load For You", err)
	}
	return &GetForYouOutput{Body: *feed}, nil
}

// RecordInteractionHuma marks that the user tapped a CTA on a card of a given type.
// Counts toward the threshold that switches the card to compact mode.
func (h *Handler) RecordInteractionHuma(ctx context.Context, input *RecordInteractionInput) (*RecordInteractionOutput, error) {
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}
	if input.Body.CardType == "" {
		return nil, huma.Error400BadRequest("cardType is required", nil)
	}
	if err := h.service.RecordInteraction(ctx, userID, input.Body.CardType); err != nil {
		slog.Error("failed to record For You interaction", "userId", userIDStr, "cardType", input.Body.CardType, "error", err)
		return nil, huma.Error500InternalServerError("Unable to record interaction", err)
	}
	out := &RecordInteractionOutput{}
	out.Body.Message = "Interaction recorded"
	return out, nil
}

// DismissCardHuma records that the user dismissed a card so it no longer
// appears in their For You feed.
func (h *Handler) DismissCardHuma(ctx context.Context, input *DismissCardInput) (*DismissCardOutput, error) {
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}
	if input.Body.CardID == "" {
		return nil, huma.Error400BadRequest("cardId is required", nil)
	}
	if err := h.service.DismissCard(ctx, userID, input.Body.CardID); err != nil {
		slog.Error("failed to dismiss For You card", "userId", userIDStr, "cardId", input.Body.CardID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to dismiss card", err)
	}
	out := &DismissCardOutput{}
	out.Body.Message = "Card dismissed"
	return out, nil
}
