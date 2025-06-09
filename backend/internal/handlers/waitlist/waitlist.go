package Waitlist

import (
	"log/slog"
	"strings"

	"github.com/abhikaboy/Kindred/internal/twillio"
	"github.com/abhikaboy/Kindred/internal/xerr"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateWaitlist(c *fiber.Ctx) error {
	var params CreateWaitlistParams
	if err := c.BodyParser(&params); err != nil {
		return xerr.ValidationError(c, "Invalid request body format", map[string]string{
			"body": "Could not parse JSON body",
		})
	}

	if validationErrors := xvalidator.Validator.Validate(params); len(validationErrors) > 0 {
		// Convert validation errors to a map
		errorMap := make(map[string]string)
		for _, fieldErr := range validationErrors {
			errorMap[fieldErr.FailedField] = fieldErr.Tag
		}

		return xerr.ValidationError(c, "Invalid input data", errorMap)
	}

	doc := WaitlistDocument{
		Email:     params.Email,
		Name:      params.Name,
		Timestamp: xutils.NowUTC(),
		ID:        primitive.NewObjectID(),
	}

	_, err := h.service.CreateWaitlist(&doc)
	if err != nil {
		slog.LogAttrs(
			c.Context(),
			slog.LevelError,
			"Error creating waitlist entry",
			xslog.Error(err),
			slog.String("email", doc.Email),
		)

		if strings.Contains(err.Error(), "duplicate key error") {
			slog.LogAttrs(
				c.Context(),
				slog.LevelInfo,
				"Email already exists in waitlist",
				slog.String("email", doc.Email),
			)
			return xerr.DuplicateError(c, "Waitlist entry", "email", doc.Email)
		}

		return xerr.ServerError(c, err)
	}

	err = twillio.SendWaitlistEmail(doc.Email, doc.Name)
	if err != nil {
		slog.LogAttrs(
			c.Context(),
			slog.LevelError,
			"Error sending waitlist email",
			xslog.Error(err),
			slog.String("email", doc.Email),
		)
		// We continue since the user was added to the waitlist successfully
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

func (h *Handler) GetWaitlists(c *fiber.Ctx) error {
	waitlists, err := h.service.GetAllWaitlists()
	if err != nil {
		return xerr.ServerError(c, err)
	}

	return c.JSON(waitlists)
}

func (h *Handler) GetWaitlist(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		return xerr.ValidationError(c, "Invalid ID format", map[string]string{
			"id": "Must be a valid ObjectID",
		})
	}

	waitlist, err := h.service.GetWaitlistByID(id)
	if err != nil {
		if strings.Contains(err.Error(), "no documents") {
			return xerr.ResourceNotFound(c, "Waitlist entry", idParam)
		}
		return xerr.ServerError(c, err)
	}

	return c.JSON(waitlist)
}

func (h *Handler) DeleteWaitlist(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := primitive.ObjectIDFromHex(idParam)

	if err != nil {
		return xerr.ValidationError(c, "Invalid ID format", map[string]string{
			"id": "Must be a valid ObjectID",
		})
	}

	if err := h.service.DeleteWaitlist(id); err != nil {
		if strings.Contains(err.Error(), "no documents") {
			return xerr.ResourceNotFound(c, "Waitlist entry", idParam)
		}
		return xerr.ServerError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Waitlist entry deleted successfully",
	})
}
