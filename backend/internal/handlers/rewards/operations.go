package rewards

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Operation registrations

func RegisterRedeemRewardOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "redeem-reward",
		Method:      http.MethodPost,
		Path:        "/v1/user/rewards/redeem",
		Summary:     "Redeem a kudos reward",
		Description: "Redeem a reward using accumulated kudos from sending encouragements and congratulations",
		Tags:        []string{"rewards"},
	}, handler.RedeemRewardHuma)
}

// RegisterRewardsOperations registers all rewards operations
func RegisterRewardsOperations(api huma.API, handler *Handler) {
	RegisterRedeemRewardOperation(api, handler)
}
