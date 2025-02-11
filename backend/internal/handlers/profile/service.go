package Profile

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
		Profiles: collections["profiles"],
	}
}

// GetAllProfiles fetches all Profile documents from MongoDB
func (s *Service) GetAllProfiles() ([]ProfileDocument, error) {
	ctx := context.Background()
	cursor, err := s.Profiles.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []ProfileDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetProfileByID returns a single Profile document by its ObjectID
func (s *Service) GetProfileByID(id primitive.ObjectID) (*ProfileDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Profile ProfileDocument
	err := s.Profiles.FindOne(ctx, filter).Decode(&Profile)

	if err == mongo.ErrNoDocuments {
		// No matching Profile found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Profile, nil
}

// InsertProfile adds a new Profile document
func (s *Service) CreateProfile(r *ProfileDocument) (*ProfileDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	result, err := s.Profiles.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Profile inserted", slog.String("id", id.Hex()))

	return r, nil
}

// UpdatePartialProfile updates only specified fields of a Profile document by ObjectID.
func (s *Service) UpdatePartialProfile(id primitive.ObjectID, updated UpdateProfileDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Profiles.UpdateOne(ctx, filter, update)
	return err
}

// DeleteProfile removes a Profile document by ObjectID.
func (s *Service) DeleteProfile(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Profiles.DeleteOne(ctx, filter)
	return err
}
