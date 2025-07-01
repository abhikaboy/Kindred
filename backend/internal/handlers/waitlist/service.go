package Waitlist

import (
	"context"
	"log/slog"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Waitlists: collections["waitlist"],
	}
}

// GetAllWaitlists fetches all Waitlist documents from MongoDB
func (s *Service) GetAllWaitlists() ([]WaitlistDocument, error) {
	ctx := context.Background()
	cursor, err := s.Waitlists.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []WaitlistDocument = make([]WaitlistDocument, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetWaitlistByID returns a single Waitlist document by its ObjectID
func (s *Service) GetWaitlistByID(id primitive.ObjectID) (*WaitlistDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Waitlist WaitlistDocument
	err := s.Waitlists.FindOne(ctx, filter).Decode(&Waitlist)

	if err == mongo.ErrNoDocuments {
		// No matching Waitlist found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Waitlist, nil
}

// InsertWaitlist adds a new Waitlist document
func (s *Service) CreateWaitlist(r *WaitlistDocument) (*WaitlistDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	result, err := s.Waitlists.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Waitlist inserted", slog.String("id", id.Hex()))

	return r, nil
}

// DeleteWaitlist removes a Waitlist document by ObjectID.
func (s *Service) DeleteWaitlist(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Waitlists.DeleteOne(ctx, filter)
	return err
}
