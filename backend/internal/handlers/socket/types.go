package socket

import (
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Review Service to be used by Review Handler to interact with the
Database layer of the application
*/
type Service struct {
	sample *mongo.Collection
}
