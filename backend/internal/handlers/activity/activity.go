package Activity

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) GetActivities(ctx context.Context, input *GetActivitiesInput) (*GetActivitiesOutput, error) {
	activities, err := h.service.GetAllActivitys()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch activities", err)
	}

	return &GetActivitiesOutput{Body: activities}, nil
}

func (h *Handler) GetActivity(ctx context.Context, input *GetActivityInput) (*GetActivityOutput, error) {
	// If year is provided, get activity by ID and filter by year
	if input.Year > 0 {
		id, err := primitive.ObjectIDFromHex(input.ID)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid ID format", err)
		}

		activity, err := h.service.GetActivityByID(id)
		if err != nil {
			return nil, huma.Error404NotFound("Activity not found", err)
		}

		// Filter by year if provided
		if activity.Year != input.Year {
			return nil, huma.Error404NotFound("Activity not found for specified year", err)
		}

		return &GetActivityOutput{Body: *activity}, nil
	}

	// Default behavior - get by ID only
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	activity, err := h.service.GetActivityByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Activity not found", err)
	}

	return &GetActivityOutput{Body: *activity}, nil
}

func (h *Handler) GetActivityByUserAndPeriod(ctx context.Context, input *GetActivityByUserAndPeriodInput) (*GetActivityByUserAndPeriodOutput, error) {
	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	activity, err := h.service.GetActivityByUserAndPeriod(userID, input.Year, input.Month)
	if err != nil {
		return nil, huma.Error404NotFound("Activity not found", err)
	}

	return &GetActivityByUserAndPeriodOutput{Body: *activity}, nil
}

func (h *Handler) GetActivityByUserAndYear(ctx context.Context, input *GetActivityByUserAndYearInput) (*GetActivityByUserAndYearOutput, error) {
	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	activities, err := h.service.GetActivityByUserAndYear(userID, input.Year)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch activities", err)
	}

	return &GetActivityByUserAndYearOutput{Body: activities}, nil
}

func (h *Handler) GetRecentActivity(ctx context.Context, input *GetRecentActivityInput) (*GetRecentActivityOutput, error) {
	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	activities, err := h.service.GetRecentActivity(userID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch recent activity", err)
	}

	// Ensure we always return an empty array instead of null
	if activities == nil {
		activities = []ActivityDocument{}
	}

	return &GetRecentActivityOutput{Body: activities}, nil
}

// Huma-style handlers

func (h *Handler) GetActivitiesHuma(ctx context.Context, input *GetActivitiesInput) (*GetActivitiesOutput, error) {
	activities, err := h.service.GetAllActivitys()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get activities", err)
	}

	resp := &GetActivitiesOutput{Body: activities}
	return resp, nil
}

func (h *Handler) GetActivityHuma(ctx context.Context, input *GetActivityInput) (*GetActivityOutput, error) {
	// If year is provided, get activity by ID and filter by year
	if input.Year > 0 {
		id, err := primitive.ObjectIDFromHex(input.ID)
		if err != nil {
			return nil, huma.Error400BadRequest("Invalid ID format", err)
		}

		activity, err := h.service.GetActivityByID(id)
		if err != nil {
			return nil, huma.Error404NotFound("Activity not found", err)
		}

		// Filter by year if provided
		if activity.Year != input.Year {
			return nil, huma.Error404NotFound("Activity not found for specified year", err)
		}

		resp := &GetActivityOutput{Body: *activity}
		return resp, nil
	}

	// Default behavior - get by ID only
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	activity, err := h.service.GetActivityByID(id)
	if err != nil {
		return nil, huma.Error404NotFound("Activity not found", err)
	}

	resp := &GetActivityOutput{Body: *activity}
	return resp, nil
}

func (h *Handler) GetActivityByUserAndPeriodHuma(ctx context.Context, input *GetActivityByUserAndPeriodInput) (*GetActivityByUserAndPeriodOutput, error) {
	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	activity, err := h.service.GetActivityByUserAndPeriod(userID, input.Year, input.Month)
	if err != nil {
		return nil, huma.Error404NotFound("Activity not found", err)
	}

	resp := &GetActivityByUserAndPeriodOutput{Body: *activity}
	return resp, nil
}

func (h *Handler) GetRecentActivityHuma(ctx context.Context, input *GetRecentActivityInput) (*GetRecentActivityOutput, error) {
	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	activities, err := h.service.GetRecentActivity(userID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch recent activity", err)
	}

	// Ensure we always return an empty array instead of null
	if activities == nil {
		activities = []ActivityDocument{}
	}

	resp := &GetRecentActivityOutput{Body: activities}
	return resp, nil
}
