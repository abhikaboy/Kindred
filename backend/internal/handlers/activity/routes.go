package Activity

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := Handler{service}

	RegisterActivityOperations(api, &handler)
}

// RegisterActivityOperations registers all activity operations with Huma
func RegisterActivityOperations(api huma.API, handler *Handler) {
	RegisterGetActivitiesOperation(api, handler)
	RegisterGetActivityOperation(api, handler)
	RegisterGetActivityByUserAndPeriodOperation(api, handler)
	RegisterGetRecentActivityOperation(api, handler)
}
