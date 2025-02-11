package Chat

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
		Chats: collections["chats"],
	}
}

// GetAllChats fetches all Chat documents from MongoDB
func (s *Service) GetAllChats() ([]ChatDocument, error) {
	ctx := context.Background()
	cursor, err := s.Chats.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []ChatDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetChatByID returns a single Chat document by its ObjectID
func (s *Service) GetChatByID(id primitive.ObjectID) (*ChatDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Chat ChatDocument
	err := s.Chats.FindOne(ctx, filter).Decode(&Chat)

	if err == mongo.ErrNoDocuments {
		// No matching Chat found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Chat, nil
}

// InsertChat adds a new Chat document
func (s *Service) CreateChat(r *ChatDocument) (*ChatDocument, error) {
	ctx := context.Background()
	// Insert the document into the collection

	result, err := s.Chats.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Chat inserted", slog.String("id", id.Hex()))

	return r, nil
}

// UpdatePartialChat updates only specified fields of a Chat document by ObjectID.
func (s *Service) UpdatePartialChat(id primitive.ObjectID, updated UpdateChatDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Chats.UpdateOne(ctx, filter, update)
	return err
}

// DeleteChat removes a Chat document by ObjectID.
func (s *Service) DeleteChat(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Chats.DeleteOne(ctx, filter)
	return err
}
