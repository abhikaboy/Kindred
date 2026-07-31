package settings

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// UpdatePersonalizationHuma enables, disables or pauses personalization
func (h *Handler) UpdatePersonalizationHuma(ctx context.Context, input *UpdatePersonalizationInput) (*UpdatePersonalizationOutput, error) {
	userObjID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := h.service.UpdatePersonalization(userObjID, input.Body)
	if err != nil {
		slog.Error("Failed to update personalization settings", "userId", userObjID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to update your personalization settings. Please try again.", err)
	}

	return &UpdatePersonalizationOutput{Body: *settings}, nil
}

// ExportPersonalizationHuma returns everything held about the authenticated user
func (h *Handler) ExportPersonalizationHuma(ctx context.Context, input *ExportPersonalizationInput) (*ExportPersonalizationOutput, error) {
	userObjID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	facts, consent, err := h.service.ExportPersonalizationData(userObjID)
	if err != nil {
		slog.Error("Failed to export personalization data", "userId", userObjID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to export your personalization data. Please try again.", err)
	}

	return &ExportPersonalizationOutput{
		Body: ExportPersonalizationResponse{
			UserID:   userObjID.Hex(),
			Count:    len(facts),
			Settings: *consent,
			Facts:    facts,
		},
	}, nil
}

// DeletePersonalizationHuma erases everything held about the user and turns
// personalization off, so the next nightly run does not rebuild it
func (h *Handler) DeletePersonalizationHuma(ctx context.Context, input *DeletePersonalizationInput) (*DeletePersonalizationOutput, error) {
	userObjID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	deleted, err := h.service.DeletePersonalizationData(userObjID)
	if err != nil {
		slog.Error("Failed to delete personalization data", "userId", userObjID.Hex(), "error", err)
		return nil, huma.Error500InternalServerError("Unable to delete your personalization data. Please try again.", err)
	}

	resp := &DeletePersonalizationOutput{}
	resp.Body.Message = "Personalization data deleted"
	resp.Body.DeletedCount = deleted
	resp.Body.Enabled = false
	return resp, nil
}

// SaveStatedPreferencesHuma persists the onboarding answers as stated facts
func (h *Handler) SaveStatedPreferencesHuma(ctx context.Context, input *SaveStatedPreferencesInput) (*SaveStatedPreferencesOutput, error) {
	userObjID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	keys, err := h.service.SaveStatedPreferences(userObjID, input.Body, SurfaceOnboarding)
	if err != nil {
		slog.Error("Failed to save stated preferences", "userId", userObjID.Hex(), "error", err)
		return nil, huma.Error400BadRequest("Unable to save your preferences.", err)
	}

	resp := &SaveStatedPreferencesOutput{}
	resp.Body.Message = "Preferences saved"
	resp.Body.Keys = keys
	return resp, nil
}

// UpdateStatedFactHuma corrects a single stated answer from the settings screen
func (h *Handler) UpdateStatedFactHuma(ctx context.Context, input *UpdateStatedFactInput) (*UpdateStatedFactOutput, error) {
	userObjID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	if err := h.service.UpdateStatedFact(userObjID, input.Key, input.Body.Value, SurfaceSettings); err != nil {
		slog.Error("Failed to update stated preference", "userId", userObjID.Hex(), "key", input.Key, "error", err)
		return nil, huma.Error400BadRequest("Unable to update that preference.", err)
	}

	resp := &UpdateStatedFactOutput{}
	resp.Body.Message = "Preference updated"
	resp.Body.Key = input.Key
	resp.Body.Value = input.Body.Value
	return resp, nil
}

// requireUserID resolves the authenticated caller to an ObjectID.
func requireUserID(ctx context.Context) (primitive.ObjectID, error) {
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return primitive.NilObjectID, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return primitive.NilObjectID, huma.Error400BadRequest("Invalid user ID", err)
	}

	return userObjID, nil
}
