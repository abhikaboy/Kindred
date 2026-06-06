package encouragement

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// newService receives the map of collections and picks out encouragements
func newService(collections map[string]*mongo.Collection, ringService *rings.RingService) *Service {
	encouragements := collections["encouragements"]
	users := collections["users"]
	categories := collections["categories"]

	// Log if collections are not found
	if encouragements == nil {
		slog.Error("Encouragements collection not found in database")
	}
	if users == nil {
		slog.Error("Users collection not found in database")
	}
	if categories == nil {
		slog.Error("Categories collection not found in database")
	}

	return &Service{
		Encouragements:      encouragements,
		Users:               users,
		Categories:          categories,
		NotificationService: notifications.NewNotificationService(collections),
		RingService:         ringService,
	}
}

// NewEncouragementService is a public constructor for external packages
func NewEncouragementService(collections map[string]*mongo.Collection) *Service {
	return newService(collections, nil)
}

// GetAllEncouragements fetches all Encouragement documents from MongoDB for a specific receiver
func (s *Service) GetAllEncouragements(receiverID primitive.ObjectID) ([]EncouragementDocument, error) {
	if s.Encouragements == nil {
		return nil, fmt.Errorf("encouragements collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"receiver": receiverID}

	cursor, err := s.Encouragements.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var internalResults []EncouragementDocumentInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal documents to API documents
	results := make([]EncouragementDocument, len(internalResults))
	for i, internal := range internalResults {
		apiDoc := internal.ToAPI()
		// DEBUG: Log the conversion to see what's happening
		slog.Info("Converting encouragement to API format",
			"id", internal.ID.Hex(),
			"scope", internal.Scope,
			"categoryName", internal.CategoryName,
			"taskName", internal.TaskName,
			"api_categoryName", apiDoc.CategoryName,
			"api_taskName", apiDoc.TaskName)
		results[i] = *apiDoc
	}

	return results, nil
}

// GetEncouragementByID returns a single Encouragement document by its ObjectID
func (s *Service) GetEncouragementByID(id primitive.ObjectID) (*EncouragementDocument, error) {
	if s.Encouragements == nil {
		return nil, fmt.Errorf("encouragements collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": id}

	var internalEncouragement EncouragementDocumentInternal
	err := s.Encouragements.FindOne(ctx, filter).Decode(&internalEncouragement)

	if err == mongo.ErrNoDocuments {
		// No matching Encouragement found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return internalEncouragement.ToAPI(), nil
}

// GetEncouragementsByTaskAndReceiver fetches all encouragements for a specific task and receiver
func (s *Service) GetEncouragementsByTaskAndReceiver(taskID, receiverID primitive.ObjectID) ([]EncouragementDocumentInternal, error) {
	if s.Encouragements == nil {
		return nil, fmt.Errorf("encouragements collection not available")
	}

	ctx := context.Background()
	filter := bson.M{
		"taskId":   taskID,
		"receiver": receiverID,
	}

	cursor, err := s.Encouragements.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []EncouragementDocumentInternal
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// CreateEncouragement atomically decrements the sender's balance, inserts the
// encouragement, and (for task scope) records a TaskKudos on the embedded task.
// A missing task is non-fatal: the push is skipped and the transaction commits.
// Notifications and ring deltas remain best-effort, after commit.
func (s *Service) CreateEncouragement(r *EncouragementDocumentInternal) (*EncouragementDocument, error) {
	if s.Encouragements == nil {
		return nil, fmt.Errorf("encouragements collection not available")
	}
	if s.Users == nil {
		return nil, fmt.Errorf("users collection not available")
	}

	ctx := context.Background()

	encouragement := EncouragementDocumentInternal{
		ID:           primitive.NewObjectID(),
		Sender:       r.Sender,
		Receiver:     r.Receiver,
		Message:      r.Message,
		Timestamp:    time.Now(),
		Scope:        r.Scope,
		CategoryName: r.CategoryName,
		TaskName:     r.TaskName,
		TaskID:       r.TaskID,
		Read:         false, // Default to unread
		Type:         r.Type,
	}

	client := s.Encouragements.Database().Client()
	session, err := client.StartSession()
	if err != nil {
		return nil, fmt.Errorf("failed to start session: %w", err)
	}
	defer session.EndSession(ctx)

	_, err = session.WithTransaction(ctx, func(sessCtx mongo.SessionContext) (interface{}, error) {
		// 1. Balance check inside the transaction.
		var u struct {
			Encouragements int `bson:"encouragements"`
		}
		if err := s.Users.FindOne(sessCtx, bson.M{"_id": r.Sender.ID}).Decode(&u); err != nil {
			return nil, err
		}
		if u.Encouragements <= 0 {
			return nil, fmt.Errorf("insufficient encouragement balance: user has %d encouragements remaining", u.Encouragements)
		}

		// 2. Decrement balance + increment sent-count.
		if _, err := s.Users.UpdateOne(sessCtx,
			bson.M{"_id": r.Sender.ID},
			bson.M{"$inc": bson.M{
				"encouragements":              -1,
				"kudosRewards.encouragements": 1,
			}},
		); err != nil {
			return nil, err
		}

		// 3. Insert the encouragement document.
		if _, err := s.Encouragements.InsertOne(sessCtx, encouragement); err != nil {
			return nil, err
		}

		// 4. Task scope: push a self-contained kudos onto the embedded task.
		//    Missing task (matchedCount == 0) is logged and skipped, not fatal.
		if encouragement.Scope == "task" && !encouragement.TaskID.IsZero() && s.Categories != nil {
			kudos := types.TaskKudos{
				EncouragementID: encouragement.ID,
				Sender: types.KudosSender{
					ID:     r.Sender.ID,
					Handle: r.Sender.Handle,
					Name:   r.Sender.Name,
					Icon:   r.Sender.Picture,
				},
				Message:   encouragement.Message,
				Timestamp: encouragement.Timestamp,
				Type:      encouragement.Type,
			}
			res, err := s.Categories.UpdateOne(sessCtx,
				bson.M{"tasks._id": encouragement.TaskID},
				bson.M{"$push": bson.M{"tasks.$[t].encouragements": kudos}},
				options.Update().SetArrayFilters(options.ArrayFilters{
					Filters: bson.A{bson.M{"t._id": encouragement.TaskID}},
				}),
			)
			if err != nil {
				return nil, err
			}
			if res.MatchedCount == 0 {
				slog.Warn("encouraged task not found; skipping task kudos push", "taskId", encouragement.TaskID.Hex())
			}
		}

		return nil, nil
	})
	if err != nil {
		return nil, err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Encouragement inserted", slog.String("id", encouragement.ID.Hex()))

	// Best-effort side effects after commit (unchanged behavior).
	if err := s.sendEncouragementNotification(r.Receiver, r.Sender.Name, r.TaskName, r.Message, r.Type, r.Scope, r.TaskID); err != nil {
		slog.Error("Failed to send encouragement notification", "error", err, "receiver_id", r.Receiver)
	}

	var notificationContent string
	var referenceID primitive.ObjectID
	if r.Scope == "profile" {
		notificationContent = fmt.Sprintf("%s says: \"%s\"", r.Sender.Name, r.Message)
	} else {
		notificationContent = fmt.Sprintf("%s on \"%s\": \"%s\"", r.Sender.Name, r.TaskName, r.Message)
		referenceID = r.TaskID
	}
	if err := s.NotificationService.CreateNotification(r.Sender.ID, r.Receiver, notificationContent, notifications.NotificationTypeEncouragement, referenceID); err != nil {
		slog.Error("Failed to create encouragement notification in database", "error", err, "receiver_id", r.Receiver)
	}

	return encouragement.ToAPI(), nil
}

// UpdatePartialEncouragement updates only specified fields of an Encouragement document by ObjectID.
func (s *Service) UpdatePartialEncouragement(id primitive.ObjectID, updated UpdateEncouragementDocument) error {
	if s.Encouragements == nil {
		return fmt.Errorf("encouragements collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Encouragements.UpdateOne(ctx, filter, update)
	return err
}

// DeleteEncouragement removes an Encouragement document by ObjectID.
func (s *Service) DeleteEncouragement(id primitive.ObjectID) error {
	if s.Encouragements == nil {
		return fmt.Errorf("encouragements collection not available")
	}

	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Encouragements.DeleteOne(ctx, filter)
	return err
}

// MarkEncouragementsAsRead marks multiple encouragements as read
func (s *Service) MarkEncouragementsAsRead(ids []primitive.ObjectID) (int64, error) {
	if s.Encouragements == nil {
		return 0, fmt.Errorf("encouragements collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": bson.M{"$in": ids}}
	update := bson.M{"$set": bson.M{"read": true}}

	result, err := s.Encouragements.UpdateMany(ctx, filter, update)
	if err != nil {
		return 0, err
	}

	return result.ModifiedCount, nil
}

// GetUserBalance fetches the encouragement balance for a specific user
func (s *Service) GetUserBalance(userID primitive.ObjectID) (int, error) {
	if s.Users == nil {
		return 0, fmt.Errorf("users collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": userID}

	var user struct {
		Encouragements int `bson:"encouragements"`
	}

	err := s.Users.FindOne(ctx, filter, nil).Decode(&user)
	if err != nil {
		return 0, err
	}

	return user.Encouragements, nil
}

// DecrementUserBalance decrements the encouragement balance for a specific user
func (s *Service) DecrementUserBalance(userID primitive.ObjectID) error {
	if s.Users == nil {
		return fmt.Errorf("users collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": userID}
	update := bson.M{"$inc": bson.M{
		"encouragements":              -1, // Decrement balance
		"kudosRewards.encouragements": 1,  // Increment sent count for rewards
	}}

	_, err := s.Users.UpdateOne(ctx, filter, update)
	return err
}

// GetSenderInfo fetches sender information from the users collection
func (s *Service) GetSenderInfo(senderID primitive.ObjectID) (*EncouragementSenderInternal, error) {
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

	return &EncouragementSenderInternal{
		Name:    user.DisplayName,
		Picture: user.ProfilePicture,
		ID:      user.ID,
		Handle:  user.Handle,
	}, nil
}

// sendEncouragementNotification sends a push notification when an encouragement is created
func (s *Service) sendEncouragementNotification(receiverID primitive.ObjectID, senderName, taskName, encouragementText, encouragementType, scope string, taskID primitive.ObjectID) error {
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

	// Handle profile-level encouragements
	if scope == "profile" {
		data := map[string]string{
			"type":         "encouragement",
			"scope":        "profile",
			"sender_name":  senderName,
			"message_text": encouragementText,
		}
		if encouragementType == "image" {
			message = fmt.Sprintf("%s is rooting for you!", senderName)
			notification = xutils.Notification{
				Token:    receiver.PushToken,
				Title:    "You've got a fan!",
				Message:  message,
				ImageURL: encouragementText, // The message field contains the image URL for type="image"
				Data:     data,
			}
		} else {
			message = fmt.Sprintf("%s says: \"%s\"", senderName, encouragementText)
			notification = xutils.Notification{
				Token:   receiver.PushToken,
				Title:   "You've got a fan!",
				Message: message,
				Data:    data,
			}
		}
	} else {
		// Task-level encouragements
		data := map[string]string{
			"type":         "encouragement",
			"scope":        "task",
			"sender_name":  senderName,
			"task_name":    taskName,
			"message_text": encouragementText,
		}
		if !taskID.IsZero() {
			data["task_id"] = taskID.Hex()
		}
		if encouragementType == "image" {
			message = fmt.Sprintf("%s is cheering you on for \"%s\"!", senderName, taskName)
			notification = xutils.Notification{
				Token:    receiver.PushToken,
				Title:    "Someone believes in you!",
				Message:  message,
				ImageURL: encouragementText, // The message field contains the image URL for type="image"
				Data:     data,
			}
		} else {
			message = fmt.Sprintf("%s on \"%s\": \"%s\"", senderName, taskName, encouragementText)
			notification = xutils.Notification{
				Token:   receiver.PushToken,
				Title:   "Someone believes in you!",
				Message: message,
				// No ImageURL for text encouragements
				Data: data,
			}
		}
	}

	return xutils.SendNotification(notification)
}

// NotifyEncouragersOfCompletion sends push notifications to all users who encouraged a specific task
func (s *Service) NotifyEncouragersOfCompletion(taskID, taskOwnerID primitive.ObjectID, taskName string) error {
	// Get all encouragements for this task
	encouragements, err := s.GetEncouragementsByTaskAndReceiver(taskID, taskOwnerID)
	if err != nil {
		return fmt.Errorf("failed to get encouragements: %w", err)
	}

	if len(encouragements) == 0 {
		slog.Info("No encouragements found for completed task", "task_id", taskID)
		return nil
	}

	ctx := context.Background()

	// Get task owner's display name
	var taskOwner types.User
	err = s.Users.FindOne(ctx, bson.M{"_id": taskOwnerID}).Decode(&taskOwner)
	if err != nil {
		return fmt.Errorf("failed to get task owner: %w", err)
	}

	// Track unique encouragers (in case someone sent multiple encouragements)
	notifiedEncouragers := make(map[primitive.ObjectID]bool)

	for _, encouragement := range encouragements {
		encouragerID := encouragement.Sender.ID

		// Skip if we already notified this encourager
		if notifiedEncouragers[encouragerID] {
			continue
		}

		// Get encourager's push token
		var encourager types.User
		err := s.Users.FindOne(ctx, bson.M{"_id": encouragerID}).Decode(&encourager)
		if err != nil {
			slog.Error("Failed to get encourager user", "encourager_id", encouragerID, "error", err)
			continue
		}

		if encourager.PushToken == "" {
			slog.Warn("Encourager has no push token", "encourager_id", encouragerID)
			continue
		}

		// Send notification
		message := fmt.Sprintf("%s finished \"%s\" - your encouragement paid off!", taskOwner.DisplayName, taskName)

		notification := xutils.Notification{
			Token:   encourager.PushToken,
			Title:   "They did it! 🎉",
			Message: message,
			Data: map[string]string{
				"type":          "task_completion",
				"task_owner_id": taskOwnerID.Hex(),
				"task_owner":    taskOwner.DisplayName,
				"task_name":     taskName,
				"task_id":       taskID.Hex(),
			},
		}

		err = xutils.SendNotification(notification)
		if err != nil {
			slog.Error("Failed to send completion notification to encourager",
				"encourager_id", encouragerID,
				"task_id", taskID,
				"error", err)
			continue
		}

		slog.Info("Sent task completion notification to encourager",
			"encourager_id", encouragerID,
			"task_id", taskID,
			"task_name", taskName)

		notifiedEncouragers[encouragerID] = true
	}

	slog.Info("Notified encouragers of task completion",
		"task_id", taskID,
		"encouragers_notified", len(notifiedEncouragers))

	return nil
}
