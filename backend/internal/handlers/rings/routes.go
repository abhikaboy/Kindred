package rings

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Handler holds the ring service for HTTP handling.
type Handler struct {
	service *RingService
	users   *mongo.Collection
}

// NewRingServiceFromCollections creates a RingService from the standard
// collections map, auto-creating the ring_states collection if absent.
func NewRingServiceFromCollections(collections map[string]*mongo.Collection) *RingService {
	ringStates := collections["ring_states"]
	if ringStates == nil {
		db := collections["users"].Database()
		ringStates = db.Collection("ring_states")
		collections["ring_states"] = ringStates
	}
	return NewRingService(ringStates, collections["users"])
}

// Routes registers ring endpoints with the Huma API.
func Routes(api huma.API, collections map[string]*mongo.Collection, ringService *RingService) {
	handler := &Handler{
		service: ringService,
		users:   collections["users"],
	}

	RegisterRingOperations(api, handler)
}

// RegisterRingOperations registers all ring operations with Huma.
func RegisterRingOperations(api huma.API, handler *Handler) {
	RegisterGetTodayOperation(api, handler)
	RegisterGetHistoryOperation(api, handler)
	RegisterClaimRewardOperation(api, handler)
	RegisterPauseDayOperation(api, handler)
	RegisterUnpauseDayOperation(api, handler)
}

func RegisterPauseDayOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "pause-ring-day",
		Method:      http.MethodPost,
		Path:        "/v1/user/rings/pause",
		Summary:     "Mark a day as life happened",
		Description: "Privately pauses today or one of the last 2 days. The day holds the run and score, excuses habits due that day, and sends no ring notifications. Never visible to friends.",
		Tags:        []string{"rings"},
	}, handler.PauseDay)
}

func RegisterUnpauseDayOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "unpause-ring-day",
		Method:      http.MethodDelete,
		Path:        "/v1/user/rings/pause",
		Summary:     "Undo a life happened pause",
		Description: "Removes the pause from today or one of the last 2 days.",
		Tags:        []string{"rings"},
	}, handler.UnpauseDay)
}

// --- Operation registrations ---

func RegisterGetTodayOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-rings-today",
		Method:      http.MethodGet,
		Path:        "/v1/user/rings/today",
		Summary:     "Get today's ring state and score",
		Description: "Returns the current day's ring progress, productivity score, streak, and reward availability",
		Tags:        []string{"rings"},
	}, handler.GetToday)
}

func RegisterGetHistoryOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-rings-history",
		Method:      http.MethodGet,
		Path:        "/v1/user/rings/history",
		Summary:     "Get ring history",
		Description: "Returns ring state history for the specified number of days (default 7, max 30)",
		Tags:        []string{"rings"},
	}, handler.GetHistory)
}

func RegisterClaimRewardOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "claim-ring-reward",
		Method:      http.MethodPost,
		Path:        "/v1/user/rings/reward",
		Summary:     "Claim daily ring reward",
		Description: "Claims the daily reward when all three rings are closed",
		Tags:        []string{"rings"},
	}, handler.ClaimReward)
}

// --- Handlers ---

// GetToday returns today's ring state along with the productivity score and streak.
func (h *Handler) GetToday(ctx context.Context, input *struct{}) (*GetTodayResponse, error) {
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("Authentication required")
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID")
	}

	timezone := auth.GetTimezoneOrDefault(ctx)

	state, err := h.service.GetOrCreateToday(ctx, userObjID, timezone)
	if err != nil {
		slog.Error("Failed to get today's ring state", "error", err, "user_id", userID)
		return nil, huma.Error500InternalServerError("Unable to load ring state")
	}

	score, err := h.service.CalculateScore(ctx, userObjID, timezone)
	if err != nil {
		slog.Error("Failed to calculate productivity score", "error", err, "user_id", userID)
		return nil, huma.Error500InternalServerError("Unable to calculate productivity score")
	}

	h.service.HoldRun(ctx, userObjID, timezone)

	// Fetch user streak from the users collection.
	var user types.User
	if err := h.users.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user); err != nil {
		slog.Error("Failed to fetch user for streak", "error", err, "user_id", userID)
		return nil, huma.Error500InternalServerError("Unable to load user data")
	}

	resp := &GetTodayResponse{}
	resp.Body.RingState = *state
	resp.Body.ProductivityScore = score
	resp.Body.CurrentStreak = user.Streak
	resp.Body.RewardAvailable = state.AllClosed && !state.RewardClaimed

	return resp, nil
}

