package rings

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RingType represents the type of activity ring
type RingType string

const (
	RingPlan  RingType = "plan"
	RingDo    RingType = "do"
	RingShare RingType = "share"
)

// Default targets for each ring
const (
	DefaultPlanTarget  = 2
	DefaultDoTarget    = 3
	DefaultShareTarget = 1
)

// Score calculation constants
const (
	ScoreBase            = 30
	ScoreRingWindow      = 7
	ScoreMaxRings        = 21
	ScoreRingBonus       = 55
	ScoreMaxStreak       = 7
	ScoreConsistencyDays = 7
	ScoreConsistencyMax  = 8
)

// RingProgress tracks progress toward closing a single ring
type RingProgress struct {
	Current int  `bson:"current" json:"current"`
	Target  int  `bson:"target" json:"target"`
	Closed  bool `bson:"closed" json:"closed"`
}

// RingState represents a user's ring state for a single day
type RingState struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID        primitive.ObjectID `bson:"user_id" json:"user_id"`
	Date          time.Time          `bson:"date" json:"date"`
	Plan          RingProgress       `bson:"plan" json:"plan"`
	Do            RingProgress       `bson:"do" json:"do"`
	Share         RingProgress       `bson:"share" json:"share"`
	AllClosed     bool               `bson:"all_closed" json:"all_closed"`
	RewardClaimed bool               `bson:"reward_claimed" json:"reward_claimed"`
	RewardType    string             `bson:"reward_type,omitempty" json:"reward_type,omitempty"`
	RewardAmount  int                `bson:"reward_amount,omitempty" json:"reward_amount,omitempty"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at" json:"updated_at"`
}

// RewardDrop defines a possible reward with its probability weight
type RewardDrop struct {
	CreditType string `json:"credit_type"`
	Amount     int    `json:"amount"`
	Weight     int    `json:"weight"` // relative weight out of total
}

// RewardPool contains the weighted list of possible reward drops
var RewardPool = []RewardDrop{
	{CreditType: "voice", Amount: 1, Weight: 40},
	{CreditType: "naturalLanguage", Amount: 1, Weight: 40},
	{CreditType: "analytics", Amount: 1, Weight: 15},
	{CreditType: "voice", Amount: 2, Weight: 5},
}

// --- API response types ---

// GetTodayResponse is the response for fetching today's ring state
type GetTodayResponse struct {
	Body struct {
		RingState         RingState `json:"ring_state"`
		ProductivityScore int       `json:"productivity_score"`
		CurrentStreak     int       `json:"current_streak"`
		RewardAvailable   bool      `json:"reward_available"`
	}
}

// GetHistoryInput is the query input for fetching ring history
type GetHistoryInput struct {
	Days int `query:"days" default:"7" doc:"Number of days of history to fetch"`
}

// GetHistoryResponse is the response for fetching ring history
type GetHistoryResponse struct {
	Body struct {
		History []RingState `json:"history"`
		Score   int         `json:"score"`
		Streak  int         `json:"streak"`
	}
}

// ClaimRewardResponse is the response after claiming a ring reward
type ClaimRewardResponse struct {
	Body struct {
		CreditType string `json:"credit_type"`
		Amount     int    `json:"amount"`
	}
}
