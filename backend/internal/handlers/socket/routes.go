package socket

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/

func Routes(app *fiber.App, collections map[string]*mongo.Collection, stream *mongo.ChangeStream) {
	service := newService(collections)
	handler := Handler{service}

	// waitGroup.Wait()

	app.Post("/ws/broadcast", handler.BroadcastRequest)

	app.Get("/ws/:type/:id", handler.JoinRoom)
	app.Delete("/ws/:type/:id", handler.LeaveRoom)
}
