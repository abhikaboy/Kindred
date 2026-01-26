package Connection

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

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Connections:         collections["friend-requests"],
		Users:               collections["users"],
		NotificationService: notifications.NewNotificationService(collections),
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
	cursor, err := s.Connections.Find(ctx, bson.M{"receiver_id": id})
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

	// Send push notification to receiver (no database notification)
	err = s.sendFriendRequestNotification(r.ReceiverID, r.Requester.ID, r.Requester.Name)
	if err != nil {
		slog.Error("Failed to send friend request notification", "error", err, "receiver_id", r.ReceiverID)
		// Don't fail the request if notification fails
	}

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

// AcceptConnection accepts a connection request and updates the relationship status
func (s *Service) AcceptConnection(connectionID, userID primitive.ObjectID) error {
	ctx := context.Background()

	// First, find the connection document to validate
	var connection ConnectionDocumentInternal
	err := s.Connections.FindOne(ctx, bson.M{"_id": connectionID}).Decode(&connection)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("connection request not found")
		}
		return err
	}

	// Verify the relationship is pending
	if connection.Status != StatusPending {
		return fmt.Errorf("connection request is not pending (status: %s)", connection.Status)
	}

	// Verify that the authenticated user is the receiver (not the requester)
	if connection.Requester.ID == userID {
		return fmt.Errorf("unauthorized: cannot accept your own connection request")
	}

	// Verify that the authenticated user is the receiver
	if connection.ReceiverID != userID {
		return fmt.Errorf("unauthorized: only the receiver can accept the connection request")
	}

	// Verify that the user is one of the participants
	isParticipant := false
	for _, participantID := range connection.Users {
		if participantID == userID {
			isParticipant = true
			break
		}
	}
	if !isParticipant {
		return fmt.Errorf("unauthorized: only participants can accept the connection request")
	}

	// Update the relationship to "friends" status with accepted timestamp
	now := time.Now()
	updateFilter := bson.M{
		"_id":    connectionID,
		"status": StatusPending, // Ensure it's still pending
	}

	update := bson.M{
		"$set": bson.M{
			"status":      StatusFriends,
			"accepted_at": now,
		},
	}

	result, err := s.Connections.UpdateOne(ctx, updateFilter, update)
	if err != nil {
		return fmt.Errorf("failed to update relationship status: %v", err)
	}

	// Check if anything was actually updated
	if result.ModifiedCount == 0 {
		return fmt.Errorf("connection request not found or already processed")
	}

	// Get the other user's ID (the requester)
	var otherUserID primitive.ObjectID
	for _, participantID := range connection.Users {
		if participantID != userID {
			otherUserID = participantID
			break
		}
	}

	// Add each user to the other's friends list
	_, err = s.Users.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$addToSet": bson.M{"friends": otherUserID}},
	)
	if err != nil {
		return fmt.Errorf("failed to add friend to user's friends list: %v", err)
	}

	_, err = s.Users.UpdateOne(
		ctx,
		bson.M{"_id": otherUserID},
		bson.M{"$addToSet": bson.M{"friends": userID}},
	)
	if err != nil {
		return fmt.Errorf("failed to add user to friend's friends list: %v", err)
	}

	// Get accepter's details for the notification
	var accepterUser struct {
		Name string `bson:"display_name"`
	}
	err = s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&accepterUser)
	if err != nil {
		slog.Error("Failed to get accepter user details for notification", "error", err, "user_id", userID)
		// Don't fail the request if we can't get user details for notification
	} else {
		// Send push notification to requester (no database notification)
		err = s.sendFriendRequestAcceptedNotification(otherUserID, userID, accepterUser.Name)
		if err != nil {
			slog.Error("Failed to send friend request accepted notification", "error", err, "requester_id", otherUserID)
			// Don't fail the request if notification fails
		}
	}

	return nil
}

// sendFriendRequestNotification sends a push notification to the receiver when a friend request is sent
func (s *Service) sendFriendRequestNotification(receiverID primitive.ObjectID, requesterID primitive.ObjectID, requesterName string) error {
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

	message := fmt.Sprintf("%s sent you a friend request", requesterName)

	notification := xutils.Notification{
		Token:   receiver.PushToken,
		Title:   "New Friend Request!",
		Message: message,
		Data: map[string]string{
			"type":           "friend_request",
			"requester_name": requesterName,
			"requester_id":   requesterID.Hex(),
		},
	}

	return xutils.SendNotification(notification)
}

func (s *Service) GetFriends(userID primitive.ObjectID) ([]types.UserExtendedReference, error) {
	ctx := context.Background()

	var friends []types.UserExtendedReference
	pipeline := bson.A{
		bson.D{{Key: "$match", Value: bson.M{"_id": userID}}},
		bson.D{{Key: "$lookup", Value: bson.M{
			"from":         "users",
			"localField":   "friends",
			"foreignField": "_id",
			"as":           "friends",
		}}},
		bson.D{{Key: "$unwind", Value: "$friends"}},
		bson.D{{Key: "$replaceRoot", Value: bson.M{
			"newRoot": "$friends",
		}}},
		bson.D{{Key: "$project", Value: bson.M{
			"_id":             1,
			"display_name":    1,
			"handle":          1,
			"profile_picture": 1,
		}}},
	}
	cursor, err := s.Users.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	if err := cursor.All(ctx, &friends); err != nil {
		return nil, err
	}

	return friends, nil
}

