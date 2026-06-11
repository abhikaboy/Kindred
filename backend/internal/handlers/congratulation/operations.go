package congratulation

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Operation registrations

func RegisterCreateCongratulationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-congratulation",
		Method:      http.MethodPost,
		Path:        "/v1/user/congratulations",
		Summary:     "Create a new congratulation",
		Description: "Create a new congratulation message for another user",
		Tags:        []string{"congratulations"},
	}, handler.CreateCongratulationHuma)
}

func RegisterGetCongratulationsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-congratulations",
		Method:      http.MethodGet,
		Path:        "/v1/user/congratulations",
		Summary:     "Get congratulations",
		Description: "Retrieve all congratulations received by the authenticated user",
		Tags:        []string{"congratulations"},
	}, handler.GetCongratulationsHuma)
}

func RegisterGetCongratulationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-congratulation",
		Method:      http.MethodGet,
		Path:        "/v1/user/congratulations/{id}",
		Summary:     "Get congratulation by ID",
		Description: "Retrieve a specific congratulation by its ID",
		Tags:        []string{"congratulations"},
	}, handler.GetCongratulationHuma)
}

func RegisterUpdateCongratulationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-congratulation",
		Method:      http.MethodPatch,
		Path:        "/v1/user/congratulations/{id}",
		Summary:     "Update congratulation",
		Description: "Update a congratulation message",
		Tags:        []string{"congratulations"},
	}, handler.UpdateCongratulationHuma)
}

func RegisterDeleteCongratulationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-congratulation",
		Method:      http.MethodDelete,
		Path:        "/v1/user/congratulations/{id}",
		Summary:     "Delete congratulation",
		Description: "Delete a congratulation message",
		Tags:        []string{"congratulations"},
	}, handler.DeleteCongratulationHuma)
}

func RegisterMarkCongratulationsReadOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "mark-congratulations-read",
		Method:      http.MethodPatch,
		Path:        "/v1/user/congratulations/mark-read",
		Summary:     "Mark congratulations as read",
		Description: "Mark multiple congratulations as read",
		Tags:        []string{"congratulations"},
	}, handler.MarkCongratulationsReadHuma)
}

func RegisterSendBeakCongratulationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "send-beak-congratulation",
		Method:      http.MethodPost,
		Path:        "/v1/user/congratulations/beak",
		Summary:     "Send a congratulation from beak",
		Description: "Send a system congratulation from the beak account with push notification. Used during onboarding tutorial.",
		Tags:        []string{"congratulations"},
	}, handler.SendBeakCongratulationHuma)
}

func RegisterGetSentCongratulationsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-sent-congratulations",
		Method:      http.MethodGet,
		Path:        "/v1/user/congratulations/sent",
		Summary:     "Get sent congratulations",
		Description: "Retrieve all congratulations sent by the authenticated user, with reaction state",
		Tags:        []string{"congratulations"},
	}, handler.GetSentCongratulationsHuma)
}

func RegisterReactToCongratulationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "react-to-congratulation",
		Method:      http.MethodPost,
		Path:        "/v1/user/congratulations/{id}/reaction",
		Summary:     "React to a congratulation",
		Description: "Toggle the receiver's emoji reaction on a congratulation",
		Tags:        []string{"congratulations"},
	}, handler.ReactToCongratulationHuma)
}

// Register all congratulation operations
func RegisterCongratulationOperations(api huma.API, handler *Handler) {
	RegisterSendBeakCongratulationOperation(api, handler)
	RegisterMarkCongratulationsReadOperation(api, handler)
	// Static /sent must be registered before the /{id} routes.
	RegisterGetSentCongratulationsOperation(api, handler)
	RegisterCreateCongratulationOperation(api, handler)
	RegisterGetCongratulationsOperation(api, handler)
	RegisterGetCongratulationOperation(api, handler)
	RegisterUpdateCongratulationOperation(api, handler)
	RegisterDeleteCongratulationOperation(api, handler)
	RegisterReactToCongratulationOperation(api, handler)
}
