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
	apiV1 := app.Group("/v1")

	// Add Sample group under API Version 1
	Categories := apiV1.Group("/Categories")

	Categories.Post("/", handler.CreateCategory)
	Categories.Get("/", handler.GetCategories)

	ProtectedCategories := app.Group("/v1/user/categories")

	ProtectedCategories.Post("/", handler.CreateCategory)
	ProtectedCategories.Delete("/:id", handler.DeleteCategory)
	ProtectedCategories.Patch("/:id", handler.UpdatePartialCategory)
	ProtectedCategories.Get("/:id", handler.GetCategoriesByUser)
	ProtectedCategories.Delete("/workspace/:name", handler.DeleteWorkspace)
	
}
