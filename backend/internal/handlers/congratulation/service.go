package congratulation

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out congratulations
func newService(collections map[string]*mongo.Collection) *Service {
	congratulations := collections["congratulations"]
	users := collections["users"]
	posts := collections["posts"]

	// Log if collections are not found
	if congratulations == nil {
		slog.Error("Congratulations collection not found in database")
	}
	if users == nil {
		slog.Error("Users collection not found in database")
	}
	if posts == nil {
		slog.Error("Posts collection not found in database")
	}

	return &Service{
		Congratulations:     congratulations,
		Users:               users,
		Posts:               posts,
		NotificationService: notifications.NewNotificationService(collections),
	}
}

// NewService is the exported version for testing
func NewService(collections map[string]*mongo.Collection) *Service {
	return newService(collections)
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

	// Check if sender has enough congratulations
	balance, err := s.GetUserBalance(r.Sender.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user balance: %w", err)
	}

	if balance <= 0 {
		return nil, fmt.Errorf("insufficient congratulation balance: user has %d congratulations remaining", balance)
	}

	congratulation := CongratulationDocumentInternal{
		ID:           primitive.NewObjectID(),
		Sender:       r.Sender,
		Receiver:     r.Receiver,
		Message:      r.Message,
		Timestamp:    time.Now(),
		CategoryName: r.CategoryName,
		TaskName:     r.TaskName,
		Read:         false, // Default to unread
		Type:         r.Type,
		PostID:       r.PostID,
	}

	slog.Info("Creating congratulation", "sender_id", r.Sender.ID, "receiver_id", r.Receiver, "balance", balance)

	result, err := s.Congratulations.InsertOne(ctx, congratulation)
	if err != nil {
		return nil, err
	}

	// Decrement user's congratulation balance
	err = s.DecrementUserBalance(r.Sender.ID)
	if err != nil {
		// Log error but don't fail the operation since congratulation was already created
		slog.Error("Failed to decrement user balance after creating congratulation", "error", err, "sender_id", r.Sender.ID)
	}

	// Cast the inserted ID to ObjectID and update the internal document
	id, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		return nil, fmt.Errorf("failed to convert InsertedID to ObjectID")
	}
	congratulation.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "Congratulation inserted", slog.String("id", id.Hex()))

	// Send push notification to receiver
	err = s.sendCongratulationNotification(r.Receiver, r.Sender.Name, r.TaskName, r.Message, r.Type)
	if err != nil {
		// Log error but don't fail the operation since congratulation was already created
		slog.Error("Failed to send congratulation notification", "error", err, "receiver_id", r.Receiver)
	}

	// Create notification in the database with thumbnail (first image from post if available)
	notificationContent := fmt.Sprintf("%s has sent you a congratulation on %s: \"%s\"", r.Sender.Name, r.TaskName, r.Message)
	var thumbnail string

	// If we have a post ID, try to fetch the post to get the thumbnail
	if r.PostID != nil && !r.PostID.IsZero() {
		if s.Posts != nil {
			var post struct {
				Images []string `bson:"images"`
			}
			err := s.Posts.FindOne(ctx, bson.M{"_id": r.PostID}).Decode(&post)
			if err == nil && len(post.Images) > 0 {
				thumbnail = post.Images[0]
			}
		}
	}

	err = s.NotificationService.CreateNotification(r.Sender.ID, r.Receiver, notificationContent, notifications.NotificationTypeCongratulation, id, thumbnail)
	if err != nil {
		// Log error but don't fail the operation since congratulation was already created
		slog.Error("Failed to create congratulation notification in database", "error", err, "receiver_id", r.Receiver)
	}

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

// GetUserBalance fetches the congratulation balance for a specific user
func (s *Service) GetUserBalance(userID primitive.ObjectID) (int, error) {
	if s.Users == nil {
		return 0, fmt.Errorf("users collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": userID}

	var user struct {
		Congratulations int `bson:"congratulations"`
	}

	err := s.Users.FindOne(ctx, filter, nil).Decode(&user)
	if err != nil {
		return 0, err
	}

	return user.Congratulations, nil
}

// DecrementUserBalance decrements the congratulation balance for a specific user
func (s *Service) DecrementUserBalance(userID primitive.ObjectID) error {
	if s.Users == nil {
		return fmt.Errorf("users collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": userID}
	update := bson.M{"$inc": bson.M{
		"congratulations":              -1, // Decrement balance
		"kudosRewards.congratulations": 1,  // Increment sent count for rewards
	}}

	_, err := s.Users.UpdateOne(ctx, filter, update)
	return err
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

// sendCongratulationNotification sends a push notification when a congratulation is created
func (s *Service) sendCongratulationNotification(receiverID primitive.ObjectID, senderName, taskName, congratulationText, congratulationType string) error {
	if s.Users == nil {
		return fmt.Errorf("users collection not available")
	}

	ctx := context.Background()

	// Get receiver's push token
	var receiver types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": receiverID}).Decode(&receiver)
	if err != nil {
		return fmt.Errorf("failed to get receiver user: %w", err)
	}

	if receiver.PushToken == "" {
		slog.Warn("Receiver has no push token", "receiver_id", receiverID)
		return nil // Not an error, just no notification sent
	}

	var message string
	var notification xutils.Notification

	// Check if it's an image congratulation
	if congratulationType == "image" {
		message = fmt.Sprintf("%s has sent you a congratulation image on %s", senderName, taskName)
		notification = xutils.Notification{
			Token:    receiver.PushToken,
			Title:    "New Congratulation!",
			Message:  message,
			ImageURL: congratulationText, // The message field contains the image URL for type="image"
			Data: map[string]string{
				"type":         "congratulation",
				"sender_name":  senderName,
				"task_name":    taskName,
				"message_text": congratulationText,
			},
		}
	} else {
		message = fmt.Sprintf("%s has sent you a congratulation on %s \"%s\"", senderName, taskName, congratulationText)
		notification = xutils.Notification{
			Token:   receiver.PushToken,
			Title:   "New Congratulation!",
			Message: message,
			// No ImageURL for text congratulations
			Data: map[string]string{
				"type":         "congratulation",
				"sender_name":  senderName,
				"task_name":    taskName,
				"message_text": congratulationText,
			},
		}
	}

	return xutils.SendNotification(notification)
}
