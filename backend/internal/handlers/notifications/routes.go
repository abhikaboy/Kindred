package notifications

import (
	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

// SetupRoutes sets up all notification routes
func SetupRoutes(app *fiber.App, collections map[string]*mongo.Collection) {
	service := newService(collections)

	api := app.Group("/api/v1")

	// Protected routes
	notifications := api.Group("/notifications")
	notifications.Use(auth.FiberAuthMiddlewareForServer(collections))

	// GET /api/v1/notifications - Get user notifications
	notifications.Get("/", service.GetNotifications)

	// PATCH /api/v1/notifications/read - Mark specific notifications as read
	notifications.Patch("/read", service.MarkAsRead)

	// PATCH /api/v1/notifications/read-all - Mark all notifications as read
	notifications.Patch("/read-all", service.MarkAllAsRead)

	// DELETE /api/v1/notifications/:id - Delete a specific notification
	notifications.Delete("/:id", service.DeleteNotificationHandler)
}
