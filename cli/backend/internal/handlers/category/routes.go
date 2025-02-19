
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
    Categorys := apiV1.Group("/Categorys")

    Categorys.Post("/", handler.CreateCategory)
    Categorys.Get("/", handler.GetCategorys)
    Categorys.Get("/:id", handler.GetCategory)
    Categorys.Patch("/:id", handler.UpdatePartialCategory)
    Categorys.Delete("/:id", handler.DeleteCategory)


}