package subscription

import (
	"log/slog"
	"net/http"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

func Routes(api huma.API, collections map[string]*mongo.Collection, cfg config.Config) {
	slog.Info("Registering subscription routes")

	handler := NewHandler(collections["users"], cfg)

	huma.Register(api, huma.Operation{
		OperationID: "revenuecat-webhook",
		Summary:     "RevenueCat Webhook",
		Description: "Receives subscription lifecycle events from RevenueCat",
		Method:      http.MethodPost,
		Path:        "/v1/webhooks/revenuecat",
		Tags:        []string{"Subscription"},
	}, handler.HandleWebhook)

	slog.Info("Subscription routes registered successfully")
}
