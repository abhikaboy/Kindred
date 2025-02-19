package Category

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
    Categories := apiV1.Group("/Categories")

    Categories.Post("/", handler.CreateCategory)
    Categories.Get("/", handler.GetCategories)
    Categories.Get("/:id", handler.GetCategory)
    Categories.Patch("/:id", handler.UpdatePartialCategory)
    Categories.Delete("/:id", handler.DeleteCategory)


}