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
	users := collections["users"]

	// The collections map only contains what already exists in Atlas, and
	// `user_memory` is created by the productivity-agent worker on its first
	// write. Derive the handle from the database so the personalization
	// endpoints work before that has happened.
	userMemory := collections[UserMemoryCollection]
	if userMemory == nil && users != nil {
		userMemory = users.Database().Collection(UserMemoryCollection)
	}

	return &Service{
		Users:      users,
		UserMemory: userMemory,
	}
}

// NewService is the exported version for testing
func NewService(collections map[string]*mongo.Collection) *Service {
	return newService(collections)
}

// GetUserSettings retrieves settings for a user
func (s *Service) GetUserSettings(userID primitive.ObjectID) (*types.UserSettings, error) {
	ctx := context.Background()

	var user types.User
	err := s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Fill in the personalization default for accounts predating the field, so
	// the client always sees a definite answer. This is a read-time default
	// only — nothing is written back, because writing it would be a migration
	// and the whole point is that absent already means enabled.
	settings := user.Settings
	if settings.Personalization == nil {
		defaults := settings.PersonalizationOrDefault()
		settings.Personalization = &defaults
	}

	// Return user's settings (migration ensures all users have settings)
	return &settings, nil
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
		// Consent is not editable through the catch-all settings PATCH. It only
		// moves through UpdatePersonalization, so a client that echoes a stale
		// settings blob back at us can never turn personalization off — or back
		// on — by accident.
		if elem.Key == personalizationField {
			continue
		}
		prefixedFields["settings."+elem.Key] = elem.Value
	}

	if len(prefixedFields) == 0 {
		return nil
	}

	update := bson.M{"$set": prefixedFields}

	_, err = s.Users.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		return fmt.Errorf("failed to update settings: %w", err)
	}

	return nil
}
