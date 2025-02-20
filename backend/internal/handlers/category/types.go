package Category

import (
	"time"

	"github.com/abhikaboy/SocialToDo/internal/handlers/task"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateCategoryParams struct {
	Name string `bson:"name,omitempty" json:"name,omitempty"`
	User string `bson:"user,omitempty" json:"user,omitempty"`
}

type CategoryDocument struct {
	ID         primitive.ObjectID  `bson:"_id" json:"id"`
	Name       string              `bson:"name,omitempty" json:"name,omitempty"`
	LastEdited time.Time           `bson:"lastEdited" json:"lastEdited"`
	Tasks      []task.TaskDocument `bson:"tasks" json:"tasks"`
	User       primitive.ObjectID  `bson:"user" json:"user"`
}

type UpdateCategoryDocument struct {
	Name string `bson:"name,omitempty" json:"name,omitempty"`
}

/*
Category Service to be used by Category Handler to interact with the
Database layer of the application
*/

type Service struct {
	Categories *mongo.Collection
}
