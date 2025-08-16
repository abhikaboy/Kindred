package Category

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Categories: collections["categories"],
	}
}

// GetAllCategories fetches all Category documents from MongoDB
func (s *Service) GetAllCategories() ([]CategoryDocument, error) {
	ctx := context.Background()
	cursor, err := s.Categories.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := make([]CategoryDocument, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetAllCategories fetches all Category documents from MongoDB
func (s *Service) GetCategoriesByUser(id primitive.ObjectID) ([]WorkspaceResult, error) {
	ctx := context.Background()

	filter := bson.M{"user": id}
	cursor, err := s.Categories.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: filter},
		},
		{
			{Key: "$group", Value: bson.M{
				"_id": "$$ROOT.workspaceName",
				"categories": bson.M{
					"$push": "$$ROOT",
				},
			}},
		},
	})

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := make([]WorkspaceResult, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// GetCategoryByID returns a single Category document by its ObjectID
func (s *Service) GetCategoryByID(id primitive.ObjectID) (*CategoryDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Category CategoryDocument
	err := s.Categories.FindOne(ctx, filter).Decode(&Category)

	if err == mongo.ErrNoDocuments {
		// No matching Category found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Category, nil
}

// InsertCategory adds a new Category document
func (s *Service) CreateCategory(r *CategoryDocument) (*CategoryDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	_, err := s.Categories.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Category inserted", slog.String("id", r.ID.Hex()))

	return r, nil
}

// UpdatePartialCategory updates only specified fields of a Category document by ObjectID.
func (s *Service) UpdatePartialCategory(id primitive.ObjectID, updated UpdateCategoryDocument) (*CategoryDocument, error) {
	ctx := context.Background()
	// filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return nil, err
	}

	fmt.Println(updateFields)

	_, err = s.Categories.UpdateOne(ctx,
		bson.M{
			"_id": id,
		},
		bson.D{{Key: "$set", Value: bson.D{
			{Key: "name", Value: updated.Name},
			{Key: "lastEdited", Value: xutils.NowUTC()},
		}}},
	)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to update Category", slog.String("error", err.Error()))
		return nil, err
	}

	return nil, err
}

// DeleteCategory removes a Category document by ObjectID.
func (s *Service) DeleteCategory(userId primitive.ObjectID, id primitive.ObjectID) error {
	ctx := context.Background()
	_, err := s.Categories.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (s *Service) DeleteWorkspace(workspaceName string, user primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"workspaceName": workspaceName, "user": user}
	_, err := s.Categories.DeleteMany(ctx, filter)

	return err
}

// RenameWorkspace renames a workspace by updating all categories that belong to it
func (s *Service) RenameWorkspace(oldWorkspaceName string, newWorkspaceName string, user primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"workspaceName": oldWorkspaceName, "user": user}
	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "workspaceName", Value: newWorkspaceName},
			{Key: "lastEdited", Value: xutils.NowUTC()},
		}},
	}

	result, err := s.Categories.UpdateMany(ctx, filter, update)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Failed to rename workspace", 
			slog.String("oldName", oldWorkspaceName),
			slog.String("newName", newWorkspaceName),
			slog.String("error", err.Error()))
		return err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Workspace renamed successfully", 
		slog.String("oldName", oldWorkspaceName),
		slog.String("newName", newWorkspaceName),
		slog.Int64("categoriesUpdated", result.ModifiedCount))

	return nil
}

func (s *Service) GetWorkspaces(userId primitive.ObjectID) ([]WorkspaceResult, error) {
	ctx := context.Background()

	filter := bson.M{"user": userId}
	cursor, err := s.Categories.Aggregate(ctx, mongo.Pipeline{
		{
			{Key: "$match", Value: filter},
		},
		{
			{Key: "$group", Value: bson.M{
				"_id": "$$ROOT.workspaceName",
				"categories": bson.M{
					"$push": "$$ROOT",
				},
			}},
		},
	})

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := make([]WorkspaceResult, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}
