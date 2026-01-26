package sockets

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/gofiber/contrib/socketio"
)

func New() {

	socketio.On(socketio.EventConnect, func(ep *socketio.EventPayload) {
		ctx := context.Background()
		slog.LogAttrs(ctx, slog.LevelInfo, "Connected Client")
	})

	// Event Disconnect

	socketio.On(socketio.EventDisconnect, func(ep *socketio.EventPayload) {
		ctx := context.Background()
		user_type := ep.Kws.GetAttribute("user_type")
		id := ep.Kws.GetAttribute("user_id")

		userTypeStr, ok := user_type.(string)
		if !ok {
			slog.LogAttrs(ctx, slog.LevelError, "Invalid user_type")
			return
		}

		idStr, ok := id.(string)
		if !ok {
			slog.LogAttrs(ctx, slog.LevelError, "Invalid id")
			return
		}

		fmt.Printf("Disconnected Client with UUID: %s and Type: %s\n", idStr, userTypeStr)
		// make an DELETE request to the socket endpoint
		req, err := http.NewRequest(
			"DELETE",
			"http://localhost:8080/ws/"+userTypeStr+"/"+idStr,
			nil,
		)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Error creating request", slog.String("error", err.Error()))
			return
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Error making request", slog.String("error", err.Error()))
			return
		}
		defer resp.Body.Close()

		fmt.Printf("http://localhost:8080/ws/%s/%s\n", userTypeStr, idStr)

		slog.LogAttrs(ctx, slog.LevelInfo, "Disconnected Client with UUID", slog.String("UUID", idStr))
	})

	// Event CustomEvent

	socketio.On("CustomEvent", func(ep *socketio.EventPayload) {
		ctx := context.Background()
		slog.LogAttrs(ctx, slog.LevelInfo, "Custom Event Called")
		// Unmarshel the data into a struct
		var msg Message
		err := json.Unmarshal(ep.Data, &msg)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Error unmarshalling data", slog.String("error", err.Error()))
			return
		}
		slog.LogAttrs(ctx, slog.LevelInfo, "Message received", slog.String("message", msg.Message))
	})

	socketio.On(socketio.EventClose, func(ep *socketio.EventPayload) {
		ctx := context.Background()
		slog.LogAttrs(ctx, slog.LevelInfo, "Closed Connection Bruh")
	})

}
