package Activity

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Activitys: collections["activity"],
	}
}

// GetAllActivitys fetches all Activity documents from MongoDB
func (s *Service) GetAllActivitys() ([]ActivityDocument, error) {
	ctx := context.Background()
	cursor, err := s.Activitys.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []ActivityDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetActivityByID returns a single Activity document by its ObjectID
func (s *Service) GetActivityByID(id primitive.ObjectID) (*ActivityDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Activity ActivityDocument
	err := s.Activitys.FindOne(ctx, filter).Decode(&Activity)

	if err == mongo.ErrNoDocuments {
		// No matching Activity found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Activity, nil
}

// InsertActivity adds a new Activity document
func (s *Service) CreateActivity(r *ActivityDocument) (*ActivityDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	result, err := s.Activitys.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Activity inserted", slog.String("id", id.Hex()))

	return r, nil
}

// UpdatePartialActivity updates only specified fields of a Activity document by ObjectID.
func (s *Service) UpdatePartialActivity(id primitive.ObjectID, updated UpdateActivityDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Activitys.UpdateOne(ctx, filter, update)
	return err
}

// DeleteActivity removes a Activity document by ObjectID.
func (s *Service) DeleteActivity(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Activitys.DeleteOne(ctx, filter)
	return err
}
