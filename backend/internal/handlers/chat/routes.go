
package Chat
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
    Chats := apiV1.Group("/Chats")

    Chats.Post("/", handler.CreateChat)
    Chats.Get("/", handler.GetChats)
    Chats.Get("/:id", handler.GetChat)
    Chats.Patch("/:id", handler.UpdatePartialChat)
    Chats.Delete("/:id", handler.DeleteChat)


}