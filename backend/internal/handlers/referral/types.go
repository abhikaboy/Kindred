package referral

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// FeatureID constants for unlockable features
const (
	FeatureUnlimitedVoiceDumps = "unlimited_voice_dumps"
	FeaturePostingToCircles    = "posting_to_circles"
	FeatureAnalytics           = "analytics"
	FeatureProfileBadge        = "profile_badge"
	FeatureUnlimitedGifs       = "unlimited_gifs"
)

type Handler struct {
	service *Service
}

type Service struct {
	Referrals *mongo.Collection
	Users     *mongo.Collection
}

// ReferralDocument represents a user's referral information
type ReferralDocument struct {
	ID               primitive.ObjectID  `bson:"_id" json:"id"`
	UserID           primitive.ObjectID  `bson:"userId" json:"userId"`
	ReferralCode     string              `bson:"referralCode" json:"referralCode"`
	UnlocksRemaining int                 `bson:"unlocksRemaining" json:"unlocksRemaining"`
	ReferredUsers    []ReferredUserInfo  `bson:"referredUsers" json:"referredUsers"`
	UnlockedFeatures []UnlockedFeature   `bson:"unlockedFeatures" json:"unlockedFeatures"`
	ReferredBy       *primitive.ObjectID `bson:"referredBy,omitempty" json:"referredBy,omitempty"`
	Metadata         ReferralMetadata    `bson:"metadata" json:"metadata"`
}

// ReferredUserInfo contains information about a referred user
type ReferredUserInfo struct {
	UserID        primitive.ObjectID `bson:"userId" json:"userId"`
	JoinedAt      time.Time          `bson:"joinedAt" json:"joinedAt"`
	DisplayName   string             `bson:"displayName" json:"displayName"`
	Handle        string             `bson:"handle" json:"handle"`
	RewardGranted bool               `bson:"rewardGranted" json:"rewardGranted"` // Track if reward was given
}

// UnlockedFeature represents a feature unlocked through referrals
type UnlockedFeature struct {
	FeatureID   string             `bson:"featureId" json:"featureId"`
	FeatureName string             `bson:"featureName" json:"featureName"`
	UnlockedAt  time.Time          `bson:"unlockedAt" json:"unlockedAt"`
	UnlockedBy  primitive.ObjectID `bson:"unlockedBy" json:"unlockedBy"` // Which referral granted this
	ExpiresAt   *time.Time         `bson:"expiresAt,omitempty" json:"expiresAt,omitempty"`
	Active      bool               `bson:"active" json:"active"` // Can be deactivated without deletion
}

// ReferralMetadata contains tracking information
type ReferralMetadata struct {
	CreatedAt      time.Time  `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time  `bson:"updatedAt" json:"updatedAt"`
	TotalReferred  int        `bson:"totalReferred" json:"totalReferred"`
	LastReferralAt *time.Time `bson:"lastReferralAt,omitempty" json:"lastReferralAt,omitempty"`
}

// API Input/Output Types

type GetReferralInfoInput struct {
	// User ID from auth context
}

type GetReferralInfoOutput struct {
	Body ReferralDocument
}

type ApplyReferralCodeInput struct {
	Body struct {
		ReferralCode string `json:"referralCode" validate:"required,len=8"`
	}
}

type ApplyReferralCodeOutput struct {
	Body struct {
		Success  bool          `json:"success"`
		Message  string        `json:"message"`
		Referrer *ReferrerInfo `json:"referrer,omitempty"`
	}
}

type ReferrerInfo struct {
	ID             primitive.ObjectID `json:"id"`
	DisplayName    string             `json:"displayName"`
	Handle         string             `json:"handle"`
	ProfilePicture string             `json:"profilePicture"`
}

type UnlockFeatureInput struct {
	Body struct {
		FeatureID string `json:"featureId" validate:"required"`
	}
}

type UnlockFeatureOutput struct {
	Body struct {
		Success          bool            `json:"success"`
		Feature          UnlockedFeature `json:"feature"`
		UnlocksRemaining int             `json:"unlocksRemaining"`
	}
}

type GetReferralStatsInput struct {
	// User ID from auth context
}

type GetReferralStatsOutput struct {
	Body struct {
		TotalReferrals   int                `json:"totalReferrals"`
		ActiveReferrals  int                `json:"activeReferrals"`
		UnlocksRemaining int                `json:"unlocksRemaining"`
		UnlockedFeatures []UnlockedFeature  `json:"unlockedFeatures"`
		ReferredUsers    []ReferredUserInfo `json:"referredUsers"`
	}
}

// Feature definition for feature catalog
type FeatureDefinition struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	Icon              string `json:"icon,omitempty"`
	RequiredReferrals int    `json:"requiredReferrals"` // How many referrals needed
}

// GetAvailableFeaturesInput - no body needed
type GetAvailableFeaturesInput struct{}

type GetAvailableFeaturesOutput struct {
	Body struct {
		Features []FeatureDefinition `json:"features"`
	}
}
