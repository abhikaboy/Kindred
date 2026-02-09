package calendar

import "github.com/danielgtaylor/huma/v2"

func RegisterConnectGoogleOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "connect-google-calendar",
		Method:      "GET",
		Path:        "/v1/user/calendar/connect/google",
		Summary:     "Initiate Google Calendar OAuth",
		Description: "Returns OAuth consent URL for Google Calendar. User must be authenticated.",
		Tags:        []string{"Calendar"},
	}, handler.ConnectGoogle)
}

func RegisterOAuthCallbackOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "google-calendar-oauth-callback",
		Method:      "GET",
		Path:        "/v1/calendar/oauth2/callback",
		Summary:     "Google Calendar OAuth callback",
		Description: "Handles OAuth callback from Google. This is called by Google after user grants permissions. This endpoint is NOT behind auth middleware since Google calls it directly.",
		Tags:        []string{"Calendar"},
	}, handler.OAuthCallback)
}

func RegisterGetConnectionsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-calendar-connections",
		Method:      "GET",
		Path:        "/v1/user/calendar/connections",
		Summary:     "List calendar connections",
		Description: "Returns all calendar connections for the authenticated user",
		Tags:        []string{"Calendar"},
	}, handler.GetConnections)
}

func RegisterDisconnectOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID:   "disconnect-calendar",
		Method:        "DELETE",
		Path:          "/v1/user/calendar/connections/{connectionId}",
		Summary:       "Disconnect calendar",
		Description:   "Removes a calendar connection and its OAuth tokens",
		Tags:          []string{"Calendar"},
		DefaultStatus: 200,
	}, handler.Disconnect)
}

func RegisterGetEventsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-calendar-events",
		Method:      "GET",
		Path:        "/v1/user/calendar/connections/{connectionId}/events",
		Summary:     "Fetch calendar events",
		Description: "Fetches events from a connected calendar within a date range. Automatically refreshes access token if needed.",
		Tags:        []string{"Calendar"},
	}, handler.GetEvents)
}

func RegisterSyncEventsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID:   "sync-calendar-events",
		Method:        "POST",
		Path:          "/v1/user/calendar/connections/{connectionId}/sync",
		Summary:       "Sync calendar events to tasks",
		Description:   "Fetches calendar events and creates tasks in appropriate categories. Events are automatically grouped by calendar and placed in matching categories. Duplicate events are skipped using unique integration IDs.",
		Tags:          []string{"Calendar"},
		DefaultStatus: 200,
	}, handler.SyncEvents)
}

func RegisterWebhookOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "calendar-webhook",
		Method:      "POST",
		Path:        "/v1/calendar/webhook/{connection_id}",
		Summary:     "Google Calendar webhook receiver",
		Description: "Receives push notifications from Google Calendar API. This endpoint is NOT behind auth middleware since Google calls it directly.",
		Tags:        []string{"Calendar"},
		Security:    []map[string][]string{}, // No auth - Google calls this
	}, handler.HandleWebhook)
}
