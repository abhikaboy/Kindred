package sample

import (
	"errors"
	"log/slog"

	"time"

	"github.com/abhikaboy/GERM-template/internal/xerr"
	"github.com/abhikaboy/GERM-template/internal/xvalidator"
	go_json "github.com/goccy/go-json"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Handler to execute business logic for Sample Endpoint
*/
type Handler struct {
	service *Service
}

// Create a Sample
func (h *Handler) CreateSample(c *fiber.Ctx) error {
	ctx := c.Context()
	var sample SampleDocument
	var params CreateSampleParams

	slog.LogAttrs(ctx, slog.LevelInfo, "Inserting Sample")
	// validate body
	err := c.BodyParser(&params)
	if err != nil {
		return err
	}
	errs := xvalidator.Validator.Validate(params)
	if len(errs) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(errs)
	}

	// do some validations on the inputs
	sample = SampleDocument{
		Field1:    params.Field1,
		Field2:    params.Field2,
		Location:  params.Location,
		Picture:   params.Picture,
		Timestamp: time.Now(),
		ID:        primitive.NewObjectID(),
	}

	result, err := h.service.InsertSample(sample)

	if err != nil {
		sErr := err.(mongo.WriteException) // Convert to Command Error
		if sErr.HasErrorCode(121) {        // Indicates that the document failed validation
			return xerr.WriteException(c, sErr) // Handle the error by returning a 121 and the error message
		}
	}

	return c.JSON(result)
}

// Get all Samples
func (h *Handler) GetSamples(c *fiber.Ctx) error {
	Samples, err := h.service.GetAllSamples()

	if err != nil {
		// Central error handler take 500
		return err
	}
	return c.JSON(Samples)
}

// Get a single Sample
func (h *Handler) GetSample(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
	}

	Sample, err := h.service.GetSampleByID(id)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return c.Status(fiber.StatusNotFound).JSON(xerr.NotFound("Sample", "id", id.Hex()))
		}
		// Central error handler take 500
		return err
	}
	return c.JSON(Sample)
}

// Update specific fields of a Sample (PATCH)
func (h *Handler) UpdatePartialSample(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {

		return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
	}

	var partialUpdate UpdateSampleDocument
	if err := go_json.Unmarshal(c.Body(), &partialUpdate); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
	}

	err = h.service.UpdatePartialSample(id, partialUpdate)
	if err != nil {
		// Central error handler take 500
		return err
	}

	return c.SendStatus(fiber.StatusOK)
}

// Delete a Sample
func (h *Handler) DeleteSample(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {

		return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
	}

	if err := h.service.DeleteSample(id); err != nil {
		// Central error handler take 500
		return err
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) GetNearbySamples(c *fiber.Ctx) error {
	var params GetNearbySamplesParams

	err := c.BodyParser(&params)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
	}

	// service call
	samples, err := h.service.GetNearbySamples(params.Location, params.Radius)
	if err != nil {
		// Central error handler take 500
		return err
	}

	err = c.JSON(samples)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.ErrorHandler(c, err))
	}

	return c.JSON(samples)
}