// sendFriendRequestAcceptedNotification sends a push notification to the requester when their friend request is accepted
func (s *Service) sendFriendRequestAcceptedNotification(requesterID primitive.ObjectID, accepterID primitive.ObjectID, accepterName string) error {
	ctx := context.Background()

	// Get requester's push token
	var requester types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": requesterID}).Decode(&requester)
	if err != nil {
		return fmt.Errorf("failed to get requester user: %w", err)
	}

	if requester.PushToken == "" {
		slog.Warn("Requester has no push token", "requester_id", requesterID)
		return nil // Not an error, just no notification sent
	}

	message := fmt.Sprintf("%s accepted your friend request", accepterName)

	notification := xutils.Notification{
		Token:   requester.PushToken,
		Title:   "Friend Request Accepted!",
		Message: message,
		Data: map[string]string{
			"type":          "friend_request_accepted",
			"accepter_name": accepterName,
			"accepter_id":   accepterID.Hex(),
		},
	}

	return xutils.SendNotification(notification)
}

// GetRelationship returns the relationship status between two users
func (s *Service) GetRelationship(userAID, userBID primitive.ObjectID) (RelationshipType, error) {
	ctx := context.Background()

	// Sort IDs to match how they're stored
	sortedIDs := SortUserIDs(userAID, userBID)

	var relationship ConnectionDocumentInternal
	err := s.Connections.FindOne(ctx, bson.M{"users": sortedIDs}).Decode(&relationship)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return RelationshipNone, nil
		}
		return RelationshipNone, err
	}

	switch relationship.Status {
	case StatusFriends:
		return RelationshipFriends, nil
	case StatusBlocked:
		return RelationshipBlocked, nil
	case StatusPending:
		// Check who is the requester to determine the relationship type
		if relationship.Requester.ID == userAID {
			return RelationshipRequestSent, nil
		}
		return RelationshipRequestReceived, nil
	default:
		return RelationshipNone, nil
	}
}

// CreateConnectionRequest creates a new pending connection request
func (s *Service) CreateConnectionRequest(requesterID, receiverID primitive.ObjectID) (*ConnectionDocument, error) {
	ctx := context.Background()

	// Sort IDs for consistent storage
	sortedIDs := SortUserIDs(requesterID, receiverID)

	// Check if relationship already exists
	existing, err := s.GetRelationship(requesterID, receiverID)
	if err != nil {
		return nil, err
	}

	if existing != RelationshipNone {
		return nil, fmt.Errorf("relationship already exists: %s", existing)
	}

	// Fetch requester details from users collection
	var requesterUser struct {
		ID             primitive.ObjectID `bson:"_id"`
		Name           string             `bson:"display_name"`
		Handle         string             `bson:"handle"`
		ProfilePicture *string            `bson:"profile_picture"`
	}

	err = s.Users.FindOne(ctx, bson.M{"_id": requesterID}).Decode(&requesterUser)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("requester user not found")
		}
		return nil, fmt.Errorf("failed to fetch requester details: %v", err)
	}

	// Create ConnectionUserInternal from fetched data
	requester := ConnectionUserInternal{
		ID:      requesterUser.ID,
		Name:    requesterUser.Name,
		Handle:  requesterUser.Handle,
		Picture: requesterUser.ProfilePicture,
	}

	// Create new relationship document
	relationship := &ConnectionDocumentInternal{
		ID:         primitive.NewObjectID(),
		Users:      sortedIDs,
		Status:     StatusPending,
		Requester:  requester,
		ReceiverID: receiverID,
		CreatedAt:  time.Now(),
		AcceptedAt: nil,
	}

	_, err = s.Connections.InsertOne(ctx, relationship)
	if err != nil {
		return nil, err
	}

	// Send push notification to receiver (no database notification)
	err = s.sendFriendRequestNotification(receiverID, requester.ID, requester.Name)
	if err != nil {
		slog.Error("Failed to send friend request notification", "error", err, "receiver_id", receiverID)
		// Don't fail the request if notification fails
	}

	return relationship.ToAPI(), nil
}

