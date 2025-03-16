package Category

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateCategoryParams struct {
	Name string `bson:"name,omitempty" json:"name,omitempty"`
	WorkspaceName string `bson:"workspaceName,omitempty" json:"workspaceName,omitempty"`
}

type CategoryDocument struct {
	ID         primitive.ObjectID  `bson:"_id" json:"id"`
	Name       string              `bson:"name" json:"name"`
	WorkspaceName string `bson:"workspaceName" json:"workspaceName"`
	LastEdited time.Time           `bson:"lastEdited" json:"lastEdited"`
	Tasks      []task.TaskDocument `bson:"tasks" json:"tasks"`
	User       primitive.ObjectID  `bson:"user" json:"user"`
}

type UpdateCategoryDocument struct {
	Name string `bson:"name,omitempty" json:"name,omitempty"`
}

type WorkspaceResult struct {
	Name string `bson:"_id" json:"name"`
	Categories []CategoryDocument `bson:"categories" json:"categories"`
}

/*
Category Service to be used by Category Handler to interact with the
Database layer of the application
*/

type Service struct {
	Categories *mongo.Collection
}
