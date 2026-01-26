package settings

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

// Router maps endpoints to handlers for settings
func Router(api huma.API, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := &Handler{service: service}

	RegisterSettingsOperations(api, handler)
}
