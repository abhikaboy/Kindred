package Waitlist

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
	Waitlists := apiV1.Group("/Waitlist")

	Waitlists.Post("/", handler.CreateWaitlist)

	ProtectedWaitlist := apiV1.Group("/user/Waitlist")
	ProtectedWaitlist.Get("/", handler.GetWaitlists)
	ProtectedWaitlist.Get("/:id", handler.GetWaitlist)
	ProtectedWaitlist.Delete("/:id", handler.DeleteWaitlist)

}
