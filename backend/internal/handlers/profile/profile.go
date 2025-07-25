package Profile

import (
	"context"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) GetProfiles(ctx context.Context, input *GetProfilesInput) (*GetProfilesOutput, error) {
	profiles, err := h.service.GetAllProfiles()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get profiles", err)
	}

	return &GetProfilesOutput{Body: profiles}, nil
}

func (h *Handler) GetProfile(ctx context.Context, input *GetProfileInput) (*GetProfileOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	profile, err := h.service.GetProfileByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Profile not found", err)
	}

	return &GetProfileOutput{Body: *profile}, nil
}

func (h *Handler) UpdatePartialProfile(ctx context.Context, input *UpdateProfileInput) (*UpdateProfileOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.UpdatePartialProfile(id, input.Body); err != nil {
		return nil, huma.Error500InternalServerError("Failed to update profile", err)
	}

	resp := &UpdateProfileOutput{}
	resp.Body.Message = "Profile updated successfully"
	return resp, nil
}

func (h *Handler) DeleteProfile(ctx context.Context, input *DeleteProfileInput) (*DeleteProfileOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteProfile(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete profile", err)
	}

	resp := &DeleteProfileOutput{}
	resp.Body.Message = "Profile deleted successfully"
	return resp, nil
}

func (h *Handler) GetProfileByEmail(ctx context.Context, input *GetProfileByEmailInput) (*GetProfileByEmailOutput, error) {
	profile, err := h.service.GetProfileByEmail(input.Email)
	if err != nil {
		return nil, huma.Error404NotFound("Profile not found", err)
	}

	return &GetProfileByEmailOutput{Body: *profile}, nil
}

func (h *Handler) GetProfileByPhone(ctx context.Context, input *GetProfileByPhoneInput) (*GetProfileByPhoneOutput, error) {
	profile, err := h.service.GetProfileByPhone(input.Phone)
	if err != nil {
		return nil, huma.Error404NotFound("Profile not found", err)
	}

	return &GetProfileByPhoneOutput{Body: *profile}, nil
}

func (h *Handler) SearchProfiles(ctx context.Context, input *SearchProfilesInput) (*SearchProfilesOutput, error) {
	var profiles []ProfileDocument
	var err error

	if input.Query == "" {
		profiles, err = h.service.GetAllProfiles()
	} else {
		profiles, err = h.service.SearchProfiles(input.Query)
	}

	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to search profiles", err)
	}

	return &SearchProfilesOutput{Body: profiles}, nil
}

// Huma-style handlers

func (h *Handler) GetProfilesHuma(ctx context.Context, input *GetProfilesInput) (*GetProfilesOutput, error) {
	profiles, err := h.service.GetAllProfiles()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get profiles", err)
	}

	resp := &GetProfilesOutput{Body: profiles}
	return resp, nil
}

func (h *Handler) GetProfileHuma(ctx context.Context, input *GetProfileInput) (*GetProfileOutput, error) {
	// Extract user_id from context for authorization
	authenticatedUserID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	profile, err := h.service.GetProfileByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Profile not found", err)
	}

	// Convert authenticated user ID to ObjectID
	authUserID, err := primitive.ObjectIDFromHex(authenticatedUserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid authenticated user ID", err)
	}

	// Check relationship between authenticated user and profile being viewed
	relationship, err := h.service.CheckRelationship(authUserID, id)
	if err != nil {
		// Log the error but don't fail the request - relationship info is optional
		// You might want to add proper logging here
		relationship = &RelationshipInfo{
			Status: RelationshipNone,
		}
	}

	// Add relationship information to the profile
	profile.Relationship = relationship

	resp := &GetProfileOutput{Body: *profile}
	return resp, nil
}

func (h *Handler) UpdateProfileHuma(ctx context.Context, input *UpdateProfileInput) (*UpdateProfileOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.UpdatePartialProfile(id, input.Body); err != nil {
		return nil, huma.Error500InternalServerError("Failed to update profile", err)
	}

	resp := &UpdateProfileOutput{}
	resp.Body.Message = "Profile updated successfully"
	return resp, nil
}

func (h *Handler) DeleteProfileHuma(ctx context.Context, input *DeleteProfileInput) (*DeleteProfileOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteProfile(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete profile", err)
	}

	resp := &DeleteProfileOutput{}
	resp.Body.Message = "Profile deleted successfully"
	return resp, nil
}

func (h *Handler) GetProfileByEmailHuma(ctx context.Context, input *GetProfileByEmailInput) (*GetProfileByEmailOutput, error) {
	profile, err := h.service.GetProfileByEmail(input.Email)
	if err != nil {
		return nil, huma.Error404NotFound("Profile not found", err)
	}

	resp := &GetProfileByEmailOutput{Body: *profile}
	return resp, nil
}

func (h *Handler) GetProfileByPhoneHuma(ctx context.Context, input *GetProfileByPhoneInput) (*GetProfileByPhoneOutput, error) {
	profile, err := h.service.GetProfileByPhone(input.Phone)
	if err != nil {
		return nil, huma.Error404NotFound("Profile not found", err)
	}

	resp := &GetProfileByPhoneOutput{Body: *profile}
	return resp, nil
}

func (h *Handler) SearchProfilesHuma(ctx context.Context, input *SearchProfilesInput) (*SearchProfilesOutput, error) {
	// Extract user_id from context for authorization
	authenticatedUserID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert authenticated user ID to ObjectID
	authUserID, err := primitive.ObjectIDFromHex(authenticatedUserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid authenticated user ID", err)
	}

	var profiles []ProfileDocument
	if input.Query == "" {
		profiles, err = h.service.GetAllProfiles()
	} else {
		profiles, err = h.service.SearchProfiles(input.Query)
	}

	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to search profiles", err)
	}

	// Add relationship information to each profile
	for i := range profiles {
		relationship, err := h.service.CheckRelationship(authUserID, profiles[i].ID)
		if err != nil {
			// Log the error but don't fail the request - relationship info is optional
			relationship = &RelationshipInfo{
				Status: RelationshipNone,
			}
		}
		profiles[i].Relationship = relationship
	}

	resp := &SearchProfilesOutput{Body: profiles}
	return resp, nil
}

// Note: Profile picture upload functionality moved to centralized upload service
// Use /v1/uploads/profile/{id}/url and /v1/uploads/profile/{id}/confirm instead
