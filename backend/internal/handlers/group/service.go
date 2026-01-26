package Group

import (
	"context"
	"fmt"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Groups
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Groups: collections["groups"],
		Users:  collections["users"],
	}
}

// NewService is the exported version for testing
func NewService(collections map[string]*mongo.Collection) *Service {
	return newService(collections)
}

// CreateGroup adds a new Group document
func (s *Service) CreateGroup(r *types.GroupDocument) (*types.GroupDocument, error) {
	ctx := context.Background()

	// Insert the document into the collection
	result, err := s.Groups.InsertOne(ctx, r)
	if err != nil {
		return nil, err
	}

	// Cast the inserted ID to ObjectID
	id, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		return nil, fmt.Errorf("failed to convert InsertedID to ObjectID")
	}
	r.ID = id
	return r, nil
}

// GetAllGroups fetches all Group documents for a specific user
func (s *Service) GetAllGroups(userID primitive.ObjectID) ([]types.GroupDocument, error) {
	ctx := context.Background()

	// Find groups where user is creator or member
	filter := bson.M{
		"$or": []bson.M{
			{"creator": userID},
			{"members._id": userID},
		},
		"metadata.isDeleted": false,
	}

	cursor, err := s.Groups.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := []types.GroupDocument{} // Initialize as empty slice instead of nil
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetGroupByID returns a single Group document by its ObjectID
func (s *Service) GetGroupByID(id primitive.ObjectID) (*types.GroupDocument, error) {
	ctx := context.Background()
	filter := bson.M{
		"_id":                id,
		"metadata.isDeleted": false,
	}
	var group types.GroupDocument
	err := s.Groups.FindOne(ctx, filter).Decode(&group)

	if err == mongo.ErrNoDocuments {
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		return nil, err
	}

	return &group, nil
}

// UpdateGroup updates specified fields of a Group document by ObjectID
func (s *Service) UpdateGroup(id primitive.ObjectID, params UpdateGroupParams, userID primitive.ObjectID) error {
	ctx := context.Background()

	// First check if user is the creator
	group, err := s.GetGroupByID(id)
	if err != nil {
		return err
	}

	if group.Creator != userID {
		return fmt.Errorf("only the creator can update the group")
	}

	updateDoc := bson.M{
		"$set": bson.M{
			"metadata.updatedAt": time.Now(),
		},
	}

	if params.Name != nil {
		if setMap, ok := updateDoc["$set"].(bson.M); ok {
			setMap["name"] = *params.Name
		}
	}

	filter := bson.M{"_id": id}
	_, err = s.Groups.UpdateOne(ctx, filter, updateDoc)
	return err
}

// DeleteGroup soft deletes a Group document by ObjectID
func (s *Service) DeleteGroup(id primitive.ObjectID, userID primitive.ObjectID) error {
	ctx := context.Background()

	// First check if user is the creator
	group, err := s.GetGroupByID(id)
	if err != nil {
		return err
	}

	if group.Creator != userID {
		return fmt.Errorf("only the creator can delete the group")
	}

	filter := bson.M{"_id": id}
	update := bson.M{
		"$set": bson.M{
			"metadata.isDeleted": true,
			"metadata.updatedAt": time.Now(),
		},
	}

	_, err = s.Groups.UpdateOne(ctx, filter, update)
	return err
}

// AddMember adds a user to the group
func (s *Service) AddMember(groupID primitive.ObjectID, userID primitive.ObjectID, requesterID primitive.ObjectID) error {
	ctx := context.Background()

	// First check if requester is the creator
	group, err := s.GetGroupByID(groupID)
	if err != nil {
		return err
	}

	if group.Creator != requesterID {
		return fmt.Errorf("only the creator can add members")
	}

	// Check if user is already a member
	for _, member := range group.Members {
		if member.ID == userID {
			return fmt.Errorf("user is already a member of this group")
		}
	}

	// Get user info
	var user types.User
	err = s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Create user extended reference
	userRef := types.UserExtendedReferenceInternal{
		ID:             user.ID,
		DisplayName:    user.DisplayName,
		Handle:         user.Handle,
		ProfilePicture: user.ProfilePicture,
	}

	// Add user to members array
	filter := bson.M{"_id": groupID}
	update := bson.M{
		"$push": bson.M{"members": userRef},
		"$set":  bson.M{"metadata.updatedAt": time.Now()},
	}

	_, err = s.Groups.UpdateOne(ctx, filter, update)
	return err
}

// RemoveMember removes a user from the group
func (s *Service) RemoveMember(groupID primitive.ObjectID, userID primitive.ObjectID, requesterID primitive.ObjectID) error {
	ctx := context.Background()

	// First check if requester is the creator or the user themselves
	group, err := s.GetGroupByID(groupID)
	if err != nil {
		return err
	}

	if group.Creator != requesterID && userID != requesterID {
		return fmt.Errorf("only the creator or the user themselves can remove members")
	}

	// Remove user from members array
	filter := bson.M{"_id": groupID}
	update := bson.M{
		"$pull": bson.M{"members": bson.M{"_id": userID}},
		"$set":  bson.M{"metadata.updatedAt": time.Now()},
	}

	result, err := s.Groups.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.ModifiedCount == 0 {
		return fmt.Errorf("user is not a member of this group")
	}

	return nil
}

// IsUserInGroup checks if a user is a member or creator of a group
func (s *Service) IsUserInGroup(groupID primitive.ObjectID, userID primitive.ObjectID) (bool, error) {
	ctx := context.Background()

	filter := bson.M{
		"_id": groupID,
		"$or": []bson.M{
			{"creator": userID},
			{"members._id": userID},
		},
		"metadata.isDeleted": false,
	}

	count, err := s.Groups.CountDocuments(ctx, filter)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}
