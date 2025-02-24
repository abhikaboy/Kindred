package Connection

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
	Connections := apiV1.Group("/Connections")

	// Get all Friend Requests
	Connections.Get("/", handler.GetConnections)
	Connections.Get("/:id", handler.GetConnection)
	Connections.Patch("/:id", handler.UpdatePartialConnection)

	// Deny a request
	Connections.Delete("/:id", handler.DeleteConnection)
	// Get all Friend Requests by Reciever
	Connections.Get("/requester/:id", handler.GetByRequester)
	// Get all Friend Requests by Requester
	Connections.Get("/reciever/", handler.GetByReciever)
	Connections.Get("/reciever/:id", handler.GetByReciever)
	// Friend Request
	Connections.Post("/", handler.CreateConnection)

}
