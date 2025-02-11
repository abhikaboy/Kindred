package chat

import (
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateChat(c *fiber.Ctx) error {
	var params CreateChatParams
	if err := c.BodyParser(&params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	validate := validator.New()
	if err := validate.Struct(params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Validation failed",
		})
	}

	doc := ChatDocument{
		ID:        primitive.NewObjectID(),
		Field1:    params.Field1,
		Field2:    params.Field2,
		Picture:   params.Picture,
		Timestamp: time.Now(),
	}

	_, err := h.service.CreateChat(&doc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create Chat",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

func (h *Handler) GetChats(c *fiber.Ctx) error {
	Chats, err := h.service.GetAllChats()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch Chats",
		})
	}

	return c.JSON(Chats)
}

func (h *Handler) GetChat(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	Chat, err := h.service.GetChatByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Chat not found",
		})
	}

	return c.JSON(Chat)
}

func (h *Handler) UpdatePartialChat(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	var update UpdateChatDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.UpdatePartialChat(id, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update Chat",
		})
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) DeleteChat(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	if err := h.service.DeleteChat(id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete Chat",
		})
	}

	return c.SendStatus(fiber.StatusOK)
}
