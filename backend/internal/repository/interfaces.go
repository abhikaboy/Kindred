package repository

import (
	"context"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserRepository interface {
	GetUserByID(ctx context.Context, id primitive.ObjectID) (*types.User, error)
	GetUserByEmail(ctx context.Context, email string) (*types.User, error)
	GetUserByPhone(ctx context.Context, phone string) (*types.User, error)
	GetUserByGoogleID(ctx context.Context, googleID string) (*types.User, error)
	GetUserByAppleID(ctx context.Context, appleID string) (*types.User, error)
	CreateUser(ctx context.Context, user *types.User) error
	UpdateUser(ctx context.Context, id primitive.ObjectID, update bson.M) error
	DeleteUser(ctx context.Context, id primitive.ObjectID) error
	GetUsersWithPushTokens(ctx context.Context) ([]types.User, error)
	IncrementUserCount(ctx context.Context, id primitive.ObjectID) error
	UpdatePushToken(ctx context.Context, id primitive.ObjectID, token string) error
	CheckTokenCount(ctx context.Context, id primitive.ObjectID) (float64, error)
	MarkTokenUsed(ctx context.Context, id primitive.ObjectID) error
	CheckIfTokenUsed(ctx context.Context, id primitive.ObjectID) (bool, error)
	AcceptTerms(ctx context.Context, id primitive.ObjectID, version string) (*time.Time, error)
	RemoveFromFriendsLists(ctx context.Context, id primitive.ObjectID) error
	ConsumeCredit(ctx context.Context, id primitive.ObjectID, creditType types.CreditType) error
	AddCredits(ctx context.Context, id primitive.ObjectID, creditType types.CreditType, amount int) error
	CheckCredits(ctx context.Context, id primitive.ObjectID, creditType types.CreditType) (bool, error)
}
