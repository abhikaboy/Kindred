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

	var internalResults []WaitlistDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents
	results := make([]WaitlistDocument, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// GetWaitlistByID returns a single Waitlist document by its ObjectID
func (s *Service) GetWaitlistByID(id primitive.ObjectID) (*WaitlistDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var internalWaitlist WaitlistDocumentInternal
	err := s.Waitlists.FindOne(ctx, filter).Decode(&internalWaitlist)

	if err == mongo.ErrNoDocuments {
		// No matching Waitlist found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return internalWaitlist.ToAPI(), nil
}

// CreateWaitlist adds a new Waitlist document
func (s *Service) CreateWaitlist(r *WaitlistDocumentInternal) (*WaitlistDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	result, err := s.Waitlists.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID and update the internal document
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Waitlist inserted", slog.String("id", id.Hex()))

	return r.ToAPI(), nil
}

// DeleteWaitlist removes a Waitlist document by ObjectID.
func (s *Service) DeleteWaitlist(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Waitlists.DeleteOne(ctx, filter)
	return err
}
