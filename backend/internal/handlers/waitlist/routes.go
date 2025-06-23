package Waitlist

import (
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	service := newService(collections)
	waitlistHandler := Handler{service}

	RegisterWaitlistOperations(api, &waitlistHandler)
}
