package Profile

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ReturnedDebounce is how long a recorded return stays put. A second call
// inside it is a no-op, so reopening the app (or a retried request) never
// restarts the kudos suggester's freshness window.
const ReturnedDebounce = 24 * time.Hour

type MarkReturnedInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	Body          struct {
		GapDays int `json:"gapDays" minimum:"0" maximum:"3650" doc:"Whole days since the user was last active, as computed by the client"`
	}
}

type MarkReturnedOutput struct {
	Body struct {
		// Recorded is false when a return was already recorded in the last 24h.
		Recorded bool `json:"recorded" doc:"Whether this call recorded a new return"`
	}
}

func RegisterMarkReturnedOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "mark-returned",
		Method:      http.MethodPost,
		Path:        "/v1/user/returned",
		Summary:     "Record a return after a gap",
		Description: "Called when the Welcome back sheet is shown. Sets returnedAt to now unless it was already set in the last 24 hours.",
		Tags:        []string{"profiles", "user"},
	}, handler.MarkReturned)
}

func (h *Handler) MarkReturned(ctx context.Context, input *MarkReturnedInput) (*MarkReturnedOutput, error) {
	authenticatedUserID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}
	userID, err := primitive.ObjectIDFromHex(authenticatedUserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid authenticated user ID", err)
	}

	recorded, err := h.service.MarkReturned(ctx, userID, time.Now().UTC())
	if err != nil {
		slog.Error("Failed to mark user returned", "userId", userID.Hex(), "gapDays", input.Body.GapDays, "error", err)
		return nil, huma.Error500InternalServerError("Unable to record return", err)
	}

	resp := &MarkReturnedOutput{}
	resp.Body.Recorded = recorded
	return resp, nil
}

// MarkReturned sets returnedAt = now, unless a return was recorded within
// ReturnedDebounce. The check and the write are one conditional update, so two
// concurrent calls cannot both win.
func (s *Service) MarkReturned(ctx context.Context, userID primitive.ObjectID, now time.Time) (bool, error) {
	res, err := s.Profiles.UpdateOne(ctx,
		markReturnedFilter(userID, now),
		bson.M{"$set": bson.M{"returnedAt": now}},
	)
	if err != nil {
		return false, err
	}
	return res.ModifiedCount > 0, nil
}

// markReturnedFilter matches the user only when no return is recorded, or the
// recorded one is older than ReturnedDebounce. It is the Mongo form of
// shouldRecordReturn.
func markReturnedFilter(userID primitive.ObjectID, now time.Time) bson.M {
	return bson.M{
		"_id": userID,
		"$or": bson.A{
			bson.M{"returnedAt": nil}, // matches missing and null
			bson.M{"returnedAt": bson.M{"$lte": now.Add(-ReturnedDebounce)}},
		},
	}
}

// shouldRecordReturn is the rule markReturnedFilter encodes.
func shouldRecordReturn(prev *time.Time, now time.Time) bool {
	return prev == nil || !prev.After(now.Add(-ReturnedDebounce))
}
