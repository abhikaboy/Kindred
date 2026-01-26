package Connection

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Input/Output types for connection operations

// Create Connection
type CreateConnectionInput struct {
	Authorization string                 `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                 `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	Body          CreateConnectionParams `json:"body"`
}

type CreateConnectionOutput struct {
	Body ConnectionDocument `json:"body"`
}

// Get Connections (all)
type GetConnectionsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetConnectionsOutput struct {
	Body []ConnectionDocument `json:"body"`
}

// Get Connection by ID
type GetConnectionInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetConnectionOutput struct {
	Body ConnectionDocument `json:"body"`
}

// Get Connections by Receiver
type GetConnectionsByReceiverInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetConnectionsByReceiverOutput struct {
	Body []ConnectionDocument `json:"body"`
}

// Get Connections by Requester
type GetConnectionsByRequesterInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type GetConnectionsByRequesterOutput struct {
	Body []ConnectionDocument `json:"body"`
}

// Update Connection
type UpdateConnectionInput struct {
	Authorization string                   `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string                   `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string                   `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          UpdateConnectionDocument `json:"body"`
}

type UpdateConnectionOutput struct {
	Body struct {
		Message string `json:"message" example:"Connection updated successfully"`
	}
}

// Delete Connection
type DeleteConnectionInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type DeleteConnectionOutput struct {
	Body struct {
		Message string `json:"message" example:"Connection deleted successfully"`
	}
}

// Accept Connection Request
type AcceptConnectionInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type AcceptConnectionOutput struct {
	Body struct {
		Message string `json:"message" example:"Connection request accepted successfully"`
	}
}

// Get Relationship Status
type GetRelationshipInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	UserID        string `path:"user_id" example:"507f1f77bcf86cd799439011"`
}

type GetRelationshipOutput struct {
	Body struct {
		Relationship string `json:"relationship" example:"friends" doc:"Relationship status between users"`
	}
}

// Block User
type BlockUserInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	UserID        string `path:"userId" example:"507f1f77bcf86cd799439011" doc:"User ID to block"`
}

type BlockUserOutput struct {
	Body struct {
		Message string `json:"message" example:"User blocked successfully"`
	}
}

// Unblock User
type UnblockUserInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
	UserID        string `path:"userId" example:"507f1f77bcf86cd799439011" doc:"User ID to unblock"`
}

type UnblockUserOutput struct {
	Body struct {
		Message string `json:"message" example:"User unblocked successfully"`
	}
}

// Get Blocked Users
type GetBlockedUsersInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token for authentication"`
}

type GetBlockedUsersOutput struct {
	Body []ConnectionUser `json:"body"`
}

// Operation registrations

func RegisterCreateConnectionOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-connection",
		Method:      http.MethodPost,
		Path:        "/v1/user/connections",
		Summary:     "Create a new connection",
		Description: "Create a new friend connection request",
		Tags:        []string{"connections"},
	}, handler.CreateConnectionHuma)
}

func RegisterGetConnectionsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-connections",
		Method:      http.MethodGet,
		Path:        "/v1/user/connections",
		Summary:     "Get all connections",
		Description: "Retrieve all connection requests",
		Tags:        []string{"connections"},
	}, handler.GetConnectionsHuma)
}

func RegisterGetConnectionOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-connection",
		Method:      http.MethodGet,
		Path:        "/v1/user/connections/{id}",
		Summary:     "Get connection by ID",
		Description: "Retrieve a specific connection by its ID",
		Tags:        []string{"connections"},
	}, handler.GetConnectionHuma)
}

func RegisterGetConnectionsByReceiverOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-connections-by-receiver",
		Method:      http.MethodGet,
		Path:        "/v1/user/connections/received",
		Summary:     "Get connections by receiver",
		Description: "Get all connections where the authenticated user is the receiver",
		Tags:        []string{"connections"},
	}, handler.GetConnectionsByReceiverHuma)
}

func RegisterGetConnectionsByRequesterOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-connections-by-requester",
		Method:      http.MethodGet,
		Path:        "/v1/user/connections/requested/{id}",
		Summary:     "Get connections by requester",
		Description: "Get all connections where the specified user is the requester",
		Tags:        []string{"connections"},
	}, handler.GetConnectionsByRequesterHuma)
}

func RegisterUpdateConnectionOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-connection",
		Method:      http.MethodPatch,
		Path:        "/v1/user/connections/{id}",
		Summary:     "Update connection",
		Description: "Update a connection request",
		Tags:        []string{"connections"},
	}, handler.UpdateConnectionHuma)
}

func RegisterGetFriendsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-friends",
		Method:      http.MethodGet,
		Path:        "/v1/user/connections/friends",
		Summary:     "Get friends",
		Description: "Get all friends of the authenticated user",
		Tags:        []string{"connections"},
	}, handler.GetFriendsHuma)
}

func RegisterDeleteConnectionOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-connection",
		Method:      http.MethodDelete,
		Path:        "/v1/user/connections/{id}",
		Summary:     "Delete connection",
		Description: "Delete/deny a connection request",
		Tags:        []string{"connections"},
	}, handler.DeleteConnectionHuma)
}

func RegisterAcceptConnectionOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "accept-connection",
		Method:      http.MethodPost,
		Path:        "/v1/user/connections/{id}/accept",
		Summary:     "Accept connection request",
		Description: "Accept a friend connection request",
		Tags:        []string{"connections"},
	}, handler.AcceptConnectionHuma)
}

// RegisterBlockUserOperation registers the block user endpoint
func RegisterBlockUserOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "block-user",
		Method:      http.MethodPost,
		Path:        "/v1/user/connections/block/{userId}",
		Summary:     "Block a user",
		Description: "Block a user to prevent them from seeing your content and interacting with you",
		Tags:        []string{"connections"},
	}, handler.BlockUserHuma)
}

// RegisterUnblockUserOperation registers the unblock user endpoint
func RegisterUnblockUserOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "unblock-user",
		Method:      http.MethodDelete,
		Path:        "/v1/user/connections/block/{userId}",
		Summary:     "Unblock a user",
		Description: "Unblock a previously blocked user",
		Tags:        []string{"connections"},
	}, handler.UnblockUserHuma)
}

// RegisterGetBlockedUsersOperation registers the get blocked users endpoint
func RegisterGetBlockedUsersOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-blocked-users",
		Method:      http.MethodGet,
		Path:        "/v1/user/connections/blocked",
		Summary:     "Get blocked users",
		Description: "Retrieve list of users you have blocked",
		Tags:        []string{"connections"},
	}, handler.GetBlockedUsersHuma)
}

// Register all connection operations
func RegisterConnectionOperations(api huma.API, handler *Handler) {
	RegisterGetFriendsOperation(api, handler)
	RegisterCreateConnectionOperation(api, handler)
	RegisterGetConnectionsByReceiverOperation(api, handler)
	RegisterGetConnectionsByRequesterOperation(api, handler)
	RegisterGetConnectionsOperation(api, handler)
	RegisterGetConnectionOperation(api, handler)
	RegisterUpdateConnectionOperation(api, handler)
	RegisterDeleteConnectionOperation(api, handler)
	RegisterAcceptConnectionOperation(api, handler)
	RegisterBlockUserOperation(api, handler)
	RegisterUnblockUserOperation(api, handler)
	RegisterGetBlockedUsersOperation(api, handler)
}
