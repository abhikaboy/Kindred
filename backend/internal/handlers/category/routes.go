package Category

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

	RegisterCategoryOperations(api, &handler)
}

// RegisterCategoryOperations registers all category operations with Huma
func RegisterCategoryOperations(api huma.API, handler *Handler) {
	RegisterCreateCategoryOperation(api, handler)
	RegisterGetCategoriesOperation(api, handler)
	RegisterGetCategoryOperation(api, handler)
	RegisterGetCategoriesByUserOperation(api, handler)
	RegisterGetWorkspacesOperation(api, handler)
	RegisterUpdateCategoryOperation(api, handler)
	RegisterDeleteCategoryOperation(api, handler)
	RegisterDeleteWorkspaceOperation(api, handler)
	RegisterRenameWorkspaceOperation(api, handler)
	RegisterSetupDefaultWorkspaceOperation(api, handler)
}
