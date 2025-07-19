package encouragement

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Operation registrations

func RegisterCreateEncouragementOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-encouragement",
		Method:      http.MethodPost,
		Path:        "/v1/user/encouragements",
		Summary:     "Create a new encouragement",
		Description: "Create a new encouragement message for another user",
		Tags:        []string{"encouragements"},
	}, handler.CreateEncouragementHuma)
}

func RegisterGetEncouragementsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-encouragements",
		Method:      http.MethodGet,
		Path:        "/v1/user/encouragements",
		Summary:     "Get encouragements",
		Description: "Retrieve all encouragements received by the authenticated user",
		Tags:        []string{"encouragements"},
	}, handler.GetEncouragementsHuma)
}

func RegisterGetEncouragementOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-encouragement",
		Method:      http.MethodGet,
		Path:        "/v1/user/encouragements/{id}",
		Summary:     "Get encouragement by ID",
		Description: "Retrieve a specific encouragement by its ID",
		Tags:        []string{"encouragements"},
	}, handler.GetEncouragementHuma)
}

func RegisterUpdateEncouragementOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-encouragement",
		Method:      http.MethodPatch,
		Path:        "/v1/user/encouragements/{id}",
		Summary:     "Update encouragement",
		Description: "Update an encouragement message",
		Tags:        []string{"encouragements"},
	}, handler.UpdateEncouragementHuma)
}

func RegisterDeleteEncouragementOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-encouragement",
		Method:      http.MethodDelete,
		Path:        "/v1/user/encouragements/{id}",
		Summary:     "Delete encouragement",
		Description: "Delete an encouragement message",
		Tags:        []string{"encouragements"},
	}, handler.DeleteEncouragementHuma)
}

func RegisterMarkEncouragementsReadOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "mark-encouragements-read",
		Method:      http.MethodPatch,
		Path:        "/v1/user/encouragements/mark-read",
		Summary:     "Mark encouragements as read",
		Description: "Mark multiple encouragements as read",
		Tags:        []string{"encouragements"},
	}, handler.MarkEncouragementsReadHuma)
}

// Register all encouragement operations
func RegisterEncouragementOperations(api huma.API, handler *Handler) {
	RegisterCreateEncouragementOperation(api, handler)
	RegisterGetEncouragementsOperation(api, handler)
	RegisterGetEncouragementOperation(api, handler)
	RegisterUpdateEncouragementOperation(api, handler)
	RegisterDeleteEncouragementOperation(api, handler)
	RegisterMarkEncouragementsReadOperation(api, handler)
} 