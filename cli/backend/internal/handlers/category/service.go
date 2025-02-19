
package Category

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/SocialToDo/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Categorys: collections["categorys"],
	}
}

// GetAllCategorys fetches all Category documents from MongoDB
func (s *Service) GetAllCategorys() ([]CategoryDocument, error) {
	ctx := context.Background()
	cursor, err := s.Categorys.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []CategoryDocument
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
	err := s.Categorys.FindOne(ctx, filter).Decode(&Category)

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

	result, err := s.Categorys.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Category inserted", slog.String("id", id.Hex()))

	return r, nil
}

// UpdatePartialCategory updates only specified fields of a Category document by ObjectID.
func (s *Service) UpdatePartialCategory(id primitive.ObjectID, updated UpdateCategoryDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Categorys.UpdateOne(ctx, filter, update)
	return err
}

// DeleteCategory removes a Category document by ObjectID.
func (s *Service) DeleteCategory(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Categorys.DeleteOne(ctx, filter)
	return err
}

