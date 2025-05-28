package Waitlist

import (
	"log/slog"
	"strings"

	"github.com/abhikaboy/Kindred/internal/twillio"
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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := xvalidator.Validator.Validate(params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}

	doc := WaitlistDocument{
		Email:     params.Email,
		Name:      params.Name,
		Timestamp: xutils.NowUTC(),
		ID:        primitive.NewObjectID(),
	}

	_, err := h.service.CreateWaitlist(&doc); 
    if err != nil {
		slog.Error("Error creating waitlist", "error", err.Error())
		if strings.Contains(err.Error(), "duplicate key error") {
			slog.Info("Email already exists", "email", doc.Email)
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "Email already exists",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	err = twillio.SendWaitlistEmail(doc.Email, doc.Name)
	if err != nil {
		slog.Error("Error sending waitlist email", "error", err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

func (h *Handler) GetWaitlists(c *fiber.Ctx) error {
	Waitlists, err := h.service.GetAllWaitlists()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(Waitlists)
}

func (h *Handler) GetWaitlist(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	Waitlist, err := h.service.GetWaitlistByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(Waitlist)
}




func (h *Handler) DeleteWaitlist(c *fiber.Ctx) error {

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	if err := h.service.DeleteWaitlist(id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}
