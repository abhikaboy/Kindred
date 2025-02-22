package task

import (
	"strconv"
	"time"

	"github.com/abhikaboy/SocialToDo/internal/xvalidator"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var validator = xvalidator.Validator
type Handler struct {
	service *Service
}

func (h *Handler) GetTasksByUser(c *fiber.Ctx) error {
	userId, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	var sort SortParams

	if c.Query("sortBy") == "" {
		sort.SortBy = "timestamp"
	} else{
		sort.SortBy = c.Query("sortBy")
	}
	
	if c.Query("sortDir") == "" {
		sort.SortDir = -1
	} else {
		sort.SortDir, err = strconv.Atoi(c.Query("sortDir"))
	}


	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid sortDir format",
		})
	}

	if sort.SortBy == "none" {
		sort.SortBy = "timestamp"
	}
	if sort.SortDir == 0 {
		sort.SortDir = -1
	}

  sortAggregation := bson.D{
		{Key: "$sort", Value: bson.M{
			sort.SortBy: sort.SortDir,
		}},
	}

	Tasks, err := h.service.GetTasksByUser(userId, sortAggregation)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(Tasks)
}

func (h *Handler) CreateTask(c *fiber.Ctx) error {
	var params CreateTaskParams

	categoryId, err := primitive.ObjectIDFromHex(c.Params("category"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	userId, err := primitive.ObjectIDFromHex(c.Params("user"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	if err := c.BodyParser(&params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := validator.Validate(params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}

	doc := TaskDocument{
		ID:        primitive.NewObjectID(),
		Priority:  params.Priority,
		Content:   params.Content,
		Value:     params.Value,
		Recurring: params.Recurring,
		RecurDetails: params.RecurDetails,
		Public:    params.Public,
		Active:    params.Active,
		Timestamp: time.Now(),
	}

	_, err = h.service.CreateTask(userId, categoryId, &doc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
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

func (h *Handler) UpdateTask(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	userId, err := primitive.ObjectIDFromHex(c.Params("user"))
	categoryId, err := primitive.ObjectIDFromHex(c.Params("category"))
	
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

	if _, err := h.service.UpdatePartialTask(userId, id, categoryId, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
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
