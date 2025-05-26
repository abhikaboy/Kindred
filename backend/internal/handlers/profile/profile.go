package Profile

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) GetProfiles(c *fiber.Ctx) error {
	Profiles, err := h.service.GetAllProfiles()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(Profiles)
}

func (h *Handler) GetProfile(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	Profile, err := h.service.GetProfileByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(Profile)
}

func (h *Handler) UpdatePartialProfile(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	var update UpdateProfileDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.UpdatePartialProfile(id, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) DeleteProfile(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	if err := h.service.DeleteProfile(id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) GetProfileByEmail(c *fiber.Ctx) error {
	email := c.Params("email")
	Profile, err := h.service.GetProfileByEmail(email)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(Profile)
}

func (h *Handler) GetProfileByPhone(c *fiber.Ctx) error {
	phone := c.Params("phone")
	Profile, err := h.service.GetProfileByPhone(phone)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(Profile)
}

func (h *Handler) SearchProfiles(c *fiber.Ctx) error {
	query := c.Query("query", "")
	var Profiles []ProfileDocument
	var err error
	if query == "" {
		Profiles, err = h.service.GetAllProfiles()
	} else {
		Profiles, err = h.service.SearchProfiles(query)
	}
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(Profiles)
}
