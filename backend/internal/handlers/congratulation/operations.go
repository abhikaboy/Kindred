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

// Register all congratulation operations
func RegisterCongratulationOperations(api huma.API, handler *Handler) {
	RegisterMarkCongratulationsReadOperation(api, handler)
	RegisterCreateCongratulationOperation(api, handler)
	RegisterGetCongratulationsOperation(api, handler)
	RegisterGetCongratulationOperation(api, handler)
	RegisterUpdateCongratulationOperation(api, handler)
	RegisterDeleteCongratulationOperation(api, handler)
}
