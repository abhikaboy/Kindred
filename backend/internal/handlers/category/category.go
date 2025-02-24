package Category

import (
	"time"

	"github.com/abhikaboy/SocialToDo/internal/handlers/task"
	"github.com/abhikaboy/SocialToDo/xutils"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateCategory(c *fiber.Ctx) error {
	var params CreateCategoryParams
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

	user_id := c.UserContext().Value("user_id").(string)

	err, ids := xutils.ParseIDs(c, user_id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}
	userId := ids[0]

	doc := CategoryDocument{
		ID:         primitive.NewObjectID(),
		Name:       params.Name,
		User:       userId,
		Tasks:      make([]task.TaskDocument, 0),
		LastEdited: time.Now(),
	}

	_, err = h.service.CreateCategory(&doc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create Category",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

func (h *Handler) GetCategories(c *fiber.Ctx) error {
	Categories, err := h.service.GetAllCategories()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(Categories)
}

func (h *Handler) GetCategory(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	Category, err := h.service.GetCategoryByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(Category)
}

func (h *Handler) GetCategoriesByUser(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	categories, err := h.service.GetCategoriesByUser(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(categories)
}

func (h *Handler) UpdatePartialCategory(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format for CategoryId",
		})
	}
	user_id, err := primitive.ObjectIDFromHex(c.Params("user"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format for UserId",
		})
	}

	var update UpdateCategoryDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	results, err := h.service.UpdatePartialCategory(user_id, id, update)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(results)
}

func (h *Handler) DeleteCategory(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	user_id, err := primitive.ObjectIDFromHex(c.Params("user"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format for UserId",
		})
	}

	if err := h.service.DeleteCategory(user_id, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}
