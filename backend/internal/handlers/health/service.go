package health

import (
	"go.mongodb.org/mongo-driver/mongo"
)

type Service struct {
	health *mongo.Collection
}

func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{collections["health"]}
}
