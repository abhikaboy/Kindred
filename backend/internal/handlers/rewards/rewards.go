package rewards

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RedeemRewardHuma handles reward redemption requests
func (h *Handler) RedeemRewardHuma(ctx context.Context, input *RedeemRewardInput) (*RedeemRewardOutput, error) {
	// Extract user ID from context
	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		slog.Error("Failed to get user ID from context")
		return nil, huma.Error401Unauthorized("unauthorized")
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		slog.Error("Failed to parse user ID", "error", err, "user_id", userID)
		return nil, huma.Error400BadRequest("invalid user ID")
	}

	// Validate reward type
	rewardType := input.Body.RewardType
	if !isValidRewardType(rewardType) {
		return nil, huma.Error400BadRequest(fmt.Sprintf("invalid reward type: %s", rewardType))
	}

	// Validate kudos type
	kudosType := input.Body.KudosType
	if kudosType != "encouragements" && kudosType != "congratulations" {
		return nil, huma.Error400BadRequest("invalid kudos type: must be 'encouragements' or 'congratulations'")
	}

	slog.Info("Redeeming reward", "user_id", userID, "reward_type", rewardType, "kudos_type", kudosType)

	// Redeem the reward
	response, err := h.service.RedeemReward(userObjID, rewardType, kudosType)
	if err != nil {
		slog.Error("Failed to redeem reward", "error", err, "user_id", userID, "reward_type", rewardType)

		// Check for specific error types
		if err.Error() == "integration rewards are not yet available" {
			return nil, huma.Error400BadRequest("integration rewards are not yet available")
		}

		// Check for insufficient kudos
		if err.Error()[:19] == "insufficient kudos:" {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, huma.Error500InternalServerError("failed to redeem reward")
	}

	slog.Info("Reward redeemed successfully", "user_id", userID, "reward_type", rewardType, "kudos_remaining", response.KudosRemaining)

	return &RedeemRewardOutput{
		Body: *response,
	}, nil
}

// isValidRewardType checks if the reward type is valid
func isValidRewardType(rt RewardType) bool {
	switch rt {
	case RewardTypeVoice, RewardTypeNaturalLanguage, RewardTypeGroup, RewardTypeIntegration, RewardTypeAnalytics:
		return true
	default:
		return false
	}
}
