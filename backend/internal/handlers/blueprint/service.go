package Blueprint

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Blueprints: collections["blueprints"],
		Users: collections["users"],
	}
}

// GetAllBlueprints fetches all Blueprint documents from MongoDB
func (s *Service) GetAllBlueprints() ([]BlueprintDocument, error) {
	ctx := context.Background()
	cursor, err := s.Blueprints.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []BlueprintDocument = make([]BlueprintDocument, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetBlueprintByID returns a single Blueprint document by its ObjectID
func (s *Service) GetBlueprintByID(id primitive.ObjectID) (*BlueprintDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Blueprint BlueprintDocument
	err := s.Blueprints.FindOne(ctx, filter).Decode(&Blueprint)

	if err == mongo.ErrNoDocuments {
		// No matching Blueprint found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Blueprint, nil
}

// InsertBlueprint adds a new Blueprint document
func (s *Service) CreateBlueprint(r *BlueprintDocument) (*BlueprintDocument, error) {
	ctx := context.Background()

	Blueprint := BlueprintDocument{
		ID:               primitive.NewObjectID(),
		Banner:           r.Banner,
		Name:             r.Name,
		Tags:             r.Tags,
		Description:      r.Description,
		Duration:         r.Duration,
		Subscribers:      []primitive.ObjectID{},
		SubscribersCount: 0,
		Timestamp:        time.Now(),
	}

	slog.Info("Creating blueprint", "owner_id", r.Owner.ID)
	cursor, err := s.Users.Aggregate(ctx, []bson.M{
		{
			"$match": bson.M{"_id": &r.Owner.ID},
		},
		{
			"$project": bson.M{"handle": 1, "display_name": 1, "profile_picture": 1},
		},
	})
	defer cursor.Close(ctx)

	var user types.UserExtendedReference
	cursor.Next(ctx)
	if err := cursor.Decode(&user); err != nil {
		return nil, err
	}

	Blueprint.Owner = &user

	_, err = s.Blueprints.InsertOne(ctx, Blueprint)
	if err != nil {
		return nil, err
	}

	return &Blueprint, nil
}

// UpdatePartialBlueprint updates only specified fields of a Blueprint document by ObjectID.
func (s *Service) UpdatePartialBlueprint(id primitive.ObjectID, updated UpdateBlueprintDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Blueprints.UpdateOne(ctx, filter, update)
	return err
}

// DeleteBlueprint removes a Blueprint document by ObjectID.
func (s *Service) DeleteBlueprint(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Blueprints.DeleteOne(ctx, filter)
	return err
}

// SubscribeToBlueprint adds a user to the subscribers array and increments the count
func (s *Service) SubscribeToBlueprint(blueprintID, userID primitive.ObjectID) error {
	ctx := context.Background()
	filter := bson.M{"_id": blueprintID, "subscribers": bson.M{"$ne": userID}}
	update := bson.M{
		"$addToSet": bson.M{"subscribers": userID},
		"$inc": bson.M{"subscribersCount": 1},
	}
	result, err := s.Blueprints.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments // Already subscribed or blueprint not found
	}
	return nil
}

// UnsubscribeFromBlueprint removes a user from the subscribers array and decrements the count only if the user was subscribed
func (s *Service) UnsubscribeFromBlueprint(blueprintID, userID primitive.ObjectID) error {
	ctx := context.Background()
	filter := bson.M{"_id": blueprintID, "subscribers": userID}
	update := bson.M{
		"$inc": bson.M{"subscribersCount": -1},
		"$pull": bson.M{"subscribers": userID},
	}
	result, err := s.Blueprints.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments // Not subscribed or blueprint not found
	}
	return nil
}
