package congratulation

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
)

// newService receives the map of collections and picks out congratulations
func newService(collections map[string]*mongo.Collection, ringService *rings.RingService) *Service {
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
		RingService:         ringService,
	}
}

// NewService is the exported version for testing
func NewService(collections map[string]*mongo.Collection) *Service {
	return newService(collections, nil)
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
		ThumbnailURL: r.ThumbnailURL,
		DurationMs:   r.DurationMs,
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
	videoThumb := ""
	if r.Type == "video" && r.ThumbnailURL != nil {
		videoThumb = *r.ThumbnailURL
	}
	err = s.sendCongratulationNotification(r.Receiver, r.Sender.Name, r.TaskName, r.Message, r.Type, r.PostID, videoThumb)
	if err != nil {
		// Log error but don't fail the operation since congratulation was already created
		slog.Error("Failed to send congratulation notification", "error", err, "receiver_id", r.Receiver)
	}

	// Create notification in the database with thumbnail (first image from post if available)
	notificationContent := fmt.Sprintf("%s on \"%s\": \"%s\"", r.Sender.Name, r.TaskName, r.Message)
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

	// A video kudos carries its own thumbnail; prefer it over the post image.
	if r.Type == "video" && r.ThumbnailURL != nil {
		thumbnail = *r.ThumbnailURL
	}

	// Append a denormalized kudos onto the post so cards can render the
	// congratulator cluster (and the in-thread kudos) without a join.
	// Best-effort: a missing post or failed update is logged, not fatal.
	if r.PostID != nil && !r.PostID.IsZero() && s.Posts != nil {
		kudos := types.PostKudos{
			CongratulationID: id,
			Sender: types.KudosSender{
				ID:   r.Sender.ID,
				Name: r.Sender.Name,
				Icon: r.Sender.Picture,
			},
			Message:      r.Message,
			Timestamp:    congratulation.Timestamp,
			Type:         r.Type,
			ThumbnailURL: r.ThumbnailURL,
			DurationMs:   r.DurationMs,
			Private:      r.Private,
		}
		if _, err := s.Posts.UpdateOne(ctx, bson.M{"_id": r.PostID}, bson.M{"$push": bson.M{"kudos": kudos}}); err != nil {
			slog.Error("Failed to append kudos to post", "error", err, "post_id", r.PostID.Hex())
		}
	}

	// ReferenceID points to the post the congratulation is on (if any) so tapping the notification
	// opens that post. Congratulations without a post (no current backend path produces this,
	// but the field is optional) get a zero referenceID and the frontend will fall back.
	var referenceID primitive.ObjectID
	if r.PostID != nil && !r.PostID.IsZero() {
		referenceID = *r.PostID
	}
	_ = id // congratulation document ID; not used as referenceID — see comment above
	err = s.NotificationService.CreateNotification(r.Sender.ID, r.Receiver, notificationContent, notifications.NotificationTypeCongratulation, referenceID, thumbnail)
	if err != nil {
		// Log error but don't fail the operation since congratulation was already created
		slog.Error("Failed to create congratulation notification in database", "error", err, "receiver_id", r.Receiver)
	}

	return congratulation.ToAPI(), nil
}

// ToggleReaction sets, replaces, or removes the receiver's reaction on a congratulation.
// The filter binds _id + receiver, so anyone but the receiver gets mongo.ErrNoDocuments.
// Returns the reaction state after the toggle (nil when removed).
func (s *Service) ToggleReaction(id, receiverID primitive.ObjectID, emoji string) (*string, error) {
	if s.Congratulations == nil {
		return nil, fmt.Errorf("congratulations collection not available")
	}

	ctx := context.Background()
	filter := bson.M{"_id": id, "receiver": receiverID}

	var current CongratulationDocumentInternal
	if err := s.Congratulations.FindOne(ctx, filter).Decode(&current); err != nil {
		return nil, err
	}

	// Same emoji again → toggle off. Removal never notifies.
	if current.Reaction != nil && *current.Reaction == emoji {
		if _, err := s.Congratulations.UpdateOne(ctx, filter, bson.M{"$unset": bson.M{"reaction": "", "reactedAt": ""}}); err != nil {
			return nil, err
		}
		return nil, nil
	}

	now := time.Now()
	if _, err := s.Congratulations.UpdateOne(ctx, filter, bson.M{"$set": bson.M{"reaction": emoji, "reactedAt": now}}); err != nil {
		return nil, err
	}

	if err := s.sendReactionNotification(&current, emoji); err != nil {
		slog.Error("Failed to send congratulation reaction notification", "error", err, "congratulation_id", id.Hex())
	}

	return &emoji, nil
}

