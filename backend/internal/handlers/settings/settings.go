package settings

import (
	"context"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GetUserSettingsHuma retrieves the authenticated user's settings
func (h *Handler) GetUserSettingsHuma(ctx context.Context, input *GetUserSettingsInput) (*GetUserSettingsOutput, error) {
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	settings, err := h.service.GetUserSettings(userObjID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get settings", err)
	}

	return &GetUserSettingsOutput{Body: *settings}, nil
}

// UpdateUserSettingsHuma updates the authenticated user's settings
func (h *Handler) UpdateUserSettingsHuma(ctx context.Context, input *UpdateUserSettingsInput) (*UpdateUserSettingsOutput, error) {
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	err = h.service.UpdateUserSettings(userObjID, input.Body)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to update settings", err)
	}

	return &UpdateUserSettingsOutput{
		Body: struct {
			Message string `json:"message" example:"Settings updated successfully"`
		}{
			Message: "Settings updated successfully",
		},
	}, nil
}
