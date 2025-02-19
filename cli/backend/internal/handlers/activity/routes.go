
package Activity
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
    Activitys := apiV1.Group("/Activitys")

    Activitys.Post("/", handler.CreateActivity)
    Activitys.Get("/", handler.GetActivitys)
    Activitys.Get("/:id", handler.GetActivity)
    Activitys.Patch("/:id", handler.UpdatePartialActivity)
    Activitys.Delete("/:id", handler.DeleteActivity)


}