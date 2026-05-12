package Blueprint

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	service       *Service
	geminiService any // Gemini service interface - using any to avoid circular import
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
		Category:         input.Body.Category,
		Categories:       input.Body.Categories,
		Owner: &types.UserExtendedReferenceInternal{
			ID:             ownerid,
			DisplayName:    "",
			Handle:         "",
			ProfilePicture: "",
		},
	}

	blueprint, err := h.service.CreateBlueprint(&internalDoc)
	if err != nil {
		slog.Error("failed to create blueprint", "userId", user_id, "error", err)
		return nil, huma.Error500InternalServerError("Unable to create blueprint. Please try again.", err)
	}

	return &CreateBlueprintOutput{Body: *blueprint}, nil
}

func (h *Handler) GetBlueprintsHuma(ctx context.Context, input *GetBlueprintsInput) (*GetBlueprintsOutput, error) {
	blueprints, err := h.service.GetAllBlueprints()
	if err != nil {
		slog.Error("failed to get blueprints", "error", err)
		return nil, huma.Error500InternalServerError("Unable to retrieve blueprints. Please try again.", err)
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
		slog.Error("failed to update blueprint", "blueprintId", input.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to update blueprint. Please try again.", err)
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
		slog.Error("failed to delete blueprint", "blueprintId", input.ID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to delete blueprint. Please try again.", err)
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
		slog.Error("failed to subscribe to blueprint", "blueprintId", input.ID, "userId", user_id, "error", err)
		return nil, huma.Error500InternalServerError("Unable to subscribe to blueprint. Please try again.", err)
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
		slog.Error("failed to unsubscribe from blueprint", "blueprintId", input.ID, "userId", user_id, "error", err)
		return nil, huma.Error500InternalServerError("Unable to unsubscribe from blueprint. Please try again.", err)
	}

	resp := &UnsubscribeFromBlueprintOutput{}
	resp.Body.Message = "Unsubscribed from blueprint successfully"
	return resp, nil
}

func (h *Handler) SearchBlueprintsHuma(ctx context.Context, input *SearchBlueprintsInput) (*SearchBlueprintsOutput, error) {
	blueprints, err := h.service.SearchBlueprints(input.Query)
	if err != nil {
		slog.Error("failed to search blueprints", "query", input.Query, "error", err)
		return nil, huma.Error500InternalServerError("Unable to search blueprints. Please try again.", err)
	}
	return &SearchBlueprintsOutput{Body: blueprints}, nil
}

func (h *Handler) AutocompleteBlueprintsHuma(ctx context.Context, input *AutocompleteBlueprintsInput) (*AutocompleteBlueprintsOutput, error) {
	// Require minimum query length for autocomplete
	if len(input.Query) < 2 {
		return &AutocompleteBlueprintsOutput{Body: []BlueprintDocument{}}, nil
	}

	blueprints, err := h.service.AutocompleteBlueprints(input.Query)
	if err != nil {
		slog.Error("failed to autocomplete blueprints", "query", input.Query, "error", err)
		return nil, huma.Error500InternalServerError("Unable to autocomplete blueprints. Please try again.", err)
	}
	return &AutocompleteBlueprintsOutput{Body: blueprints}, nil
}

func (h *Handler) GetUserSubscribedBlueprintsHuma(ctx context.Context, input *GetUserSubscribedBlueprintsInput) (*GetUserSubscribedBlueprintsOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	blueprints, err := h.service.GetUserSubscribedBlueprints(userID)
	if err != nil {
		slog.Error("failed to get subscribed blueprints", "userId", user_id, "error", err)
		return nil, huma.Error500InternalServerError("Unable to retrieve subscribed blueprints. Please try again.", err)
	}

	return &GetUserSubscribedBlueprintsOutput{Body: blueprints}, nil
}

func (h *Handler) GetBlueprintsByCreatorHuma(ctx context.Context, input *GetBlueprintsByCreatorInput) (*GetBlueprintsByCreatorOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	creatorID, err := primitive.ObjectIDFromHex(input.CreatorID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid creator ID format", err)
	}

	blueprints, err := h.service.GetBlueprintsByCreator(creatorID)
	if err != nil {
		slog.Error("failed to get blueprints by creator", "creatorId", input.CreatorID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to retrieve blueprints by creator. Please try again.", err)
	}

	return &GetBlueprintsByCreatorOutput{Body: blueprints}, nil
}

func (h *Handler) GetBlueprintByCategoryHuma(ctx context.Context, input *GetBlueprintByCategoryInput) (*GetBlueprintByCategoryOutput, error) {
	blueprintGroups, err := h.service.GetBlueprintByCategory()
	if err != nil {
		slog.Error("failed to get blueprints by category", "error", err)
		return nil, huma.Error500InternalServerError("Unable to retrieve blueprints by category. Please try again.", err)
	}

	return &GetBlueprintByCategoryOutput{Body: blueprintGroups}, nil
}

func (h *Handler) GenerateAndCreateBlueprintHuma(ctx context.Context, input *GenerateAndCreateBlueprintInput) (*GenerateAndCreateBlueprintOutput, error) {
	// Validate input
	if input.Body.Description == "" {
		return nil, huma.Error400BadRequest("Description field is required", nil)
	}

	// Extract and validate user ID
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	// Consume credit for AI generation
	err = types.ConsumeCredit(ctx, h.service.Users, userObjID, types.CreditTypeNaturalLanguage)
	if err != nil {
		if err == types.ErrInsufficientCredits {
			return nil, huma.Error403Forbidden("Insufficient credits. You need at least 1 AI credit to generate a blueprint.", err)
		}
		slog.Error("failed to process credit for blueprint generation", "userId", userID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to process credit. Please try again.", err)
	}

	// Call Genkit flow to generate blueprint
	generatedBlueprint, err := h.callGeminiGenerateBlueprintFlow(ctx, userID, input.Body.Description)
	if err != nil {
		slog.Error("failed to generate blueprint with AI", "userId", userID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to generate blueprint with AI. Please try again.", err)
	}

	// Create internal document for database operations
	internalDoc := BlueprintDocumentInternal{
		ID:               primitive.NewObjectID(),
		Banner:           generatedBlueprint.Banner,
		Name:             generatedBlueprint.Name,
		Tags:             generatedBlueprint.Tags,
		Description:      generatedBlueprint.Description,
		Duration:         generatedBlueprint.Duration,
		Category:         generatedBlueprint.Category,
		Categories:       generatedBlueprint.Categories,
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        time.Now(),
		Owner: &types.UserExtendedReferenceInternal{
			ID:             userObjID,
			DisplayName:    "",
			Handle:         "",
			ProfilePicture: "",
		},
	}

	// Save blueprint to database
	blueprint, err := h.service.CreateBlueprint(&internalDoc)
	if err != nil {
		slog.Error("failed to save generated blueprint", "userId", userID, "error", err)
		return nil, huma.Error500InternalServerError("Unable to save generated blueprint. Please try again.", err)
	}

	return &GenerateAndCreateBlueprintOutput{Body: *blueprint}, nil
}
