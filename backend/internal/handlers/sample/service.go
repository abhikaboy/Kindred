package sample

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/GERM-template/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Samples: collections["samples"],
	}
}

// GetAllSamples fetches all Sample documents from MongoDB
func (s *Service) GetAllSamples() ([]SampleDocument, error) {
	ctx := context.Background()
	cursor, err := s.Samples.Find(ctx, bson.M{})
	if err != nil {

		return nil, err
	}
	defer cursor.Close(ctx)

	var results []SampleDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetSampleByID returns a single Sample document by its ObjectID
func (s *Service) GetSampleByID(id primitive.ObjectID) (*SampleDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Sample SampleDocument
	err := s.Samples.FindOne(ctx, filter).Decode(&Sample)

	if err == mongo.ErrNoDocuments {
		// No matching Sample found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Sample, nil
}

// InsertSample adds a new Sample document
func (s *Service) InsertSample(r SampleDocument) (*SampleDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	result, err := s.Samples.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Sample inserted", slog.String("id", id.Hex()))

	return &r, nil

}

// UpdatePartialSample updates only specified fields of a Sample document by ObjectID.
func (s *Service) UpdatePartialSample(id primitive.ObjectID, updated UpdateSampleDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Samples.UpdateOne(ctx, filter, update)
	return err

}

// DeleteSample removes a Sample document by ObjectID.
func (s *Service) DeleteSample(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Samples.DeleteOne(ctx, filter)
	return err

}

func (s *Service) GetNearbySamples(location []float64, radius float64) ([]SampleDocument, error) {
	ctx := context.Background()
	filter := bson.M{

		"location": bson.M{
			"$near":        location,
			"$maxDistance": radius,
		},
	}
	cursor, err := s.Samples.Find(ctx, filter)
	if err != nil {
		return nil, err
	}

	defer cursor.Close(ctx)

	var results []SampleDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}
