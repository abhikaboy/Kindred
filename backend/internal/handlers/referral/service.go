package referral

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Referrals: collections["referrals"],
		Users:     collections["users"],
	}
}

// GenerateReferralCode creates a unique, user-friendly referral code
func (s *Service) GenerateReferralCode() (string, error) {
	// Generate 6 random bytes
	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	// Encode to base32 (human-readable) and take first 8 characters
	code := strings.ToUpper(base32.StdEncoding.EncodeToString(bytes)[:8])

	// Remove ambiguous characters (0, O, I, 1)
	code = strings.Map(func(r rune) rune {
		switch r {
		case '0', 'O':
			return '8'
		case 'I', '1':
			return '7'
		default:
			return r
		}
	}, code)

	// Check uniqueness
	ctx := context.Background()
	count, err := s.Referrals.CountDocuments(ctx, bson.M{"referralCode": code})
	if err != nil {
		return "", err
	}

	// If code exists, try again (very unlikely)
	if count > 0 {
		return s.GenerateReferralCode()
	}

	return code, nil
}

// CreateReferralDocument creates a referral document for a new user
func (s *Service) CreateReferralDocument(userID primitive.ObjectID, referredBy *primitive.ObjectID) (*ReferralDocument, error) {
	ctx := context.Background()

	code, err := s.GenerateReferralCode()
	if err != nil {
		return nil, fmt.Errorf("failed to generate referral code: %w", err)
	}

	now := time.Now()
	doc := &ReferralDocument{
		ID:               primitive.NewObjectID(),
		UserID:           userID,
		ReferralCode:     code,
		UnlocksRemaining: 0,
		ReferredUsers:    []ReferredUserInfo{},
		UnlockedFeatures: []UnlockedFeature{},
		ReferredBy:       referredBy,
		Metadata: ReferralMetadata{
			CreatedAt:     now,
			UpdatedAt:     now,
			TotalReferred: 0,
		},
	}

	_, err = s.Referrals.InsertOne(ctx, doc)
	if err != nil {
		return nil, fmt.Errorf("failed to create referral document: %w", err)
	}

	return doc, nil
}

// GetReferralByUserID fetches a user's referral document
func (s *Service) GetReferralByUserID(userID primitive.ObjectID) (*ReferralDocument, error) {
	ctx := context.Background()

	var doc ReferralDocument
	err := s.Referrals.FindOne(ctx, bson.M{"userId": userID}).Decode(&doc)
	if err != nil {
		return nil, err
	}

	return &doc, nil
}

// GetReferralByCode fetches a referral document by referral code
func (s *Service) GetReferralByCode(code string) (*ReferralDocument, error) {
	ctx := context.Background()

	var doc ReferralDocument
	err := s.Referrals.FindOne(ctx, bson.M{"referralCode": strings.ToUpper(code)}).Decode(&doc)
	if err != nil {
		return nil, err
	}

	return &doc, nil
}

// ApplyReferralCode applies a referral code for a new user
func (s *Service) ApplyReferralCode(newUserID primitive.ObjectID, referralCode string) error {
	ctx := context.Background()

	// Find referrer
	referrer, err := s.GetReferralByCode(referralCode)
	if err != nil {
		return fmt.Errorf("invalid referral code: %w", err)
	}

	// Prevent self-referral
	if referrer.UserID == newUserID {
		return fmt.Errorf("cannot refer yourself")
	}

	// Check if user was already referred
	newUserReferral, err := s.GetReferralByUserID(newUserID)
	if err != nil && err != mongo.ErrNoDocuments {
		return err
	}

	if newUserReferral != nil && newUserReferral.ReferredBy != nil {
		return fmt.Errorf("user already has a referrer")
	}

	// Get new user info
	var newUser types.User
	err = s.Users.FindOne(ctx, bson.M{"_id": newUserID}).Decode(&newUser)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}

	now := time.Now()
	referredInfo := ReferredUserInfo{
		UserID:        newUserID,
		JoinedAt:      now,
		DisplayName:   newUser.DisplayName,
		Handle:        newUser.Handle,
		RewardGranted: true,
	}

	// Update referrer's document - add referred user and increment unlocks
	_, err = s.Referrals.UpdateOne(
		ctx,
		bson.M{"_id": referrer.ID},
		bson.M{
			"$push": bson.M{"referredUsers": referredInfo},
			"$inc": bson.M{
				"unlocksRemaining":       1,
				"metadata.totalReferred": 1,
			},
			"$set": bson.M{
				"metadata.updatedAt":      now,
				"metadata.lastReferralAt": now,
			},
		},
	)
	if err != nil {
		return fmt.Errorf("failed to update referrer: %w", err)
	}

	// Update or create new user's referral document
	if newUserReferral == nil {
		_, err = s.CreateReferralDocument(newUserID, &referrer.UserID)
	} else {
		_, err = s.Referrals.UpdateOne(
			ctx,
			bson.M{"userId": newUserID},
			bson.M{
				"$set": bson.M{
					"referredBy":         referrer.UserID,
					"metadata.updatedAt": now,
				},
			},
		)
	}

	return err
}

