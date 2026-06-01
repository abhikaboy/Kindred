package foryou

import (
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

// Routes wires the For You handler into the Huma API.
func Routes(api huma.API, collections map[string]*mongo.Collection, ringService *rings.RingService) {
	service := newService(collections, ringService)
	handler := Handler{service: service}
	RegisterForYouOperations(api, &handler)
}
