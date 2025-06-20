package health

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

	RegisterHealthOperation(api, &handler)
}
