package sample

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(app *fiber.App, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := Handler{service}

	// Add a group for API versioning
	apiV1 := app.Group("/api/v1")

	// Add Sample group under API Version 1
	Sample := apiV1.Group("/samples")

	Sample.Post("/", handler.CreateSample)
	Sample.Get("/", handler.GetSamples)
	Sample.Post("/nearby", handler.GetNearbySamples)
	Sample.Get("/:id", handler.GetSample)
	Sample.Patch("/:id", handler.UpdatePartialSample)
	Sample.Delete("/:id", handler.DeleteSample)

}
