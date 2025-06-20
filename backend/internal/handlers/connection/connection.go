package Connection

import (
	"context"
	"fmt"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/abhikaboy/Kindred/xutils"
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
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	doc := ConnectionDocument{
		ID:        primitive.NewObjectID(),
		Requester: input.Body.Requester,
		Reciever:  input.Body.Reciever,
		Timestamp: xutils.NowUTC(),
	}

	_, err = h.service.CreateConnection(&doc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create connection", err)
	}

	return &CreateConnectionOutput{Body: doc}, nil
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
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
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

	connections, err := h.service.GetByReciever(id)
	if err != nil {
		return nil, huma.Error404NotFound("No connections found", err)
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
		return nil, huma.Error404NotFound("No connections found", err)
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
