package socket

import (
	"fmt"
	"log/slog"

	"github.com/abhikaboy/SocialToDo/internal/xslog"
	"github.com/gofiber/contrib/socketio"
	"github.com/gofiber/fiber/v2"
)

/*
Handler to execute business logic for Health Endpoint
*/
type Handler struct {
	service *Service
}

func (h *Handler) LeaveRoom(c *fiber.Ctx) error {
	slog.LogAttrs(c.Context(), slog.LevelInfo, "Leaving Room")
	userId := c.Params("id")

	err := h.service.LeaveRoom(userId)
	if err != nil {
		xslog.Error(err)
		return err
	}
	return c.SendStatus(fiber.StatusOK)
}

func (h *Handler) JoinRoom(c *fiber.Ctx) error {
	slog.LogAttrs(c.Context(), slog.LevelInfo, "Joining Room")
	connectSocket := socketio.New(func(kws *socketio.Websocket) {

		// Retrieve the user id from endpoint
		userId := kws.Params("id") // get the user id

		// Every websocket connection has an optional session key => value storage
		kws.SetAttribute("user_id", userId)
		h.service.JoinRoom(userId, kws.UUID)

		kws.Emit([]byte(fmt.Sprintf("Hello user: %s with UUID: %s", userId, kws.UUID)))
	})
	err := connectSocket(c)
	if err != nil {
		xslog.Error(err)
		return err
	}
	return err

}

func (h *Handler) BroadcastRequest(c *fiber.Ctx) error {
	socketio.Broadcast([]byte("Hello World"))
	return c.SendString("Broadcast Request Sent")
}
