package referral

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

func Routes(api huma.API, collections map[string]*mongo.Collection) {
	handler := NewHandler(collections)

	// Get current user's referral info
	huma.Register(api, huma.Operation{
		OperationID: "get-referral-info",
		Method:      "GET",
		Path:        "/v1/user/referrals",
		Summary:     "Get referral information",
		Description: "Returns the current user's referral code, unlocks, and referred users",
		Tags:        []string{"referrals"},
	}, handler.GetReferralInfoHuma)

	// Apply a referral code
	huma.Register(api, huma.Operation{
		OperationID: "apply-referral-code",
		Method:      "POST",
		Path:        "/v1/user/referrals/apply",
		Summary:     "Apply a referral code",
		Description: "Apply a referral code to your account (only works if you haven't been referred yet)",
		Tags:        []string{"referrals"},
	}, handler.ApplyReferralCodeHuma)

	// Unlock a feature
	huma.Register(api, huma.Operation{
		OperationID: "unlock-feature",
		Method:      "POST",
		Path:        "/v1/user/referrals/unlock",
		Summary:     "Unlock a feature",
		Description: "Use a referral unlock to activate a premium feature",
		Tags:        []string{"referrals"},
	}, handler.UnlockFeatureHuma)

	// Get referral stats
	huma.Register(api, huma.Operation{
		OperationID: "get-referral-stats",
		Method:      "GET",
		Path:        "/v1/user/referrals/stats",
		Summary:     "Get referral statistics",
		Description: "Returns detailed statistics about referrals and unlocked features",
		Tags:        []string{"referrals"},
	}, handler.GetReferralStatsHuma)

	// Get available features
	huma.Register(api, huma.Operation{
		OperationID: "get-available-features",
		Method:      "GET",
		Path:        "/v1/referrals/features",
		Summary:     "Get available features",
		Description: "Returns all features that can be unlocked through referrals (public endpoint)",
		Tags:        []string{"referrals"},
	}, handler.GetAvailableFeaturesHuma)
}

