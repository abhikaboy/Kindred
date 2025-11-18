package rewards

import (
	"context"
	"fmt"
	"log/slog"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService creates a new Service with the necessary collections
func newService(collections map[string]*mongo.Collection) *Service {
	users := collections["users"]

	// Log if collections are not found
	if users == nil {
		slog.Error("Users collection not found in database")
	}

	return &Service{
		Users: users,
	}
}

// NewRewardsService is a public constructor for external packages
func NewRewardsService(collections map[string]*mongo.Collection) *Service {
	return newService(collections)
}

// GetUserKudosBalances fetches both kudos balances for a user (encouragements and congratulations separately)
func (s *Service) GetUserKudosBalances(userID primitive.ObjectID) (encouragements int, congratulations int, err error) {
	if s.Users == nil {
		return 0, 0, fmt.Errorf("users collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": userID}

	var user struct {
		KudosRewards struct {
			Encouragements  int `bson:"encouragements"`
			Congratulations int `bson:"congratulations"`
		} `bson:"kudosRewards"`
	}

	err = s.Users.FindOne(ctx, filter).Decode(&user)
	if err != nil {
		return 0, 0, err
	}

	return user.KudosRewards.Encouragements, user.KudosRewards.Congratulations, nil
}

// RedeemReward processes a reward redemption using a specific kudos type
func (s *Service) RedeemReward(userID primitive.ObjectID, rewardType RewardType, kudosType string) (*RedeemRewardResponse, error) {
	if s.Users == nil {
		return nil, fmt.Errorf("users collection not available")
	}

	ctx := context.Background()

	// Validate kudos type
	if kudosType != "encouragements" && kudosType != "congratulations" {
		return nil, fmt.Errorf("invalid kudos type: must be 'encouragements' or 'congratulations'")
	}

	// Get the kudos cost for this reward
	kudosCost, err := s.getKudosCost(rewardType)
	if err != nil {
		return nil, err
	}

	// Check if integration reward (disabled for now)
	if rewardType == RewardTypeIntegration {
		return nil, fmt.Errorf("integration rewards are not yet available")
	}

	// Check if user has enough kudos of the specified type
	encouragements, congratulations, err := s.GetUserKudosBalances(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get kudos balance: %w", err)
	}

	var currentBalance int
	if kudosType == "encouragements" {
		currentBalance = encouragements
	} else {
		currentBalance = congratulations
	}

	if currentBalance < kudosCost {
		return nil, fmt.Errorf("insufficient %s: need %d, have %d", kudosType, kudosCost, currentBalance)
	}

	// Build the update document
	update := bson.M{"$inc": bson.M{}}
	creditsReceived := 0

	incMap := update["$inc"].(bson.M)

	// Add credit increment based on reward type
	switch rewardType {
	case RewardTypeVoice:
		incMap["credits.voice"] = CreditAmountVoice
		creditsReceived = CreditAmountVoice
	case RewardTypeNaturalLanguage:
		incMap["credits.naturalLanguage"] = CreditAmountNaturalLanguage
		creditsReceived = CreditAmountNaturalLanguage
	case RewardTypeGroup:
		incMap["credits.group"] = CreditAmountGroup
		creditsReceived = CreditAmountGroup
	case RewardTypeAnalytics:
		incMap["credits.analytics"] = CreditAmountAnalytics
		creditsReceived = CreditAmountAnalytics
	default:
		return nil, fmt.Errorf("unknown reward type: %s", rewardType)
	}

	// Deduct kudos from the specified type
	kudosField := fmt.Sprintf("kudosRewards.%s", kudosType)
	incMap[kudosField] = -kudosCost

	// Execute the update
	filter := bson.M{"_id": userID}
	_, err = s.Users.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, fmt.Errorf("failed to redeem reward: %w", err)
	}

	return &RedeemRewardResponse{
		Message:         fmt.Sprintf("Successfully redeemed %s reward using %s", rewardType, kudosType),
		KudosRemaining:  currentBalance - kudosCost,
		CreditsReceived: creditsReceived,
	}, nil
}

// getKudosCost returns the kudos cost for a reward type
func (s *Service) getKudosCost(rewardType RewardType) (int, error) {
	switch rewardType {
	case RewardTypeVoice:
		return KudosCostVoice, nil
	case RewardTypeNaturalLanguage:
		return KudosCostNaturalLanguage, nil
	case RewardTypeGroup:
		return KudosCostGroup, nil
	case RewardTypeIntegration:
		return KudosCostIntegration, nil
	case RewardTypeAnalytics:
		return KudosCostAnalytics, nil
	default:
		return 0, fmt.Errorf("unknown reward type: %s", rewardType)
	}
}
