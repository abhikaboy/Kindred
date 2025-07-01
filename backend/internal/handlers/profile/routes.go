package Profile

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	// Initialize service
	service := newService(collections)

	// Create handler
	handler := Handler{
		service: service,
	}

	RegisterProfileOperations(api, &handler)
}

// RegisterProfileOperations registers all profile operations with Huma
func RegisterProfileOperations(api huma.API, handler *Handler) {
	RegisterGetProfilesOperation(api, handler)
	RegisterGetProfileOperation(api, handler)
	RegisterUpdateProfileOperation(api, handler)
	RegisterDeleteProfileOperation(api, handler)
	RegisterGetProfileByEmailOperation(api, handler)
	RegisterGetProfileByPhoneOperation(api, handler)
	RegisterSearchProfilesOperation(api, handler)
	// Note: Profile picture upload operations moved to /v1/uploads endpoints
}
