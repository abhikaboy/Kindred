package mongorepo

import (
	"context"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type userRepo struct {
	collection *mongo.Collection
}

func NewUserRepository(coll *mongo.Collection) repository.UserRepository {
	return &userRepo{collection: coll}
}

func (r *userRepo) GetUserByID(ctx context.Context, id primitive.ObjectID) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "_id", id)
}

func (r *userRepo) GetUserByEmail(ctx context.Context, email string) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "email", email)
}

func (r *userRepo) GetUserByPhone(ctx context.Context, phone string) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "phone", phone)
}

func (r *userRepo) GetUserByGoogleID(ctx context.Context, googleID string) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "google_id", googleID)
}

func (r *userRepo) GetUserByAppleID(ctx context.Context, appleID string) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "apple_id", appleID)
}

func (r *userRepo) CreateUser(ctx context.Context, user *types.User) error {
	_, err := r.collection.InsertOne(ctx, user)
	return err
}

func (r *userRepo) UpdateUser(ctx context.Context, id primitive.ObjectID, update bson.M) error {
	return updateOneByID(ctx, r.collection, id, bson.M{"$set": update})
}

func (r *userRepo) DeleteUser(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *userRepo) GetUsersWithPushTokens(ctx context.Context) ([]types.User, error) {
	return findMany[types.User](ctx, r.collection, bson.M{
		"push_token": bson.M{"$ne": ""},
	})
}

func (r *userRepo) IncrementUserCount(ctx context.Context, id primitive.ObjectID) error {
	return updateOneByID(ctx, r.collection, id, bson.M{"$inc": bson.M{"count": 1}})
}

func (r *userRepo) UpdatePushToken(ctx context.Context, id primitive.ObjectID, token string) error {
	return updateOneByID(ctx, r.collection, id, bson.M{"$set": bson.M{"push_token": token}})
}

func (r *userRepo) CheckTokenCount(ctx context.Context, id primitive.ObjectID) (float64, error) {
	user, err := r.GetUserByID(ctx, id)
	if err != nil {
		return 0, err
	}
	return user.Count, nil
}

func (r *userRepo) MarkTokenUsed(ctx context.Context, id primitive.ObjectID) error {
	return updateOneByID(ctx, r.collection, id, bson.M{"$set": bson.M{"token_used": true}})
}

func (r *userRepo) CheckIfTokenUsed(ctx context.Context, id primitive.ObjectID) (bool, error) {
	user, err := r.GetUserByID(ctx, id)
	if err != nil {
		return false, err
	}
	return user.TokenUsed, nil
}

func (r *userRepo) AcceptTerms(ctx context.Context, id primitive.ObjectID, version string) (*time.Time, error) {
	now := time.Now()
	err := updateOneByID(ctx, r.collection, id, bson.M{
		"$set": bson.M{
			"terms_accepted_at": now,
			"terms_version":     version,
		},
	})
	if err != nil {
		return nil, err
	}
	return &now, nil
}

func (r *userRepo) RemoveFromFriendsLists(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.UpdateMany(ctx,
		bson.M{"friends": id},
		bson.M{"$pull": bson.M{"friends": id}},
	)
	return err
}