// GetHistory returns the user's ring history for the requested number of days.
func (h *Handler) GetHistory(ctx context.Context, input *GetHistoryInput) (*GetHistoryResponse, error) {
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("Authentication required")
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID")
	}

	timezone := auth.GetTimezoneOrDefault(ctx)

	h.service.HoldRun(ctx, userObjID, timezone)

	history, err := h.service.GetHistory(ctx, userObjID, timezone, input.Days)
	if err != nil {
		slog.Error("Failed to get ring history", "error", err, "user_id", userID)
		return nil, huma.Error500InternalServerError("Unable to load ring history")
	}

	score, err := h.service.CalculateScore(ctx, userObjID, timezone)
	if err != nil {
		slog.Error("Failed to calculate productivity score", "error", err, "user_id", userID)
		return nil, huma.Error500InternalServerError("Unable to calculate productivity score")
	}

	var user types.User
	if err := h.users.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user); err != nil {
		slog.Error("Failed to fetch user for streak", "error", err, "user_id", userID)
		return nil, huma.Error500InternalServerError("Unable to load user data")
	}

	resp := &GetHistoryResponse{}
	resp.Body.History = history
	resp.Body.Score = score
	resp.Body.Streak = user.Streak

	return resp, nil
}

// ClaimReward claims the daily reward when all rings are closed.
func (h *Handler) ClaimReward(ctx context.Context, input *struct{}) (*ClaimRewardResponse, error) {
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("Authentication required")
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID")
	}

	timezone := auth.GetTimezoneOrDefault(ctx)

	result, err := h.service.ClaimReward(ctx, userObjID, timezone)
	if err != nil {
		slog.Error("Failed to claim ring reward", "error", err, "user_id", userID)
		return nil, huma.Error500InternalServerError("Unable to claim reward")
	}

	if !result.Claimed {
		return nil, huma.Error400BadRequest("Reward not available. All rings must be closed and reward must not already be claimed.")
	}

	resp := &ClaimRewardResponse{}
	resp.Body.CreditType = result.CreditType
	resp.Body.Amount = result.Amount

	return resp, nil
}

// PauseDay marks a day as life happened.
func (h *Handler) PauseDay(ctx context.Context, input *PauseDayInput) (*PauseDayResponse, error) {
	userObjID, err := requireUser(ctx)
	if err != nil {
		return nil, err
	}
	timezone := auth.GetTimezoneOrDefault(ctx)
	state, err := h.service.PauseDay(ctx, userObjID, timezone, input.Body.DaysAgo, input.Body.Note)
	if errors.Is(err, ErrPauseOutOfRange) {
		return nil, huma.Error400BadRequest("You can pause today or up to 2 days back")
	}
	if err != nil {
		slog.Error("Failed to pause day", "error", err, "user_id", userObjID.Hex())
		return nil, huma.Error500InternalServerError("Unable to pause this day")
	}
	return h.pauseResponse(ctx, userObjID, timezone, state)
}

// UnpauseDay undoes a life happened pause.
func (h *Handler) UnpauseDay(ctx context.Context, input *UnpauseDayInput) (*PauseDayResponse, error) {
	userObjID, err := requireUser(ctx)
	if err != nil {
		return nil, err
	}
	timezone := auth.GetTimezoneOrDefault(ctx)
	state, err := h.service.UnpauseDay(ctx, userObjID, timezone, input.DaysAgo)
	if errors.Is(err, ErrPauseOutOfRange) {
		return nil, huma.Error400BadRequest("You can undo a pause from today or up to 2 days back")
	}
	if err != nil {
		slog.Error("Failed to unpause day", "error", err, "user_id", userObjID.Hex())
		return nil, huma.Error500InternalServerError("Unable to undo the pause")
	}
	return h.pauseResponse(ctx, userObjID, timezone, state)
}

func (h *Handler) pauseResponse(ctx context.Context, userID primitive.ObjectID, timezone string, state *RingState) (*PauseDayResponse, error) {
	score, err := h.service.CalculateScore(ctx, userID, timezone)
	if err != nil {
		slog.Error("Failed to calculate productivity score", "error", err, "user_id", userID.Hex())
		return nil, huma.Error500InternalServerError("Unable to calculate productivity score")
	}
	resp := &PauseDayResponse{}
	resp.Body.RingState = *state
	resp.Body.ProductivityScore = score
	return resp, nil
}

func requireUser(ctx context.Context) (primitive.ObjectID, error) {
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return primitive.NilObjectID, huma.Error401Unauthorized("Authentication required")
	}
	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return primitive.NilObjectID, huma.Error400BadRequest("Invalid user ID")
	}
	return id, nil
}
