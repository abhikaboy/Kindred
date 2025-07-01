package Waitlist

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/twillio"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateWaitlistHuma(ctx context.Context, input *CreateWaitlistInput) (*CreateWaitlistOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	internalDoc := WaitlistDocumentInternal{
		Email:     input.Body.Email,
		Name:      input.Body.Name,
		Timestamp: xutils.NowUTC(),
		ID:        primitive.NewObjectID(),
	}

	waitlist, err := h.service.CreateWaitlist(&internalDoc)
	if err != nil {
		slog.LogAttrs(
			ctx,
			slog.LevelError,
			"Error creating waitlist entry",
			slog.String("error", err.Error()),
			slog.String("email", internalDoc.Email),
		)

		if strings.Contains(err.Error(), "duplicate key error") {
			slog.LogAttrs(
				ctx,
				slog.LevelInfo,
				"Email already exists in waitlist",
				slog.String("email", internalDoc.Email),
			)
			return nil, huma.Error409Conflict("Duplicate email", fmt.Errorf("email %s already exists in waitlist", internalDoc.Email))
		}

		return nil, huma.Error500InternalServerError("Failed to create waitlist entry", err)
	}

	err = twillio.SendWaitlistEmail(internalDoc.Email, internalDoc.Name)
	if err != nil {
		slog.LogAttrs(
			ctx,
			slog.LevelError,
			"Error sending waitlist email",
			slog.String("error", err.Error()),
			slog.String("email", internalDoc.Email),
		)
		// We continue since the user was added to the waitlist successfully
	}

	return &CreateWaitlistOutput{Body: *waitlist}, nil
}

func (h *Handler) GetWaitlistsHuma(ctx context.Context, input *GetWaitlistsInput) (*GetWaitlistsOutput, error) {
	// Extract user_id from context for authorization (admin check could be added here)
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	waitlists, err := h.service.GetAllWaitlists()
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to fetch waitlists", err)
	}

	return &GetWaitlistsOutput{Body: waitlists}, nil
}

func (h *Handler) GetWaitlistHuma(ctx context.Context, input *GetWaitlistInput) (*GetWaitlistOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	waitlist, err := h.service.GetWaitlistByID(id)
	if err != nil {
		if strings.Contains(err.Error(), "no documents") {
			return nil, huma.Error404NotFound("Waitlist entry not found", err)
		}
		return nil, huma.Error500InternalServerError("Failed to fetch waitlist entry", err)
	}

	return &GetWaitlistOutput{Body: *waitlist}, nil
}

func (h *Handler) DeleteWaitlistHuma(ctx context.Context, input *DeleteWaitlistInput) (*DeleteWaitlistOutput, error) {
	// Extract user_id from context for authorization
	_, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	id, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid ID format", err)
	}

	if err := h.service.DeleteWaitlist(id); err != nil {
		if strings.Contains(err.Error(), "no documents") {
			return nil, huma.Error404NotFound("Waitlist entry not found", err)
		}
		return nil, huma.Error500InternalServerError("Failed to delete waitlist entry", err)
	}

	resp := &DeleteWaitlistOutput{}
	resp.Body.Status = "success"
	resp.Body.Message = "Waitlist entry deleted successfully"
	return resp, nil
}
