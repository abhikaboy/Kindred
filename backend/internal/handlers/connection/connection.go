package Connection

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateConnectionHuma(ctx context.Context, input *CreateConnectionInput) (*CreateConnectionOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please check your connection request details", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context for authorization
	authenticatedUserID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert receiver ID from string to ObjectID
	receiverID, err := primitive.ObjectIDFromHex(input.Body.ReceiverID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid receiver ID format", err)
	}

	// Convert authenticated user ID to ObjectID
	requesterID, err := primitive.ObjectIDFromHex(authenticatedUserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid authenticated user ID format", err)
	}

	// Create connection request - service will fetch requester details
	connection, err := h.service.CreateConnectionRequest(requesterID, receiverID)
	if err != nil {
		slog.Error("Failed to create connection request", "requesterId", requesterID.Hex(), "receiverId", receiverID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to send connection request. The user may not exist or a request may already be pending.", err)
	}

	return &CreateConnectionOutput{Body: *connection}, nil
}

func (h *Handler) GetConnectionsHuma(ctx context.Context, input *GetConnectionsInput) (*GetConnectionsOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	Connections, err := h.service.GetAllConnections()
	if err != nil {
		slog.Error("Failed to fetch all connections", "error", err)
		return nil, huma.Error500InternalServerError("Unable to load connections. Please try again.", err)
	}

	return &GetConnectionsOutput{Body: Connections}, nil
}

func (h *Handler) GetConnectionHuma(ctx context.Context, input *GetConnectionInput) (*GetConnectionOutput, error) {
	// Extract user_id from context for authorization
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	Connection, err := h.service.GetConnectionByID(id)
	if err != nil {
		slog.Error("Connection not found", "userId", id.Hex(), "error", err)
		return nil, huma.Error404NotFound("Connection not found", err)
	}

	return &GetConnectionOutput{Body: *Connection}, nil
}

func (h *Handler) GetConnectionsByReceiverHuma(ctx context.Context, input *GetConnectionsByReceiverInput) (*GetConnectionsByReceiverOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	connections, err := h.service.GetPendingRequestsByReceiver(id)
	if err != nil {
		slog.Error("Failed to fetch pending connection requests", "userId", id.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load pending connection requests. Please try again.", err)
	}

	return &GetConnectionsByReceiverOutput{Body: connections}, nil
}

func (h *Handler) GetConnectionsByRequesterHuma(ctx context.Context, input *GetConnectionsByRequesterInput) (*GetConnectionsByRequesterOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	connections, err := h.service.GetByRequester(id)
	if err != nil {
		slog.Error("Failed to fetch connections by requester", "requesterId", id.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load sent connection requests. Please try again.", err)
	}

	return &GetConnectionsByRequesterOutput{Body: connections}, nil
}

func (h *Handler) UpdateConnectionHuma(ctx context.Context, input *UpdateConnectionInput) (*UpdateConnectionOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.UpdatePartialConnection(id, input.Body); err != nil {
		slog.Error("Failed to update connection", "connectionId", id.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to update connection. Please try again.", err)
	}

	resp := &UpdateConnectionOutput{}
	resp.Body.Message = "Connection updated successfully"
	return resp, nil
}

func (h *Handler) DeleteConnectionHuma(ctx context.Context, input *DeleteConnectionInput) (*DeleteConnectionOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteConnection(id); err != nil {
		slog.Error("Failed to delete connection", "connectionId", id.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to remove connection. Please try again.", err)
	}

	resp := &DeleteConnectionOutput{}
	resp.Body.Message = "Connection deleted successfully"
	return resp, nil
}

func (h *Handler) AcceptConnectionHuma(ctx context.Context, input *AcceptConnectionInput) (*AcceptConnectionOutput, error) {
	// Extract user_id from context for authorization
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert user_id to ObjectID
	userID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Convert connection ID to ObjectID
	connectionID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid connection ID format", err)
	}

	// Accept the connection request
	if err := h.service.AcceptConnection(connectionID, userID); err != nil {
		slog.Error("Failed to accept connection request", "connectionId", connectionID.Hex(), "userId", userID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to accept connection request. It may have been withdrawn or already accepted.", err)
	}

	resp := &AcceptConnectionOutput{}
	resp.Body.Message = "Connection request accepted successfully"
	return resp, nil
}

func (h *Handler) GetFriendsHuma(ctx context.Context, input *GetFriendsInput) (*GetFriendsOutput, error) {
	// Extract user_id from context for authorization

	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userOID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	friends, err := h.service.GetFriends(userOID)
	if err != nil {
		slog.Error("Failed to fetch friends list", "userId", userOID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load your friends list. Please try again.", err)
	}

	return &GetFriendsOutput{Body: friends}, nil
}

// BlockUserHuma handles blocking a user
func (h *Handler) BlockUserHuma(ctx context.Context, input *BlockUserInput) (*BlockUserOutput, error) {
	// Extract user_id from context (blocker)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	blockerID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	blockedID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid blocked user ID format", err)
	}

	// Cannot block yourself
	if blockerID == blockedID {
		return nil, huma.Error400BadRequest("Cannot block yourself", nil)
	}

	err = h.service.BlockUser(ctx, blockerID, blockedID)
	if err != nil {
		slog.Error("Failed to block user", "blockerId", blockerID.Hex(), "blockedId", blockedID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to block user. Please try again.", err)
	}

	resp := &BlockUserOutput{}
	resp.Body.Message = "User blocked successfully"
	return resp, nil
}

// UnblockUserHuma handles unblocking a user
func (h *Handler) UnblockUserHuma(ctx context.Context, input *UnblockUserInput) (*UnblockUserOutput, error) {
	// Extract user_id from context (blocker)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	blockerID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	blockedID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid blocked user ID format", err)
	}

	err = h.service.UnblockUser(ctx, blockerID, blockedID)
	if err != nil {
		slog.Error("Failed to unblock user", "blockerId", blockerID.Hex(), "blockedId", blockedID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to unblock user. Please try again.", err)
	}

	resp := &UnblockUserOutput{}
	resp.Body.Message = "User unblocked successfully"
	return resp, nil
}

// GetBlockedUsersHuma handles retrieving list of blocked users
func (h *Handler) GetBlockedUsersHuma(ctx context.Context, input *GetBlockedUsersInput) (*GetBlockedUsersOutput, error) {
	// Extract user_id from context
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userOID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	blockedUsers, err := h.service.GetBlockedUsers(ctx, userOID)
	if err != nil {
		slog.Error("Failed to fetch blocked users", "userId", userOID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load blocked users list. Please try again.", err)
	}

	return &GetBlockedUsersOutput{Body: blockedUsers}, nil
}
