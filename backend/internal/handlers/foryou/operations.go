package foryou

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func RegisterGetForYouOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-for-you",
		Method:      http.MethodGet,
		Path:        "/v1/user/for-you",
		Summary:     "Get the For You feed",
		Description: "Returns the curated For You feed for the authenticated user, organized into Catch up and Suggested for you sections.",
		Tags:        []string{"for-you"},
	}, handler.GetForYouHuma)
}

func RegisterRecordInteractionOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "record-for-you-interaction",
		Method:      http.MethodPost,
		Path:        "/v1/user/for-you/interactions",
		Summary:     "Record a For You CTA interaction",
		Description: "Increments the interaction counter for a card type, counting toward the threshold that switches the card to compact display mode.",
		Tags:        []string{"for-you"},
	}, handler.RecordInteractionHuma)
}

func RegisterForYouOperations(api huma.API, handler *Handler) {
	RegisterGetForYouOperation(api, handler)
	RegisterRecordInteractionOperation(api, handler)
}
