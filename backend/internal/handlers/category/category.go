package Category

import (
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/abhikaboy/Kindred/xutils"
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
		ID:            primitive.NewObjectID(),
		Name:          params.Name,
		WorkspaceName: params.WorkspaceName,
		User:          userId,
		Tasks:         make([]task.TaskDocument, 0),
		LastEdited:    xutils.NowUTC(),
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
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "No categories found",
			"message": err.Error(),
		})
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

	results, err := h.service.UpdatePartialCategory(id, update)
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

	user_id := c.UserContext().Value("user_id").(primitive.ObjectID)

	if err := h.service.DeleteCategory(user_id, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) DeleteWorkspace(c *fiber.Ctx) error {

	workspaceName := c.Params("name")
	userId := c.UserContext().Value("user_id").(string)
	user_id, err := primitive.ObjectIDFromHex(userId)

	slog.Info("Deleting " + workspaceName)

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format for UserId",
		})
	}

	err = h.service.DeleteWorkspace(workspaceName, user_id)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)

	// TODO: check user id
}
