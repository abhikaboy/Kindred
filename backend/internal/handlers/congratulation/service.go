package congratulation

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out congratulations
func newService(collections map[string]*mongo.Collection) *Service {
	congratulations := collections["congratulations"]
	users := collections["users"]
	
	// Log if collections are not found
	if congratulations == nil {
		slog.Error("Congratulations collection not found in database")
	}
	if users == nil {
		slog.Error("Users collection not found in database")
	}
	
	return &Service{
		Congratulations: congratulations,
		Users:           users,
	}
}

// GetAllCongratulations fetches all Congratulation documents from MongoDB for a specific receiver
func (s *Service) GetAllCongratulations(receiverID primitive.ObjectID) ([]CongratulationDocument, error) {
	if s.Congratulations == nil {
		return nil, fmt.Errorf("congratulations collection not available")
	}
	
	ctx := context.Background()
	filter := bson.M{"receiver": receiverID}
	
	cursor, err := s.Congratulations.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var internalResults []CongratulationDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents
	results := make([]CongratulationDocument, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// GetCongratulationByID returns a single Congratulation document by its ObjectID
func (s *Service) GetCongratulationByID(id primitive.ObjectID) (*CongratulationDocument, error) {
	if s.Congratulations == nil {
		return nil, fmt.Errorf("congratulations collection not available")
	}
	
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var internalCongratulation CongratulationDocumentInternal
	err := s.Congratulations.FindOne(ctx, filter).Decode(&internalCongratulation)

	if err == mongo.ErrNoDocuments {
		// No matching Congratulation found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return internalCongratulation.ToAPI(), nil
}

// CreateCongratulation adds a new Congratulation document
func (s *Service) CreateCongratulation(r *CongratulationDocumentInternal) (*CongratulationDocument, error) {
	if s.Congratulations == nil {
		return nil, fmt.Errorf("congratulations collection not available")
	}
	
	ctx := context.Background()

	congratulation := CongratulationDocumentInternal{
		ID:           primitive.NewObjectID(),
		Sender:       r.Sender,
		Receiver:     r.Receiver,
		Message:      r.Message,
		Timestamp:    time.Now(),
		CategoryName: r.CategoryName,
		TaskName:     r.TaskName,
		Read:         false, // Default to unread
	}

	slog.Info("Creating congratulation", "sender_id", r.Sender.ID, "receiver_id", r.Receiver)
	
	result, err := s.Congratulations.InsertOne(ctx, congratulation)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID and update the internal document
	id := result.InsertedID.(primitive.ObjectID)
	congratulation.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Congratulation inserted", slog.String("id", id.Hex()))

	return congratulation.ToAPI(), nil
}

// UpdatePartialCongratulation updates only specified fields of a Congratulation document by ObjectID.
func (s *Service) UpdatePartialCongratulation(id primitive.ObjectID, updated UpdateCongratulationDocument) error {
	if s.Congratulations == nil {
		return fmt.Errorf("congratulations collection not available")
	}
	
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Congratulations.UpdateOne(ctx, filter, update)
	return err
}

// DeleteCongratulation removes a Congratulation document by ObjectID.
func (s *Service) DeleteCongratulation(id primitive.ObjectID) error {
	if s.Congratulations == nil {
		return fmt.Errorf("congratulations collection not available")
	}
	
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Congratulations.DeleteOne(ctx, filter)
	return err
}

// MarkCongratulationsAsRead marks multiple congratulations as read
func (s *Service) MarkCongratulationsAsRead(ids []primitive.ObjectID) (int64, error) {
	if s.Congratulations == nil {
		return 0, fmt.Errorf("congratulations collection not available")
	}
	
	ctx := context.Background()
	filter := bson.M{"_id": bson.M{"$in": ids}}
	update := bson.M{"$set": bson.M{"read": true}}

	result, err := s.Congratulations.UpdateMany(ctx, filter, update)
	if err != nil {
		return 0, err
	}

	return result.ModifiedCount, nil
}

// GetSenderInfo fetches sender information from the users collection
func (s *Service) GetSenderInfo(senderID primitive.ObjectID) (*CongratulationSenderInternal, error) {
	if s.Users == nil {
		return nil, fmt.Errorf("users collection not available")
	}
	
	ctx := context.Background()
	
	cursor, err := s.Users.Aggregate(ctx, []bson.M{
		{
			"$match": bson.M{"_id": senderID},
		},
		{
			"$project": bson.M{
				"display_name":    1,
				"profile_picture": 1,
				"handle":          1,
			},
		},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var user struct {
		ID             primitive.ObjectID `bson:"_id"`
		DisplayName    string             `bson:"display_name"`
		Handle         string             `bson:"handle"`
		ProfilePicture string             `bson:"profile_picture"`
	}

	cursor.Next(ctx)
	if err := cursor.Decode(&user); err != nil {
		return nil, err
	}

	return &CongratulationSenderInternal{
		Name:    user.DisplayName,
		Picture: user.ProfilePicture,
		ID:      user.ID,
	}, nil
} 