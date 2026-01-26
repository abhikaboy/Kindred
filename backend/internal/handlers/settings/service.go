package settings

import (
	"context"
	"fmt"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Users: collections["users"],
	}
}

// GetUserSettings retrieves settings for a user
func (s *Service) GetUserSettings(userID primitive.ObjectID) (*types.UserSettings, error) {
	ctx := context.Background()

	var user types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Return user's settings (migration ensures all users have settings)
	return &user.Settings, nil
}

// UpdateUserSettings updates user settings (partial update supported)
func (s *Service) UpdateUserSettings(userID primitive.ObjectID, settings types.UserSettings) error {
	ctx := context.Background()

	// Convert settings to bson document for partial updates
	updateFields, err := xutils.ToDoc(settings)
	if err != nil {
		return fmt.Errorf("failed to convert settings: %w", err)
	}

	// Prefix all fields with "settings." for nested update
	prefixedFields := bson.M{}
	for _, elem := range *updateFields {
		prefixedFields["settings."+elem.Key] = elem.Value
	}

	update := bson.M{"$set": prefixedFields}

	_, err = s.Users.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		return fmt.Errorf("failed to update settings: %w", err)
	}

	return nil
}
