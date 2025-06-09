package Blueprint

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateBlueprintParams struct {
	Banner      string   `bson:"banner" json:"banner"`
	Name        string   `bson:"name" json:"name"`
	Tags        []string `bson:"tags" json:"tags"`
	Description string   `bson:"description" json:"description"`
	Duration    string   `bson:"duration" json:"duration"`
}

type BlueprintDocument struct {
	ID               primitive.ObjectID   `bson:"_id" json:"id"`
	Banner           string               `bson:"banner" json:"banner"`
	Name             string               `bson:"name" json:"name"`
	Tags             []string             `bson:"tags" json:"tags"`
	Description      string               `bson:"description" json:"description"`
	Duration         string               `bson:"duration" json:"duration"`
	Subscribers      []primitive.ObjectID `bson:"subscribers" json:"subscribers"`
	Owner            *types.UserExtendedReference  `bson:"owner" json:"owner"`
	SubscribersCount int64                `bson:"subscribersCount" json:"subscribersCount"`
	Timestamp        time.Time            `bson:"timestamp" json:"timestamp"`
}

type UpdateBlueprintDocument struct {
	Banner      *string               `bson:"banner,omitempty" json:"banner,omitempty"`
	Name        *string               `bson:"name,omitempty" json:"name,omitempty"`
	Tags        *[]string             `bson:"tags,omitempty" json:"tags,omitempty"`
	Description *string               `bson:"description,omitempty" json:"description,omitempty"`
	Duration    *string               `bson:"duration,omitempty" json:"duration,omitempty"`
	Subscribers *[]primitive.ObjectID `bson:"subscribers,omitempty" json:"subscribers,omitempty"`
	Timestamp   *time.Time            `bson:"timestamp,omitempty" json:"timestamp,omitempty"`
}

/*
	Blueprint Service to be used by Blueprint Handler to interact with the
	Database layer of the application
*/

type Service struct {
	Blueprints *mongo.Collection
	Users *mongo.Collection
}
