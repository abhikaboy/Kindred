package types

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreditType represents the type of credit being consumed
type CreditType string

const (
	CreditTypeVoice     CreditType = "voice"
	CreditTypeBlueprint CreditType = "blueprint"
	CreditTypeGroup     CreditType = "group"
	CreditTypeAnalytics CreditType = "analytics"
)

// Default credit amounts for new users
const (
	DefaultVoiceCredits     = 10
	DefaultBlueprintCredits = 5
	DefaultGroupCredits     = 3
	DefaultAnalyticsCredits = 0
)

var (
	ErrInsufficientCredits = errors.New("insufficient credits")
	ErrInvalidCreditType   = errors.New("invalid credit type")
)

// GetDefaultCredits returns the default credits for a new user
func GetDefaultCredits() UserCredits {
	return UserCredits{
		Voice:     DefaultVoiceCredits,
		Blueprint: DefaultBlueprintCredits,
		Group:     DefaultGroupCredits,
		Analytics: DefaultAnalyticsCredits,
	}
}

// ConsumeCredit atomically decrements a credit and returns error if insufficient
// This ensures thread-safe credit consumption
func ConsumeCredit(ctx context.Context, collection *mongo.Collection, userID primitive.ObjectID, creditType CreditType) error {
	// Map credit type to field name
	fieldName, err := getCreditFieldName(creditType)
	if err != nil {
		return err
	}

	// Atomic operation: decrement only if credit > 0
	result := collection.FindOneAndUpdate(
		ctx,
		bson.M{
			"_id":     userID,
			fieldName: bson.M{"$gt": 0}, // Only if credits > 0
		},
		bson.M{
			"$inc": bson.M{fieldName: -1}, // Decrement by 1
		},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	)

	var user User
	if err := result.Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			return ErrInsufficientCredits
		}
		return err
	}

	return nil
}

// AddCredits atomically adds credits to a user's account
func AddCredits(ctx context.Context, collection *mongo.Collection, userID primitive.ObjectID, creditType CreditType, amount int) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	fieldName, err := getCreditFieldName(creditType)
	if err != nil {
		return err
	}

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{
			"$inc": bson.M{fieldName: amount},
		},
	)

	return err
}

// GetCredits retrieves the current credit balance for a user
func GetCredits(ctx context.Context, collection *mongo.Collection, userID primitive.ObjectID) (*UserCredits, error) {
	var user User
	err := collection.FindOne(
		ctx,
		bson.M{"_id": userID},
		options.FindOne().SetProjection(bson.M{"credits": 1}),
	).Decode(&user)

	if err != nil {
		return nil, err
	}

	return &user.Credits, nil
}

// CheckCredits checks if user has at least 1 credit of the specified type
func CheckCredits(ctx context.Context, collection *mongo.Collection, userID primitive.ObjectID, creditType CreditType) (bool, error) {
	fieldName, err := getCreditFieldName(creditType)
	if err != nil {
		return false, err
	}

	count, err := collection.CountDocuments(
		ctx,
		bson.M{
			"_id":     userID,
			fieldName: bson.M{"$gt": 0},
		},
	)

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// getCreditFieldName returns the BSON field name for a credit type
func getCreditFieldName(creditType CreditType) (string, error) {
	switch creditType {
	case CreditTypeVoice:
		return "credits.voice", nil
	case CreditTypeBlueprint:
		return "credits.blueprint", nil
	case CreditTypeGroup:
		return "credits.group", nil
	case CreditTypeAnalytics:
		return "credits.analytics", nil
	default:
		return "", ErrInvalidCreditType
	}
}

// InitializeCredits sets default credits for a user (used during registration)
func InitializeCredits(user *User) {
	user.Credits = GetDefaultCredits()
}
