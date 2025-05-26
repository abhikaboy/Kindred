package Connection

import (
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	service *Service
}

func (h *Handler) CreateConnection(c *fiber.Ctx) error {
	var params CreateConnectionParams
	if err := c.BodyParser(&params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	validate := validator.New()
	if err := validate.Struct(params); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(err)
	}

	// convert reciever to a ObjectID
	// err, ids := xutils.ParseIDs(c, params.Reciever, params.Requester.ID.Hex())
	// if err != nil {
	// return c.Status(fiber.StatusBadRequest).JSON(err)
	// }

	doc := ConnectionDocument{
		ID:        primitive.NewObjectID(),
		Requester: params.Requester,
		Reciever:  params.Reciever,
		Timestamp: xutils.NowUTC(),
	}

	_, err := h.service.CreateConnection(&doc)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

func (h *Handler) GetConnections(c *fiber.Ctx) error {
	Connections, err := h.service.GetAllConnections()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.JSON(Connections)
}

func (h *Handler) GetConnection(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	Connection, err := h.service.GetConnectionByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(Connection)
}
func (h *Handler) GetByReciever(c *fiber.Ctx) error {
	// check if theres anything in user context
	var id primitive.ObjectID
	if c.Context().Value("user") != nil {
		id = c.Context().Value("user").(primitive.ObjectID)
	} else {
		var err error
		id, err = primitive.ObjectIDFromHex(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid ID format",
			})
		}
	}

	connections, err := h.service.GetByReciever(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(connections)
}
func (h *Handler) GetByRequester(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	connections, err := h.service.GetByRequester(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(err)
	}

	return c.JSON(connections)
}

func (h *Handler) UpdatePartialConnection(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	var update UpdateConnectionDocument
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.service.UpdatePartialConnection(id, update); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) DeleteConnection(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid ID format",
		})
	}

	if err := h.service.DeleteConnection(id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	return c.SendStatus(fiber.StatusOK)
}