// GetPendingRequestsByReceiver gets all pending connection requests where the user is the receiver
func (s *Service) GetPendingRequestsByReceiver(userID primitive.ObjectID) ([]ConnectionDocument, error) {
	ctx := context.Background()

	// Find all pending relationships where the user is the receiver
	filter := bson.M{
		"receiver_id": userID,
		"status":      StatusPending,
	}

	cursor, err := s.Connections.Find(ctx, filter)
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

	// Convert to API documents
	results := make([]ConnectionDocument, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// BlockUser blocks a user by creating/updating a blocked relationship
func (s *Service) BlockUser(ctx context.Context, blockerID, blockedID primitive.ObjectID) error {
	sortedIDs := SortUserIDs(blockerID, blockedID)
	
	// Check if relationship already exists
	var existing ConnectionDocumentInternal
	err := s.Connections.FindOne(ctx, bson.M{"users": sortedIDs}).Decode(&existing)
	
	if err == nil {
		// Relationship exists, update to blocked
		now := time.Now()
		_, err = s.Connections.UpdateOne(
			ctx,
			bson.M{"users": sortedIDs},
			bson.M{
				"$set": bson.M{
					"status":     StatusBlocked,
					"blocker_id": blockerID,
					"updated_at": now,
				},
			},
		)
		return err
	}
	
	if err != mongo.ErrNoDocuments {
		return fmt.Errorf("failed to check existing relationship: %w", err)
	}
	
	// No relationship exists, create new blocked relationship
	now := time.Now()
	blockedRelationship := &ConnectionDocumentInternal{
		ID:        primitive.NewObjectID(),
		Users:     sortedIDs,
		Status:    StatusBlocked,
		BlockerID: &blockerID,
		CreatedAt: now,
		UpdatedAt: &now,
	}
	
	_, err = s.Connections.InsertOne(ctx, blockedRelationship)
	if err != nil {
		return fmt.Errorf("failed to create blocked relationship: %w", err)
	}
	
	slog.LogAttrs(ctx, slog.LevelInfo, "User blocked",
		slog.String("blockerId", blockerID.Hex()),
		slog.String("blockedId", blockedID.Hex()))
	
	return nil
}

// UnblockUser removes a blocked relationship
func (s *Service) UnblockUser(ctx context.Context, blockerID, blockedID primitive.ObjectID) error {
	sortedIDs := SortUserIDs(blockerID, blockedID)
	
	// Delete the blocked relationship
	result, err := s.Connections.DeleteOne(ctx, bson.M{
		"users":      sortedIDs,
		"status":     StatusBlocked,
		"blocker_id": blockerID,
	})
	
	if err != nil {
		return fmt.Errorf("failed to unblock user: %w", err)
	}
	
	if result.DeletedCount == 0 {
		return fmt.Errorf("no blocked relationship found")
	}
	
	slog.LogAttrs(ctx, slog.LevelInfo, "User unblocked",
		slog.String("blockerId", blockerID.Hex()),
		slog.String("unblockedId", blockedID.Hex()))
	
	return nil
}

// GetBlockedUsers retrieves all users blocked by the given user
func (s *Service) GetBlockedUsers(ctx context.Context, userID primitive.ObjectID) ([]ConnectionUser, error) {
	// Find all blocked relationships where this user is the blocker
	cursor, err := s.Connections.Find(ctx, bson.M{
		"status":     StatusBlocked,
		"blocker_id": userID,
	})
	
	if err != nil {
		return nil, fmt.Errorf("failed to find blocked users: %w", err)
	}
	defer cursor.Close(ctx)
	
	var blockedRelationships []ConnectionDocumentInternal
	if err := cursor.All(ctx, &blockedRelationships); err != nil {
		return nil, fmt.Errorf("failed to decode blocked relationships: %w", err)
	}
	
	// Extract the blocked user IDs
	var blockedUsers []ConnectionUser
	for _, rel := range blockedRelationships {
		// Find which user in the pair is the blocked one (not the blocker)
		var blockedUserID primitive.ObjectID
		if rel.Users[0] == userID {
			blockedUserID = rel.Users[1]
		} else {
			blockedUserID = rel.Users[0]
		}
		
		// Fetch user details
		var user struct {
			ID             primitive.ObjectID `bson:"_id"`
			DisplayName    string             `bson:"display_name"`
			Handle         string             `bson:"handle"`
			ProfilePicture *string            `bson:"profile_picture"`
		}
		
		err := s.Users.FindOne(ctx, bson.M{"_id": blockedUserID}).Decode(&user)
		if err != nil {
			slog.Warn("Failed to fetch blocked user details", "userId", blockedUserID.Hex(), "error", err)
			continue
		}
		
		blockedUsers = append(blockedUsers, ConnectionUser{
			ID:      user.ID.Hex(),
			Name:    user.DisplayName,
			Handle:  user.Handle,
			Picture: user.ProfilePicture,
		})
	}
	
	return blockedUsers, nil
}

// IsBlocked checks if userA has blocked userB or vice versa
func (s *Service) IsBlocked(ctx context.Context, userA, userB primitive.ObjectID) (bool, error) {
	sortedIDs := SortUserIDs(userA, userB)
	
	var relationship ConnectionDocumentInternal
	err := s.Connections.FindOne(ctx, bson.M{
		"users":  sortedIDs,
		"status": StatusBlocked,
	}).Decode(&relationship)
	
	if err == mongo.ErrNoDocuments {
		return false, nil
	}
	
	if err != nil {
		return false, fmt.Errorf("failed to check block status: %w", err)
	}
	
	return true, nil
}
