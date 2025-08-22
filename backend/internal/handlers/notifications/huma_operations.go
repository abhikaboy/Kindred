package notifications

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Operation registrations

func RegisterGetNotificationsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-notifications",
		Method:      http.MethodGet,
		Path:        "/v1/user/notifications",
		Summary:     "Get notifications",
		Description: "Retrieve notifications for the authenticated user with pagination",
		Tags:        []string{"notifications"},
	}, handler.GetNotificationsHuma)
}

func RegisterMarkNotificationsReadOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "mark-notifications-read",
		Method:      http.MethodPatch,
		Path:        "/v1/user/notifications/read",
		Summary:     "Mark notifications as read",
		Description: "Mark specific notifications as read",
		Tags:        []string{"notifications"},
	}, handler.MarkNotificationsReadHuma)
}

func RegisterMarkAllNotificationsReadOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "mark-all-notifications-read",
		Method:      http.MethodPatch,
		Path:        "/v1/user/notifications/read-all",
		Summary:     "Mark all notifications as read",
		Description: "Mark all notifications as read for the authenticated user",
		Tags:        []string{"notifications"},
	}, handler.MarkAllNotificationsReadHuma)
}

func RegisterDeleteNotificationOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "delete-notification",
		Method:      http.MethodDelete,
		Path:        "/v1/user/notifications/{id}",
		Summary:     "Delete notification",
		Description: "Delete a specific notification",
		Tags:        []string{"notifications"},
	}, handler.DeleteNotificationHuma)
}

// Register all notification operations
func RegisterNotificationOperations(api huma.API, handler *Handler) {
	RegisterGetNotificationsOperation(api, handler)
	RegisterMarkNotificationsReadOperation(api, handler)
	RegisterMarkAllNotificationsReadOperation(api, handler)
	RegisterDeleteNotificationOperation(api, handler)
}
