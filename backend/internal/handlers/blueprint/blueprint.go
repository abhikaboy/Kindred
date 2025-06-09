package Blueprint

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateBlueprint(c *fiber.Ctx) error {
	var params CreateBlueprintParams
	if err := c.BodyParser(&params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
	}

	validate := validator.New()
	if err := validate.Struct(params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
	}

	ownerid, err := primitive.ObjectIDFromHex(c.UserContext().Value("user_id").(string))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid user ID",
			"message": err.Error(),
		})
	}

	doc := BlueprintDocument{
		ID:               primitive.NewObjectID(),
		Banner:           params.Banner,
		Name:             params.Name,
		Tags:             params.Tags,
		Description:      params.Description,
		Duration:         params.Duration,
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        time.Now(),
		Owner: &types.UserExtendedReference{
			ID:             ownerid,
			DisplayName:    "",
			Handle:         "",
			ProfilePicture: "",
		},
	}

	Blueprint, err := h.service.CreateBlueprint(&doc)
	
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to create blueprint",
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(Blueprint)
}

func (h *Handler) GetBlueprints(c *fiber.Ctx) error {
	Blueprints, err := h.service.GetAllBlueprints()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get blueprints",
			"message": err.Error(),
		})
	}

	return c.JSON(Blueprints)
}

func (h *Handler) GetBlueprint(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid ID format",
			"message": err.Error(),
		})
	}

	Blueprint, err := h.service.GetBlueprintByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "Blueprint not found",
			"message": err.Error(),
		})
	}

	return c.JSON(Blueprint)
}

func (h *Handler) UpdatePartialBlueprint(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid ID format",
			"message": err.Error(),
		})
	}

	var update UpdateBlueprintDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
	}

	if err := h.service.UpdatePartialBlueprint(id, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to update blueprint",
			"message": err.Error(),
		})
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) DeleteBlueprint(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid ID format",
			"message": err.Error(),
		})
	}

	if err := h.service.DeleteBlueprint(id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to delete blueprint",
			"message": err.Error(),
		})
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) SubscribeToBlueprint(c *fiber.Ctx) error {
	blueprintID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid blueprint ID",
			"message": err.Error(),
		})
	}
	userID, err := primitive.ObjectIDFromHex(c.UserContext().Value("user_id").(string))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid user ID",
			"message": err.Error(),
		})
	}
	err = h.service.SubscribeToBlueprint(blueprintID, userID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":   "Already subscribed or blueprint not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to subscribe",
			"message": err.Error(),
		})
	}
	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) UnsubscribeFromBlueprint(c *fiber.Ctx) error {
	blueprintID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid blueprint ID",
			"message": err.Error(),
		})
	}
	userID, err := primitive.ObjectIDFromHex(c.UserContext().Value("user_id").(string))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid user ID",
			"message": err.Error(),
		})
	}
	err = h.service.UnsubscribeFromBlueprint(blueprintID, userID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":   "Not subscribed or blueprint not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to unsubscribe",
			"message": err.Error(),
		})
	}
	return c.SendStatus(fiber.StatusOK)
}
