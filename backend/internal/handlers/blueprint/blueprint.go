package Blueprint

import (
	"context"
	"fmt"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateBlueprintHuma(ctx context.Context, input *CreateBlueprintInput) (*CreateBlueprintOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	ownerid, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	// Create internal document for database operations
	internalDoc := BlueprintDocumentInternal{
		ID:               primitive.NewObjectID(),
		Banner:           input.Body.Banner,
		Name:             input.Body.Name,
		Tags:             input.Body.Tags,
		Description:      input.Body.Description,
		Duration:         input.Body.Duration,
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        time.Now(),
		Owner: &types.UserExtendedReferenceInternal{
			ID:             ownerid,
			DisplayName:    "",
			Handle:         "",
			ProfilePicture: "",
		},
	}

	blueprint, err := h.service.CreateBlueprint(&internalDoc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create blueprint", err)
	}

	return &CreateBlueprintOutput{Body: *blueprint}, nil
}

func (h *Handler) GetBlueprintsHuma(ctx context.Context, input *GetBlueprintsInput) (*GetBlueprintsOutput, error) {
	blueprints, err := h.service.GetAllBlueprints()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get blueprints", err)
	}

	return &GetBlueprintsOutput{Body: blueprints}, nil
}

func (h *Handler) GetBlueprintHuma(ctx context.Context, input *GetBlueprintInput) (*GetBlueprintOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	blueprint, err := h.service.GetBlueprintByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Blueprint not found", err)
	}

	return &GetBlueprintOutput{Body: *blueprint}, nil
}

func (h *Handler) UpdateBlueprintHuma(ctx context.Context, input *UpdateBlueprintInput) (*UpdateBlueprintOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.UpdatePartialBlueprint(id, input.Body); err != nil {
		return nil, huma.Error500InternalServerError("Failed to update blueprint", err)
	}

	resp := &UpdateBlueprintOutput{}
	resp.Body.Message = "Blueprint updated successfully"
	return resp, nil
}

func (h *Handler) DeleteBlueprintHuma(ctx context.Context, input *DeleteBlueprintInput) (*DeleteBlueprintOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteBlueprint(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete blueprint", err)
	}

	resp := &DeleteBlueprintOutput{}
	resp.Body.Message = "Blueprint deleted successfully"
	return resp, nil
}

func (h *Handler) SubscribeToBlueprintHuma(ctx context.Context, input *SubscribeToBlueprintInput) (*SubscribeToBlueprintOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	blueprintID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid blueprint ID", err)
	}

	userID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	err = h.service.SubscribeToBlueprint(blueprintID, userID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, huma.Error400BadRequest("Already subscribed or blueprint not found", err)
		}
		return nil, huma.Error500InternalServerError("Failed to subscribe", err)
	}

	resp := &SubscribeToBlueprintOutput{}
	resp.Body.Message = "Subscribed to blueprint successfully"
	return resp, nil
}

func (h *Handler) UnsubscribeFromBlueprintHuma(ctx context.Context, input *UnsubscribeFromBlueprintInput) (*UnsubscribeFromBlueprintOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	blueprintID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid blueprint ID", err)
	}

	userID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	err = h.service.UnsubscribeFromBlueprint(blueprintID, userID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, huma.Error400BadRequest("Not subscribed or blueprint not found", err)
		}
		return nil, huma.Error500InternalServerError("Failed to unsubscribe", err)
	}

	resp := &UnsubscribeFromBlueprintOutput{}
	resp.Body.Message = "Unsubscribed from blueprint successfully"
	return resp, nil
}

func (h *Handler) SearchBlueprintsHuma(ctx context.Context, input *SearchBlueprintsInput) (*SearchBlueprintsOutput, error) {
	blueprints, err := h.service.SearchBlueprints(input.Query)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to search blueprints", err)
	}
	return &SearchBlueprintsOutput{Body: blueprints}, nil
}