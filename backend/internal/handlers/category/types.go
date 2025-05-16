package Category

import (
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateCategoryParams struct {
	Name string `bson:"name,omitempty" json:"name,omitempty"`
	WorkspaceName string `bson:"workspaceName,omitempty" json:"workspaceName,omitempty"`
}

type CategoryDocument = types.CategoryDocument


type UpdateCategoryDocument struct {
	Name string `bson:"name,omitempty" json:"name,omitempty"`
}

type WorkspaceResult struct {
	Name string `bson:"_id" json:"name"`
	Categories []types.CategoryDocument `bson:"categories" json:"categories"`
}

/*
Category Service to be used by Category Handler to interact with the
Database layer of the application
*/

type Service struct {
	Categories *mongo.Collection
}
