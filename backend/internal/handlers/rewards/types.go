package rewards

import (
	"go.mongodb.org/mongo-driver/mongo"
)

// RewardType represents the type of reward being redeemed
type RewardType string

const (
	RewardTypeVoice           RewardType = "voice"
	RewardTypeNaturalLanguage RewardType = "naturalLanguage"
	RewardTypeGroup           RewardType = "group"
	RewardTypeIntegration     RewardType = "integration"
	RewardTypeAnalytics       RewardType = "analytics"
)

// Kudos costs for each reward (all rewards cost 12 kudos)
const (
	KudosCostVoice           = 12
	KudosCostNaturalLanguage = 12
	KudosCostGroup           = 12
	KudosCostIntegration     = 12
	KudosCostAnalytics       = 12
)

// Credit amounts for each reward
const (
	CreditAmountVoice           = 2
	CreditAmountNaturalLanguage = 2
	CreditAmountGroup           = 1
	CreditAmountAnalytics       = 1
)

// Input/Output types for rewards operations

// Redeem Reward
type RedeemRewardInput struct {
	Authorization string              `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string              `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          RedeemRewardRequest `json:"body"`
}

type RedeemRewardRequest struct {
	RewardType RewardType `json:"rewardType" enum:"voice,naturalLanguage,group,integration,analytics" doc:"Type of reward to redeem"`
	KudosType  string     `json:"kudosType" enum:"encouragements,congratulations" doc:"Type of kudos to use for redemption"`
}

type RedeemRewardOutput struct {
	Body RedeemRewardResponse `json:"body"`
}

type RedeemRewardResponse struct {
	Message         string `json:"message" doc:"Success message"`
	KudosRemaining  int    `json:"kudosRemaining" doc:"Remaining kudos after redemption"`
	CreditsReceived int    `json:"creditsReceived,omitempty" doc:"Number of credits received (if applicable)"`
}

// Service holds the database collections needed for rewards operations
type Service struct {
	Users *mongo.Collection
}

// Handler wraps the Service for HTTP handling
type Handler struct {
	service *Service
}