// UnlockFeature unlocks a feature using referral credits
func (s *Service) UnlockFeature(userID primitive.ObjectID, featureID string) (*UnlockedFeature, error) {
	ctx := context.Background()

	// Get user's referral document
	referral, err := s.GetReferralByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("referral document not found: %w", err)
	}

	// Check if user has unlocks remaining
	if referral.UnlocksRemaining <= 0 {
		return nil, fmt.Errorf("no unlocks remaining")
	}

	// Check if feature is already unlocked
	for _, feature := range referral.UnlockedFeatures {
		if feature.FeatureID == featureID && feature.Active {
			return nil, fmt.Errorf("feature already unlocked")
		}
	}

	// Get feature info
	featureDef := GetFeatureDefinition(featureID)
	if featureDef == nil {
		return nil, fmt.Errorf("invalid feature ID")
	}

	now := time.Now()
	unlockedFeature := UnlockedFeature{
		FeatureID:   featureID,
		FeatureName: featureDef.Name,
		UnlockedAt:  now,
		UnlockedBy:  userID,
		Active:      true,
	}

	// Update document
	_, err = s.Referrals.UpdateOne(
		ctx,
		bson.M{"_id": referral.ID},
		bson.M{
			"$push": bson.M{"unlockedFeatures": unlockedFeature},
			"$inc":  bson.M{"unlocksRemaining": -1},
			"$set":  bson.M{"metadata.updatedAt": now},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to unlock feature: %w", err)
	}

	return &unlockedFeature, nil
}

// GetAvailableFeatures returns all available features
func GetAvailableFeatures() []FeatureDefinition {
	return []FeatureDefinition{
		{
			ID:                FeatureUnlimitedVoiceDumps,
			Name:              "Unlimited Voice Dumps",
			Description:       "Record unlimited voice notes and thoughts",
			Icon:              "microphone",
			RequiredReferrals: 1,
		},
		{
			ID:                FeaturePostingToCircles,
			Name:              "Posting to Circles",
			Description:       "Share your progress with private circles",
			Icon:              "users",
			RequiredReferrals: 1,
		},
		{
			ID:                FeatureAnalytics,
			Name:              "Analytics",
			Description:       "Access detailed productivity insights and analytics",
			Icon:              "chart",
			RequiredReferrals: 1,
		},
		{
			ID:                FeatureProfileBadge,
			Name:              "Profile Badge",
			Description:       "Show off your supporter status with a special badge",
			Icon:              "badge",
			RequiredReferrals: 1,
		},
		{
			ID:                FeatureUnlimitedGifs,
			Name:              "Unlimited GIFs",
			Description:       "Access unlimited GIF reactions and celebrations",
			Icon:              "gif",
			RequiredReferrals: 1,
		},
	}
}

// GetFeatureDefinition returns a single feature definition
func GetFeatureDefinition(featureID string) *FeatureDefinition {
	features := GetAvailableFeatures()
	for _, feature := range features {
		if feature.ID == featureID {
			return &feature
		}
	}
	return nil
}

// HasFeatureUnlocked checks if user has a feature unlocked
func (s *Service) HasFeatureUnlocked(userID primitive.ObjectID, featureID string) (bool, error) {
	referral, err := s.GetReferralByUserID(userID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return false, nil
		}
		return false, err
	}

	for _, feature := range referral.UnlockedFeatures {
		if feature.FeatureID == featureID && feature.Active {
			// Check expiration
			if feature.ExpiresAt != nil && time.Now().After(*feature.ExpiresAt) {
				return false, nil
			}
			return true, nil
		}
	}

	return false, nil
}

