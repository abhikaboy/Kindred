package Waitlist

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for waitlist operations

// Create Waitlist
type CreateWaitlistInput struct {
	Body CreateWaitlistParams `json:"body"`
}

type CreateWaitlistOutput struct {
	Body WaitlistDocument `json:"body"`
}

// Get Waitlists (all)
type GetWaitlistsInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetWaitlistsOutput struct {
	Body []WaitlistDocument `json:"body"`
}

// Get Waitlist by ID
type GetWaitlistInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetWaitlistOutput struct {
	Body WaitlistDocument `json:"body"`
}

// Delete Waitlist
type DeleteWaitlistInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteWaitlistOutput struct {
	Body struct {
		Status  string `json:"status" example:"success"`
		Message string `json:"message" example:"Waitlist entry deleted successfully"`
	}
}

// Operation registrations

func RegisterCreateWaitlistOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-waitlist",
		Method:      http.MethodPost,
		Path:        "/v1/waitlist",
		Summary:     "Create a new waitlist entry",
		Description: "Add a new email to the waitlist",
		Tags:        []string{"waitlist"},
	}, handler.CreateWaitlistHuma)
}

func RegisterGetWaitlistsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-waitlists",
		Method:      http.MethodGet,
		Path:        "/v1/user/waitlist",
		Summary:     "Get all waitlist entries",
		Description: "Retrieve all waitlist entries (admin only)",
		Tags:        []string{"waitlist"},
	}, handler.GetWaitlistsHuma)
}

func RegisterGetWaitlistOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-waitlist",
		Method:      http.MethodGet,
		Path:        "/v1/user/waitlist/{id}",
		Summary:     "Get waitlist entry by ID",
		Description: "Retrieve a specific waitlist entry by its ID",
		Tags:        []string{"waitlist"},
	}, handler.GetWaitlistHuma)
}

func RegisterDeleteWaitlistOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-waitlist",
		Method:      http.MethodDelete,
		Path:        "/v1/user/waitlist/{id}",
		Summary:     "Delete waitlist entry",
		Description: "Remove a waitlist entry by its ID",
		Tags:        []string{"waitlist"},
	}, handler.DeleteWaitlistHuma)
}

// Register all waitlist operations
func RegisterWaitlistOperations(api huma.API, handler *Handler) {
	RegisterCreateWaitlistOperation(api, handler)
	RegisterGetWaitlistsOperation(api, handler)
	RegisterGetWaitlistOperation(api, handler)
	RegisterDeleteWaitlistOperation(api, handler)
} 