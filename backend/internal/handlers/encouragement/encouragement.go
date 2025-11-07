package encouragement

import (
	"context"
	"fmt"
	"strings"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateEncouragementHuma(ctx context.Context, input *CreateEncouragementInput) (*CreateEncouragementOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Default scope to "task" if not provided
	scope := input.Body.Scope
	if scope == "" {
		scope = "task"
	}

	// Custom validation based on scope
	if scope == "task" {
		if input.Body.TaskID == "" {
			return nil, huma.Error400BadRequest("TaskID is required for task scope", nil)
		}
		if input.Body.TaskName == "" {
			return nil, huma.Error400BadRequest("TaskName is required for task scope", nil)
		}
		if input.Body.CategoryName == "" {
			return nil, huma.Error400BadRequest("CategoryName is required for task scope", nil)
		}
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

	// Handle TaskID based on scope
	var taskID primitive.ObjectID
	if scope == "task" {
		taskID, err = primitive.ObjectIDFromHex(input.Body.TaskID)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid task ID format", err)
		}
	}
	// For profile scope, taskID remains as zero value

	// Get sender information from the users collection
	senderInfo, err := h.service.GetSenderInfo(senderID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get sender information", err)
	}

	// Default type to "message" if not provided
	encouragementType := input.Body.Type
	if encouragementType == "" {
		encouragementType = "message"
	}

	// Create internal document for database operations
	internalDoc := EncouragementDocumentInternal{
		ID:           primitive.NewObjectID(),
		Sender:       *senderInfo,
		Receiver:     receiverID,
		Message:      input.Body.Message,
		Scope:        scope,
		CategoryName: input.Body.CategoryName,
		TaskName:     input.Body.TaskName,
		TaskID:       taskID,
		Read:         false,
		Type:         encouragementType,
	}

	encouragement, err := h.service.CreateEncouragement(&internalDoc)
	if err != nil {
		// Check if error is related to insufficient balance
		if strings.Contains(err.Error(), "insufficient encouragement balance") {
			return nil, huma.Error400BadRequest("Insufficient encouragement balance", err)
		}
		return nil, huma.Error500InternalServerError("Failed to create encouragement", err)
	}

	return &CreateEncouragementOutput{Body: *encouragement}, nil
}

func (h *Handler) GetEncouragementsHuma(ctx context.Context, input *GetEncouragementsInput) (*GetEncouragementsOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	receiverID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	encouragements, err := h.service.GetAllEncouragements(receiverID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get encouragements", err)
	}

	return &GetEncouragementsOutput{Body: encouragements}, nil
}

func (h *Handler) GetEncouragementHuma(ctx context.Context, input *GetEncouragementInput) (*GetEncouragementOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	encouragement, err := h.service.GetEncouragementByID(id)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, huma.Error404NotFound("Encouragement not found", err)
		}
		return nil, huma.Error500InternalServerError("Failed to get encouragement", err)
	}

	return &GetEncouragementOutput{Body: *encouragement}, nil
}

func (h *Handler) UpdateEncouragementHuma(ctx context.Context, input *UpdateEncouragementInput) (*UpdateEncouragementOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.UpdatePartialEncouragement(id, input.Body); err != nil {
		return nil, huma.Error500InternalServerError("Failed to update encouragement", err)
	}

	resp := &UpdateEncouragementOutput{}
	resp.Body.Message = "Encouragement updated successfully"
	return resp, nil
}

func (h *Handler) DeleteEncouragementHuma(ctx context.Context, input *DeleteEncouragementInput) (*DeleteEncouragementOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteEncouragement(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete encouragement", err)
	}

	resp := &DeleteEncouragementOutput{}
	resp.Body.Message = "Encouragement deleted successfully"
	return resp, nil
}

func (h *Handler) MarkEncouragementsReadHuma(ctx context.Context, input *MarkEncouragementsReadInput) (*MarkEncouragementsReadOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Add explicit validation
	errs := xvalidator.Validator.Validate(input)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	if len(input.Body.ID) == 0 {
		return nil, huma.Error400BadRequest("No IDs provided", fmt.Errorf("id array cannot be empty"))
	}

	// Convert string IDs to ObjectIDs
	objectIDs := make([]primitive.ObjectID, len(input.Body.ID))
	for i, idStr := range input.Body.ID {
		id, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid ID format", fmt.Errorf("invalid ID at index %d: %s", i, idStr))
		}
		objectIDs[i] = id
	}

	count, err := h.service.MarkEncouragementsAsRead(objectIDs)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to mark encouragements as read", err)
	}

	resp := &MarkEncouragementsReadOutput{}
	resp.Body.Message = "Encouragements marked as read successfully"
	resp.Body.Count = int(count)
	return resp, nil
}
