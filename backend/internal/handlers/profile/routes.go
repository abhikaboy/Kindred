package profile

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
	Profiles := apiV1.Group("/Profiles")

	Profiles.Post("/", handler.CreateProfile)
	Profiles.Get("/", handler.GetProfiles)
	Profiles.Get("/:id", handler.GetProfile)
	Profiles.Patch("/:id", handler.UpdatePartialProfile)
	Profiles.Delete("/:id", handler.DeleteProfile)

}
