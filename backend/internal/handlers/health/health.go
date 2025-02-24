package health

import (
	"github.com/gofiber/fiber/v2"
)

/*
Handler to execute business logic for Health Endpoint
*/
type Handler struct {
	service *Service
}

func (h *Handler) GetHealth(c *fiber.Ctx) error {
	return c.SendStatus(fiber.StatusOK)
}
