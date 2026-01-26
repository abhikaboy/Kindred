package report

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

// Routes registers all report endpoints
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	service := newService(collections)
	handler := &Handler{service: service}

	RegisterReportOperations(api, handler)
}
