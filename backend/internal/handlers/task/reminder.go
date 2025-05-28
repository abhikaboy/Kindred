package task

import (
	"github.com/gofiber/fiber/v2"
)

func (h *Handler) HandleReminder(c *fiber.Ctx) error {
	reminders, err := h.service.GetTasksWithPastReminders()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(reminders)
}