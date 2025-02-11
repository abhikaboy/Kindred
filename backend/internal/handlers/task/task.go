package task

import (
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateTask(c *fiber.Ctx) error {
	var params CreateTaskParams
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

	doc := TaskDocument{
		ID:        primitive.NewObjectID(),
		Field1:    params.Field1,
		Field2:    params.Field2,
		Picture:   params.Picture,
		Timestamp: time.Now(),
	}

	_, err := h.service.CreateTask(&doc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create Task",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

func (h *Handler) GetTasks(c *fiber.Ctx) error {
	Tasks, err := h.service.GetAllTasks()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch Tasks",
		})
	}

	return c.JSON(Tasks)
}

func (h *Handler) GetTask(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	Task, err := h.service.GetTaskByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Task not found",
		})
	}

	return c.JSON(Task)
}

func (h *Handler) UpdatePartialTask(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	var update UpdateTaskDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.UpdatePartialTask(id, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update Task",
		})
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) DeleteTask(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	if err := h.service.DeleteTask(id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete Task",
		})
	}

	return c.SendStatus(fiber.StatusOK)
}
