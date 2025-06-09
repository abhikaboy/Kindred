package Blueprint

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

    Blueprints := apiV1.Group("/blueprints")

    Blueprints.Get("/", handler.GetBlueprints)
    Blueprints.Get("/:id", handler.GetBlueprint)

    
    Blueprints = apiV1.Group("/users/blueprints")
    
    Blueprints.Patch("/:id/subscribe", handler.SubscribeToBlueprint)
    Blueprints.Patch("/:id/unsubscribe", handler.UnsubscribeFromBlueprint)
    Blueprints.Post("/", handler.CreateBlueprint)
    Blueprints.Patch("/:id", handler.UpdatePartialBlueprint)
    Blueprints.Delete("/:id", handler.DeleteBlueprint)

}
