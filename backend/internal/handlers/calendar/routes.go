package calendar

import (
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

func Routes(api huma.API, collections map[string]*mongo.Collection, cfg config.Config) {
	slog.Info("Registering calendar routes")

	// Get or create calendar_connections collection
	calendarConnections := collections["calendar_connections"]
	if calendarConnections == nil {
		slog.Warn("calendar_connections collection not found, creating reference")
		// Collection doesn't exist yet, get it from the database
		// This will create it on first write
		db := collections["users"].Database()
		calendarConnections = db.Collection("calendar_connections")
		collections["calendar_connections"] = calendarConnections
		slog.Info("calendar_connections collection reference created")
	} else {
		slog.Info("calendar_connections collection found")
	}

	// Get categories collection
	categories := collections["categories"]
	if categories == nil {
		slog.Error("categories collection not found")
		return
	}

	service := NewService(calendarConnections, categories, cfg)
	handler := NewHandler(service)

	// OAuth flow endpoints
	RegisterConnectGoogleOperation(api, handler)
	RegisterOAuthCallbackOperation(api, handler)

	// Connection management endpoints
	RegisterGetConnectionsOperation(api, handler)
	RegisterDisconnectOperation(api, handler)

	// Event endpoints
	RegisterGetEventsOperation(api, handler)

	// Sync endpoints
	RegisterSyncEventsOperation(api, handler)

	// Webhook endpoints
	RegisterWebhookOperation(api, handler)

	slog.Info("Calendar routes registered successfully")
}
