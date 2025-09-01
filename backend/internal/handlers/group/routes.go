package Group

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

// RegisterRoutes registers all group-related routes
func RegisterRoutes(api huma.API, collections map[string]*mongo.Collection) {
	handler := NewHandler(collections)
	RegisterGroupOperations(api, handler)
}
