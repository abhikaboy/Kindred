package congratulation

import (
	"context"
	"fmt"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateCongratulationHuma(ctx context.Context, input *CreateCongratulationInput) (*CreateCongratulationOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	senderID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid sender ID", err)
	}

	receiverID, err := primitive.ObjectIDFromHex(input.Body.Receiver)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid receiver ID format", err)
	}

	// Get sender information from the users collection
	senderInfo, err := h.service.GetSenderInfo(senderID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get sender information", err)
	}

	// Create internal document for database operations
	internalDoc := CongratulationDocumentInternal{
		ID:           primitive.NewObjectID(),
		Sender:       *senderInfo,
		Receiver:     receiverID,
		Message:      input.Body.Message,
		CategoryName: input.Body.CategoryName,
		TaskName:     input.Body.TaskName,
		Read:         false,
	}

	congratulation, err := h.service.CreateCongratulation(&internalDoc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create congratulation", err)
	}

	return &CreateCongratulationOutput{Body: *congratulation}, nil
}

func (h *Handler) GetCongratulationsHuma(ctx context.Context, input *GetCongratulationsInput) (*GetCongratulationsOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	receiverID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	congratulations, err := h.service.GetAllCongratulations(receiverID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get congratulations", err)
	}

	return &GetCongratulationsOutput{Body: congratulations}, nil
}

func (h *Handler) GetCongratulationHuma(ctx context.Context, input *GetCongratulationInput) (*GetCongratulationOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	congratulation, err := h.service.GetCongratulationByID(id)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, huma.Error404NotFound("Congratulation not found", err)
		}
		return nil, huma.Error500InternalServerError("Failed to get congratulation", err)
	}

	return &GetCongratulationOutput{Body: *congratulation}, nil
}

func (h *Handler) UpdateCongratulationHuma(ctx context.Context, input *UpdateCongratulationInput) (*UpdateCongratulationOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.UpdatePartialCongratulation(id, input.Body); err != nil {
		return nil, huma.Error500InternalServerError("Failed to update congratulation", err)
	}

	resp := &UpdateCongratulationOutput{}
	resp.Body.Message = "Congratulation updated successfully"
	return resp, nil
}

func (h *Handler) DeleteCongratulationHuma(ctx context.Context, input *DeleteCongratulationInput) (*DeleteCongratulationOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteCongratulation(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete congratulation", err)
	}

	resp := &DeleteCongratulationOutput{}
	resp.Body.Message = "Congratulation deleted successfully"
	return resp, nil
}

func (h *Handler) MarkCongratulationsReadHuma(ctx context.Context, input *MarkCongratulationsReadInput) (*MarkCongratulationsReadOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	if len(input.ID) == 0 {
		return nil, huma.Error400BadRequest("No IDs provided", fmt.Errorf("id array cannot be empty"))
	}

	// Convert string IDs to ObjectIDs
	objectIDs := make([]primitive.ObjectID, len(input.ID))
	for i, idStr := range input.ID {
		id, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid ID format", fmt.Errorf("invalid ID at index %d: %s", i, idStr))
		}
		objectIDs[i] = id
	}

	count, err := h.service.MarkCongratulationsAsRead(objectIDs)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to mark congratulations as read", err)
	}

	resp := &MarkCongratulationsReadOutput{}
	resp.Body.Message = "Congratulations marked as read successfully"
	resp.Body.Count = int(count)
	return resp, nil
} 