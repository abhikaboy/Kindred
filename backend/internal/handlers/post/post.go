package Post

import (
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreatePost(c *fiber.Ctx) error {
	var params CreatePostParams
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

	doc := PostDocument{
		ID:        primitive.NewObjectID(),
		Field1:    params.Field1,
		Field2:    params.Field2,
		Picture:   params.Picture,
		Timestamp: xutils.NowUTC(),
	}

	_, err := h.service.CreatePost(&doc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create Post",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

func (h *Handler) GetPosts(c *fiber.Ctx) error {
	Posts, err := h.service.GetAllPosts()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch Posts",
		})
	}

	return c.JSON(Posts)
}

func (h *Handler) GetPost(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	Post, err := h.service.GetPostByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Post not found",
		})
	}

	return c.JSON(Post)
}

func (h *Handler) UpdatePartialPost(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	var update UpdatePostDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.UpdatePartialPost(id, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update Post",
		})
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) DeletePost(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	if err := h.service.DeletePost(id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete Post",
		})
	}

	return c.SendStatus(fiber.StatusOK)
}