// sendReactionNotification notifies the kudos sender when the receiver reacts: an
// in-app row on the notifications page plus a push that deep-links there.
// Works for anonymous (private) congratulations too — the sender always knew they sent it.
func (s *Service) sendReactionNotification(con *CongratulationDocumentInternal, emoji string) error {
	if s.Users == nil {
		return fmt.Errorf("users collection not available")
	}

	ctx := context.Background()

	// Image kudos carry a URL in Message — leave it out of the notification copy.
	content := fmt.Sprintf("reacted %s to your congratulations", emoji)
	if con.Message != "" && con.Type != "image" {
		content = fmt.Sprintf("%s: %q", content, con.Message)
	}
	if err := s.NotificationService.CreateNotification(con.Receiver, con.Sender.ID, content, notifications.NotificationTypeKudosReaction, con.ID); err != nil {
		slog.Error("Failed to create kudos reaction notification", "error", err, "congratulation_id", con.ID.Hex())
	}

	var sender types.User
	if err := s.Users.FindOne(ctx, bson.M{"_id": con.Sender.ID}).Decode(&sender); err != nil {
		return fmt.Errorf("failed to get kudos sender: %w", err)
	}
	if sender.PushToken == "" {
		return nil
	}

	var receiver types.User
	if err := s.Users.FindOne(ctx, bson.M{"_id": con.Receiver}).Decode(&receiver); err != nil {
		return fmt.Errorf("failed to get kudos receiver: %w", err)
	}

	return xutils.SendNotification(xutils.Notification{
		Token:   sender.PushToken,
		Title:   "Your congratulations meant something",
		Message: fmt.Sprintf("%s reacted %s", receiver.DisplayName, emoji),
		Data: map[string]string{
			"type":       "kudos_reaction",
			"kudos_type": "congratulation",
			"reaction":   emoji,
			"url":        "/feed?page=notifications",
		},
	})
}

// receiverInfoRow is the projection of the joined receiver user document.
type receiverInfoRow struct {
	ID             primitive.ObjectID `bson:"_id"`
	DisplayName    string             `bson:"display_name"`
	ProfilePicture string             `bson:"profile_picture"`
}

type sentCongratulationRow struct {
	CongratulationDocumentInternal `bson:",inline"`
	ReceiverInfo                   []receiverInfoRow `bson:"receiverInfo"`
}

// GetSentCongratulations fetches congratulations sent by senderID, joining the receiver's
// profile info (kudos documents denormalize the sender but only store the receiver's ID).
func (s *Service) GetSentCongratulations(senderID primitive.ObjectID) ([]CongratulationDocument, error) {
	if s.Congratulations == nil {
		return nil, fmt.Errorf("congratulations collection not available")
	}

	ctx := context.Background()
	pipeline := []bson.M{
		{"$match": bson.M{"sender.id": senderID}},
		{"$sort": bson.M{"timestamp": -1}},
		{"$lookup": bson.M{
			"from":         "users",
			"localField":   "receiver",
			"foreignField": "_id",
			"as":           "receiverInfo",
		}},
	}

	cursor, err := s.Congratulations.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var rows []sentCongratulationRow
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}

	results := make([]CongratulationDocument, len(rows))
	for i, row := range rows {
		doc := row.CongratulationDocumentInternal.ToAPI()
		if len(row.ReceiverInfo) > 0 {
			doc.ReceiverInfo = &CongratulationSender{
				ID:      row.ReceiverInfo[0].ID.Hex(),
				Name:    row.ReceiverInfo[0].DisplayName,
				Picture: row.ReceiverInfo[0].ProfilePicture,
			}
		}
		results[i] = *doc
	}

	return results, nil
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

