package types

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// GetDefaultSubscription returns the default free tier subscription for new users
func GetDefaultSubscription() Subscription {
	now := time.Now()
	return Subscription{
		Tier:      TierFree,
		Status:    StatusActive,
		StartDate: now,
	}
}

// IsActive checks if the subscription is currently active
func (s *Subscription) IsActive() bool {
	if s.Status != StatusActive && s.Status != StatusTrial && s.Status != StatusCanceled {
		return false
	}

	// Check if subscription has expired
	if s.EndDate != nil && time.Now().After(*s.EndDate) {
		return false
	}

	return true
}

// IsPremiumTier checks if the subscription is Premium or Lifetime
func (s *Subscription) IsPremiumTier() bool {
	return s.Tier == TierPremium || s.Tier == TierLifetime
}

// HasUnlimitedCredits checks if the user has unlimited credits based on their subscription
func (s *Subscription) HasUnlimitedCredits() bool {
	return s.IsActive() && s.IsPremiumTier()
}

// GetCreditMultiplier returns the credit multiplier based on subscription tier
// Free: 1x, Basic: 2x, Premium/Lifetime: unlimited (represented as 0)
func (s *Subscription) GetCreditMultiplier() float64 {
	if !s.IsActive() {
		return 1.0
	}

	switch s.Tier {
	case TierBasic:
		return 2.0
	case TierPremium, TierLifetime:
		return 0.0 // 0 indicates unlimited
	default:
		return 1.0
	}
}

// SubscriptionFeatures represents what features are available for each tier
type SubscriptionFeatures struct {
	UnlimitedVoice           bool
	UnlimitedNaturalLanguage bool
	UnlimitedGroups          bool
	UnlimitedAnalytics       bool
	NoAds                    bool
	PrioritySupport          bool
	CreditMultiplier         float64
}

// GetFeatures returns the features available for this subscription
func (s *Subscription) GetFeatures() SubscriptionFeatures {
	if !s.IsActive() {
		return SubscriptionFeatures{
			CreditMultiplier: 1.0,
		}
	}

	switch s.Tier {
	case TierBasic:
		return SubscriptionFeatures{
			UnlimitedVoice:           false,
			UnlimitedNaturalLanguage: false,
			UnlimitedGroups:          false,
			UnlimitedAnalytics:       false,
			NoAds:                    true,
			PrioritySupport:          false,
			CreditMultiplier:         2.0,
		}
	case TierPremium, TierLifetime:
		return SubscriptionFeatures{
			UnlimitedVoice:           true,
			UnlimitedNaturalLanguage: true,
			UnlimitedGroups:          true,
			UnlimitedAnalytics:       true,
			NoAds:                    true,
			PrioritySupport:          true,
			CreditMultiplier:         0.0, // Unlimited
		}
	default: // TierFree
		return SubscriptionFeatures{
			CreditMultiplier: 1.0,
		}
	}
}

// UpdateSubscription updates a user's subscription in the database
func UpdateSubscription(ctx context.Context, userCollection *mongo.Collection, userID primitive.ObjectID, subscription Subscription) error {
	_, err := userCollection.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"subscription": subscription}},
	)
	return err
}

// GetUserSubscription retrieves a user's subscription from the database
func GetUserSubscription(ctx context.Context, userCollection *mongo.Collection, userID primitive.ObjectID) (*Subscription, error) {
	var user struct {
		Subscription Subscription `bson:"subscription"`
	}

	err := userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return nil, err
	}

	return &user.Subscription, nil
}

// UpgradeSubscription upgrades a user to a new subscription tier
func UpgradeSubscription(
	ctx context.Context,
	userCollection *mongo.Collection,
	userID primitive.ObjectID,
	tier SubscriptionTier,
	provider SubscriptionProvider,
	subscriptionID string,
) error {
	now := time.Now()

	// Calculate renewal date (30 days from now for monthly subscriptions)
	var renewalDate *time.Time
	if tier != TierLifetime {
		renewal := now.AddDate(0, 1, 0) // Add 1 month
		renewalDate = &renewal
	}

	subscription := Subscription{
		Tier:           tier,
		Status:         StatusActive,
		StartDate:      now,
		RenewalDate:    renewalDate,
		Provider:       provider,
		SubscriptionID: subscriptionID,
	}

	return UpdateSubscription(ctx, userCollection, userID, subscription)
}

// CancelSubscription cancels a user's subscription but keeps it active until end date
func CancelSubscription(ctx context.Context, userCollection *mongo.Collection, userID primitive.ObjectID) error {
	subscription, err := GetUserSubscription(ctx, userCollection, userID)
	if err != nil {
		return err
	}

	now := time.Now()
	subscription.Status = StatusCanceled
	subscription.CanceledAt = &now

	// Set end date to renewal date if not already set
	if subscription.EndDate == nil && subscription.RenewalDate != nil {
		subscription.EndDate = subscription.RenewalDate
	}

	return UpdateSubscription(ctx, userCollection, userID, *subscription)
}

// ExpireSubscription marks a subscription as expired and downgrades to free tier
func ExpireSubscription(ctx context.Context, userCollection *mongo.Collection, userID primitive.ObjectID) error {
	now := time.Now()
	subscription := Subscription{
		Tier:      TierFree,
		Status:    StatusActive,
		StartDate: now,
	}

	return UpdateSubscription(ctx, userCollection, userID, subscription)
}

// RenewSubscription renews a subscription for another billing period
func RenewSubscription(ctx context.Context, userCollection *mongo.Collection, userID primitive.ObjectID) error {
	subscription, err := GetUserSubscription(ctx, userCollection, userID)
	if err != nil {
		return err
	}

	now := time.Now()

	// Update renewal date to next month
	if subscription.Tier != TierLifetime {
		renewal := now.AddDate(0, 1, 0)
		subscription.RenewalDate = &renewal
	}

	// Clear canceled status and end date if renewing
	subscription.Status = StatusActive
	subscription.CanceledAt = nil
	subscription.EndDate = nil

	return UpdateSubscription(ctx, userCollection, userID, *subscription)
}

// CheckAndUpdateExpiredSubscriptions checks all subscriptions and expires those that should be expired
// This should be called periodically (e.g., daily cron job)
func CheckAndUpdateExpiredSubscriptions(ctx context.Context, userCollection *mongo.Collection) error {
	now := time.Now()

	// Find all subscriptions that should be expired
	filter := bson.M{
		"subscription.endDate": bson.M{"$lte": now},
		"subscription.status":  bson.M{"$in": []SubscriptionStatus{StatusActive, StatusTrial, StatusCanceled}},
	}

	// Update them to free tier
	_, err := userCollection.UpdateMany(
		ctx,
		filter,
		bson.M{
			"$set": bson.M{
				"subscription.tier":    TierFree,
				"subscription.status":  StatusExpired,
				"subscription.endDate": now,
			},
		},
	)

	return err
}
