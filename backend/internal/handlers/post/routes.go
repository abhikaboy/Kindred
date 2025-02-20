package Post

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
	Posts := apiV1.Group("/Posts")

	Posts.Post("/", handler.CreatePost)
	Posts.Get("/", handler.GetPosts)
	Posts.Get("/:id", handler.GetPost)
	Posts.Patch("/:id", handler.UpdatePartialPost)
	Posts.Delete("/:id", handler.DeletePost)

}
