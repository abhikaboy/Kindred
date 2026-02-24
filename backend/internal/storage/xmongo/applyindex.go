package xmongo

import (
	"context"
	"fmt"
	"log/slog"

	"go.mongodb.org/mongo-driver/mongo"
)

/*
Modify a collection by applying a schema specified in ./validations.go
pass in name of collection to apply new schema
*/
func (db *DB) ApplyIndex(ctx context.Context, name string, model mongo.IndexModel) error {
	_, err := db.DB.Collection(name).Indexes().CreateOne(context.Background(), model)

	if err != nil {
		panic(err)
	}

	slog.LogAttrs(
		ctx,
		slog.LevelDebug,
		"Index successfully applied",
		slog.String("collection_name", name),
		slog.String("database_name", db.DB.Name()),
	)

	return nil
}

func (db *DB) ApplySearchIndex(ctx context.Context, name string, model mongo.SearchIndexModel) error {
	_, err := db.DB.Collection(name).SearchIndexes().CreateOne(context.Background(), model)

	if err != nil {
		return fmt.Errorf("failed to apply search index to collection '%s' in '%s': %w", name, db.DB.Name(), err)
	}

	return nil
}