// sendCongratulationNotification sends a push notification when a congratulation is created.
// postID may be nil — congratulations created outside the post flow (e.g. beak onboarding) won't carry one.
func (s *Service) sendCongratulationNotification(receiverID primitive.ObjectID, senderName, taskName, congratulationText, congratulationType string, postID *primitive.ObjectID, videoThumbnailURL string) error {
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

	data := map[string]string{
		"type":         "congratulation",
		"sender_name":  senderName,
		"task_name":    taskName,
		"message_text": congratulationText,
	}
	if postID != nil && !postID.IsZero() {
		data["post_id"] = postID.Hex()
	}

	var message string
	var notification xutils.Notification

	// Check congratulation type
	if congratulationType == "video" {
		message = fmt.Sprintf("%s sent you a video cheer for \"%s\"!", senderName, taskName)
		notification = xutils.Notification{
			Token:    receiver.PushToken,
			Title:    "You're killing it!",
			Message:  message,
			ImageURL: videoThumbnailURL, // push can't play video; show its thumbnail
			Data:     data,
		}
	} else if congratulationType == "image" {
		message = fmt.Sprintf("%s is celebrating your work on \"%s\"!", senderName, taskName)
		notification = xutils.Notification{
			Token:    receiver.PushToken,
			Title:    "You're killing it!",
			Message:  message,
			ImageURL: congratulationText, // The message field contains the image URL for type="image"
			Data:     data,
		}
	} else {
		message = fmt.Sprintf("%s on \"%s\": \"%s\"", senderName, taskName, congratulationText)
		notification = xutils.Notification{
			Token:   receiver.PushToken,
			Title:   "You're killing it!",
			Message: message,
			// No ImageURL for text congratulations
			Data: data,
		}
	}

	return xutils.SendNotification(notification)
}

// SendBeakCongratulation sends a congratulation from the beak system account
// with a push notification. Used during onboarding tutorial.
func (s *Service) SendBeakCongratulation(receiverID primitive.ObjectID, message, categoryName, taskName string) error {
	if s.Congratulations == nil {
		return fmt.Errorf("congratulations collection not available")
	}

	ctx := context.Background()

	beakID, _ := primitive.ObjectIDFromHex("67eef59f4931ee7a9fb630e5")
	beakName := "beak"
	beakPicture := "https://kindred.nyc3.digitaloceanspaces.com/profiles/67eef59f4931ee7a9fb630e5/ba16e335-bd38-4a0a-b5c0-b6e30f94b3f6.jpg"

	doc := bson.M{
		"_id": primitive.NewObjectID(),
		"sender": bson.M{
			"name":    beakName,
			"picture": beakPicture,
			"id":      beakID,
		},
		"receiver":     receiverID,
		"message":      message,
		"timestamp":    time.Now().UTC(),
		"categoryName": categoryName,
		"taskName":     taskName,
		"read":         false,
		"type":         "message",
	}

	_, err := s.Congratulations.InsertOne(ctx, doc)
	if err != nil {
		return fmt.Errorf("failed to insert beak congratulation: %w", err)
	}

	// Send push notification
	err = s.sendCongratulationNotification(receiverID, beakName, taskName, message, "message", nil, "")
	if err != nil {
		slog.Error("Failed to send beak congratulation notification", "error", err, "receiver_id", receiverID)
	}

	slog.Info("Beak congratulation sent", "receiver_id", receiverID.Hex())
	return nil
}

// GrantWelcomeCredits gives a user starter credits during onboarding.
// Uses an atomic flag (welcomeCreditsGranted) to ensure it only happens once per user.
func (s *Service) GrantWelcomeCredits(userID primitive.ObjectID) (map[string]int, error) {
	if s.Users == nil {
		return nil, fmt.Errorf("users collection not available")
	}

	credits := map[string]int{
		"voice":     5,
		"analytics": 5,
	}

	// Atomically set the flag and grant credits — only succeeds if flag is not already set
	result, err := s.Users.UpdateOne(
		context.Background(),
		bson.M{"_id": userID, "welcomeCreditsGranted": bson.M{"$ne": true}},
		bson.M{
			"$inc": bson.M{
				"credits.voice":     credits["voice"],
				"credits.analytics": credits["analytics"],
			},
			"$set": bson.M{"welcomeCreditsGranted": true},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to grant welcome credits: %w", err)
	}

	if result.ModifiedCount == 0 {
		slog.Info("Welcome credits already granted, skipping", "user_id", userID.Hex())
		return nil, nil // Already granted
	}

	slog.Info("Welcome credits granted", "user_id", userID.Hex(), "credits", credits)
	return credits, nil
}
