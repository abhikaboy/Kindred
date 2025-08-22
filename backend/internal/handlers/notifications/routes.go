package notifications

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Routes maps endpoints to handlers using Huma operations
*/
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := NewHandler(service)

	// Register all notification operations
	RegisterNotificationOperations(api, handler)
}
