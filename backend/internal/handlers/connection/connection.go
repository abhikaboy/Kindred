package Connection

import (
	"context"
	"fmt"

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
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
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
		return nil, huma.Error500InternalServerError("Failed to create connection", err)
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
		return nil, huma.Error500InternalServerError("Failed to get connections", err)
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
		return nil, huma.Error400BadRequest("Invalid ID", err)
	}

	Connection, err := h.service.GetConnectionByID(id)
	if err != nil {
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
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	connections, err := h.service.GetPendingRequestsByReceiver(id)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get connections", err)
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
		return nil, huma.Error500InternalServerError("Failed to get connections", err)
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
		return nil, huma.Error500InternalServerError("Failed to update connection", err)
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
		return nil, huma.Error500InternalServerError("Failed to delete connection", err)
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
		return nil, huma.Error500InternalServerError("Failed to accept connection", err)
	}

	resp := &AcceptConnectionOutput{}
	resp.Body.Message = "Connection request accepted successfully"
	return resp, nil
}
