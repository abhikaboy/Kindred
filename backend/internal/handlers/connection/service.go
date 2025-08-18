package Connection

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
		Connections: collections["friend-requests"],
	}
}

// GetAllConnections fetches all Connection documents from MongoDB
func (s *Service) GetAllConnections() ([]ConnectionDocument, error) {
	ctx := context.Background()
	cursor, err := s.Connections.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var internalResults []ConnectionDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents
	results := make([]ConnectionDocument, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// GetByReciever fetches all Connection documents from MongoDB by receiver ID
func (s *Service) GetByReciever(id primitive.ObjectID) ([]ConnectionDocument, error) {
	ctx := context.Background()
	cursor, err := s.Connections.Find(ctx, bson.M{"reciever": id})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	if cursor.RemainingBatchLength() == 0 {
		return []ConnectionDocument{}, nil
	}

	var internalResults []ConnectionDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents
	results := make([]ConnectionDocument, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// GetByRequester fetches all Connection documents from MongoDB by requester ID
func (s *Service) GetByRequester(id primitive.ObjectID) ([]ConnectionDocument, error) {
	ctx := context.Background()
	cursor, err := s.Connections.Find(ctx, bson.M{"requester._id": id})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	if cursor.RemainingBatchLength() == 0 {
		return []ConnectionDocument{}, nil
	}

	var internalResults []ConnectionDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents
	results := make([]ConnectionDocument, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// GetConnectionByID returns a single Connection document by its ObjectID
func (s *Service) GetConnectionByID(id primitive.ObjectID) (*ConnectionDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var internalConnection ConnectionDocumentInternal
	err := s.Connections.FindOne(ctx, filter).Decode(&internalConnection)

	if err == mongo.ErrNoDocuments {
		// No matching Connection found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return internalConnection.ToAPI(), nil
}

// CreateConnection adds a new Connection document
func (s *Service) CreateConnection(r *ConnectionDocumentInternal) (*ConnectionDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	result, err := s.Connections.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID and update the internal document
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Connection inserted", slog.String("id", id.Hex()))

	return r.ToAPI(), nil
}

// UpdatePartialConnection updates only specified fields of a Connection document by ObjectID.
func (s *Service) UpdatePartialConnection(id primitive.ObjectID, updated UpdateConnectionDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Connections.UpdateOne(ctx, filter, update)
	return err
}

// DeleteConnection removes a Connection document by ObjectID.
func (s *Service) DeleteConnection(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Connections.DeleteOne(ctx, filter)
	return err
}
