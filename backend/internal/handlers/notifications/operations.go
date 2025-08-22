package notifications

import (
	"strconv"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GetNotifications retrieves notifications for the authenticated user
func (s *Service) GetNotifications(c *fiber.Ctx) error {
	userIDStr, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	// Parse query parameters for pagination
	limitStr := c.Query("limit", "20")
	skipStr := c.Query("skip", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}

	skip, err := strconv.Atoi(skipStr)
	if err != nil || skip < 0 {
		skip = 0
	}

	// Limit maximum notifications per request
	if limit > 100 {
		limit = 100
	}

	notifications, err := s.GetUserNotifications(userID, limit, skip)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch notifications",
		})
	}

	// Get unread count
	unreadCount, err := s.GetUnreadCount(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch unread count",
		})
	}

	return c.JSON(fiber.Map{
		"notifications": notifications,
		"unread_count":  unreadCount,
		"total":         len(notifications),
	})
}

// MarkAsRead marks specific notifications as read
func (s *Service) MarkAsRead(c *fiber.Ctx) error {
	_, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	var request struct {
		NotificationIDs []string `json:"notification_ids"`
	}

	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Convert string IDs to ObjectIDs
	var notificationIDs []primitive.ObjectID
	for _, idStr := range request.NotificationIDs {
		id, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid notification ID format",
			})
		}
		notificationIDs = append(notificationIDs, id)
	}

	err = s.MarkNotificationsAsRead(notificationIDs)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to mark notifications as read",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Notifications marked as read",
	})
}

// MarkAllAsRead marks all notifications as read for the authenticated user
func (s *Service) MarkAllAsRead(c *fiber.Ctx) error {
	userIDStr, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	err = s.MarkAllAsReadForUser(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to mark all notifications as read",
		})
	}

	return c.JSON(fiber.Map{
		"message": "All notifications marked as read",
	})
}

// DeleteNotificationHandler deletes a specific notification
func (s *Service) DeleteNotificationHandler(c *fiber.Ctx) error {
	_, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	notificationIDStr := c.Params("id")
	notificationID, err := primitive.ObjectIDFromHex(notificationIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid notification ID",
		})
	}

	err = s.DeleteNotification(notificationID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete notification",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Notification deleted",
	})
}
