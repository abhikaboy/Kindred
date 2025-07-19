package congratulation

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers using Huma operations
*/
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := Handler{service}

	// Register all congratulation operations
	RegisterCongratulationOperations(api, &handler)
} 