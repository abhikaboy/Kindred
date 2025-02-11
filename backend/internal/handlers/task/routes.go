package task

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
	Tasks := apiV1.Group("/Tasks")

	Tasks.Post("/", handler.CreateTask)
	Tasks.Get("/", handler.GetTasks)
	Tasks.Get("/:id", handler.GetTask)
	Tasks.Patch("/:id", handler.UpdatePartialTask)
	Tasks.Delete("/:id", handler.DeleteTask)

}
