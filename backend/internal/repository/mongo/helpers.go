package mongorepo

import (
	"context"
	"errors"

	"github.com/abhikaboy/Kindred/internal/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// findOneByField is the private generic helper for single-document lookups.
func findOneByField[T any](ctx context.Context, coll *mongo.Collection, field string, value any) (*T, error) {
	var result T
	err := coll.FindOne(ctx, bson.M{field: value}).Decode(&result)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, repository.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// findMany is the private generic helper for multi-document queries.
func findMany[T any](ctx context.Context, coll *mongo.Collection, filter bson.M) ([]T, error) {
	cursor, err := coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []T
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// updateOneByID updates a single document by its _id field.
func updateOneByID(ctx context.Context, coll *mongo.Collection, id any, update bson.M) error {
	_, err := coll.UpdateOne(ctx, bson.M{"_id": id}, update)
	return err
}
