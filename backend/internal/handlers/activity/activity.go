package Activity

import (
	"context"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
	"github.com/go-playground/validator/v10"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateActivity(ctx context.Context, input *CreateActivityInput) (*CreateActivityOutput, error) {
	validate := validator.New()
	if err := validate.Struct(input.Body); err != nil {
		return nil, huma.Error400BadRequest("Validation failed", err)
	}

	doc := types.ActivityDocument{
		ID:        primitive.NewObjectID(),
		Field1:    input.Body.Field1,
		Picture:   input.Body.Picture,
		Timestamp: xutils.NowUTC(),
	}

	_, err := h.service.CreateActivity(&doc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create Activity", err)
	}

	return &CreateActivityOutput{Body: doc}, nil
}

func (h *Handler) GetActivities(ctx context.Context, input *GetActivitiesInput) (*GetActivitiesOutput, error) {
	activities, err := h.service.GetAllActivitys()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch activities", err)
	}

	return &GetActivitiesOutput{Body: activities}, nil
}

func (h *Handler) GetActivity(ctx context.Context, input *GetActivityInput) (*GetActivityOutput, error) {
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

func (h *Handler) UpdatePartialActivity(ctx context.Context, input *UpdateActivityInput) (*UpdateActivityOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.UpdatePartialActivity(id, input.Body); err != nil {
		return nil, huma.Error500InternalServerError("Failed to update Activity", err)
	}

	resp := &UpdateActivityOutput{}
	resp.Body.Message = "Activity updated successfully"
	return resp, nil
}

func (h *Handler) DeleteActivity(ctx context.Context, input *DeleteActivityInput) (*DeleteActivityOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteActivity(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete Activity", err)
	}

	resp := &DeleteActivityOutput{}
	resp.Body.Message = "Activity deleted successfully"
	return resp, nil
}

// Huma-style handlers

func (h *Handler) CreateActivityHuma(ctx context.Context, input *CreateActivityInput) (*CreateActivityOutput, error) {
	validate := validator.New()
	if err := validate.Struct(input.Body); err != nil {
		return nil, huma.Error400BadRequest("Validation failed", err)
	}

	doc := types.ActivityDocument{
		ID:        primitive.NewObjectID(),
		Field1:    input.Body.Field1,
		Picture:   input.Body.Picture,
		Timestamp: xutils.NowUTC(),
	}

	_, err := h.service.CreateActivity(&doc)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to create activity", err)
	}

	resp := &CreateActivityOutput{Body: doc}
	return resp, nil
}

func (h *Handler) GetActivitiesHuma(ctx context.Context, input *GetActivitiesInput) (*GetActivitiesOutput, error) {
	activities, err := h.service.GetAllActivitys()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get activities", err)
	}

	resp := &GetActivitiesOutput{Body: activities}
	return resp, nil
}

func (h *Handler) GetActivityHuma(ctx context.Context, input *GetActivityInput) (*GetActivityOutput, error) {
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

func (h *Handler) UpdateActivityHuma(ctx context.Context, input *UpdateActivityInput) (*UpdateActivityOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.UpdatePartialActivity(id, input.Body); err != nil {
		return nil, huma.Error500InternalServerError("Failed to update activity", err)
	}

	resp := &UpdateActivityOutput{}
	resp.Body.Message = "Activity updated successfully"
	return resp, nil
}

func (h *Handler) DeleteActivityHuma(ctx context.Context, input *DeleteActivityInput) (*DeleteActivityOutput, error) {
	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteActivity(id); err != nil {
		return nil, huma.Error500InternalServerError("Failed to delete activity", err)
	}

	resp := &DeleteActivityOutput{}
	resp.Body.Message = "Activity deleted successfully"
	return resp, nil
}
