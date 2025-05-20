package Profile

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
    apiV1 := app.Group("/v1")

    // Add Sample group under API Version 1
		Profiles := apiV1.Group("/Profiles")
		Profiles.Get("/search", handler.SearchProfiles)
		Profiles.Get("/:id", handler.GetProfile)
		Profiles.Patch("/:id", handler.UpdatePartialProfile)
		Profiles.Delete("/:id", handler.DeleteProfile)
		Profiles.Get("/email/:email", handler.GetProfileByEmail)
		Profiles.Get("/phone/:phone", handler.GetProfileByPhone)
		Profiles.Get("/", handler.GetProfiles)


}