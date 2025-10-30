package referral

import (
	"context"
	"fmt"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func NewHandler(collections map[string]*mongo.Collection) *Handler {
	return &Handler{
		service: newService(collections),
	}
}

// GetReferralInfoHuma returns the current user's referral information
func (h *Handler) GetReferralInfoHuma(ctx context.Context, input *GetReferralInfoInput) (*GetReferralInfoOutput, error) {
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	referral, err := h.service.GetReferralByUserID(userID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Create referral document if it doesn't exist
			referral, err = h.service.CreateReferralDocument(userID, nil)
			if err != nil {
				return nil, huma.Error500InternalServerError("Failed to create referral document", err)
			}
		} else {
			return nil, huma.Error500InternalServerError("Failed to get referral info", err)
		}
	}

	return &GetReferralInfoOutput{Body: *referral}, nil
}

// ApplyReferralCodeHuma applies a referral code for the current user
func (h *Handler) ApplyReferralCodeHuma(ctx context.Context, input *ApplyReferralCodeInput) (*ApplyReferralCodeOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Apply referral code
	err = h.service.ApplyReferralCode(userID, input.Body.ReferralCode)
	if err != nil {
		return nil, huma.Error400BadRequest("Failed to apply referral code", err)
	}

	// Get referrer info
	referrer, err := h.service.GetReferralByCode(input.Body.ReferralCode)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get referrer info", err)
	}

	var referrerUser types.User
	err = h.service.Users.FindOne(context.Background(), bson.M{"_id": referrer.UserID}).Decode(&referrerUser)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get referrer user info", err)
	}

	return &ApplyReferralCodeOutput{
		Body: struct {
			Success  bool          `json:"success"`
			Message  string        `json:"message"`
			Referrer *ReferrerInfo `json:"referrer,omitempty"`
		}{
			Success: true,
			Message: "Referral code applied successfully!",
			Referrer: &ReferrerInfo{
				ID:             referrerUser.ID,
				DisplayName:    referrerUser.DisplayName,
				Handle:         referrerUser.Handle,
				ProfilePicture: referrerUser.ProfilePicture,
			},
		},
	}, nil
}

// UnlockFeatureHuma unlocks a feature using referral credits
func (h *Handler) UnlockFeatureHuma(ctx context.Context, input *UnlockFeatureInput) (*UnlockFeatureOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Unlock feature
	feature, err := h.service.UnlockFeature(userID, input.Body.FeatureID)
	if err != nil {
		return nil, huma.Error400BadRequest("Failed to unlock feature", err)
	}

	// Get updated referral info
	referral, err := h.service.GetReferralByUserID(userID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get updated referral info", err)
	}

	return &UnlockFeatureOutput{
		Body: struct {
			Success          bool            `json:"success"`
			Feature          UnlockedFeature `json:"feature"`
			UnlocksRemaining int             `json:"unlocksRemaining"`
		}{
			Success:          true,
			Feature:          *feature,
			UnlocksRemaining: referral.UnlocksRemaining,
		},
	}, nil
}

// GetReferralStatsHuma returns referral statistics for the current user
func (h *Handler) GetReferralStatsHuma(ctx context.Context, input *GetReferralStatsInput) (*GetReferralStatsOutput, error) {
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	referral, err := h.service.GetReferralByUserID(userID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Create and return empty referral
			referral, err = h.service.CreateReferralDocument(userID, nil)
			if err != nil {
				return nil, huma.Error500InternalServerError("Failed to create referral document", err)
			}
		} else {
			return nil, huma.Error500InternalServerError("Failed to get referral stats", err)
		}
	}

	activeReferrals := 0
	for _, ref := range referral.ReferredUsers {
		if ref.RewardGranted {
			activeReferrals++
		}
	}

	return &GetReferralStatsOutput{
		Body: struct {
			TotalReferrals   int                `json:"totalReferrals"`
			ActiveReferrals  int                `json:"activeReferrals"`
			UnlocksRemaining int                `json:"unlocksRemaining"`
			UnlockedFeatures []UnlockedFeature  `json:"unlockedFeatures"`
			ReferredUsers    []ReferredUserInfo `json:"referredUsers"`
		}{
			TotalReferrals:   referral.Metadata.TotalReferred,
			ActiveReferrals:  activeReferrals,
			UnlocksRemaining: referral.UnlocksRemaining,
			UnlockedFeatures: referral.UnlockedFeatures,
			ReferredUsers:    referral.ReferredUsers,
		},
	}, nil
}

// GetAvailableFeaturesHuma returns all available features
func (h *Handler) GetAvailableFeaturesHuma(ctx context.Context, input *GetAvailableFeaturesInput) (*GetAvailableFeaturesOutput, error) {
	features := GetAvailableFeatures()

	return &GetAvailableFeaturesOutput{
		Body: struct {
			Features []FeatureDefinition `json:"features"`
		}{
			Features: features,
		},
	}, nil
}

