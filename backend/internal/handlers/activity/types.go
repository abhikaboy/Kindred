package Activity

import (
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

type ActivityDocument = types.ActivityDocument
type ActivityDay = types.ActivityDay

/*
Activity Service to be used by Activity Handler to interact with the
Database layer of the application
*/

type Service struct {
	Activitys *mongo.Collection
}
