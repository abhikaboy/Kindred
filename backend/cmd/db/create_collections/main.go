package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Creates the encouragements and congratulations collections if they don't exist.
This script should be run once to set up the new collections for the encouragement
and congratulation handlers.
*/
func main() {
	ctx := context.Background()

	if err := godotenv.Load(); err != nil {
		fatal(ctx, "Failed to load .env", err)
	}

	config, err := config.Load()
	if err != nil {
		fatal(ctx, "Failed to load config", err)
	}

	db, err := xmongo.New(ctx, config.Atlas)
	if err != nil {
		fatal(ctx, "Failed to connect to MongoDB", err)
	}

	// Collections to create
	collections := []string{"encouragements", "congratulations", "notifications"}

	for _, collectionName := range collections {
		if err := createCollectionIfNotExists(ctx, db.DB, collectionName); err != nil {
			fatal(ctx, "Failed to create collection: "+collectionName, err)
		} else {
			slog.LogAttrs(ctx, slog.LevelInfo, "Collection created successfully",
				slog.String("collection", collectionName),
				slog.String("database", db.DB.Name()))
		}
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "All collections created successfully")
}

func createCollectionIfNotExists(ctx context.Context, database *mongo.Database, collectionName string) error {
	// Check if collection exists
	collections, err := database.ListCollectionNames(ctx, bson.M{"name": collectionName})
	if err != nil {
		return err
	}

	// If collection doesn't exist, create it
	if len(collections) == 0 {
		err := database.CreateCollection(ctx, collectionName)
		if err != nil {
			return err
		}
		slog.LogAttrs(ctx, slog.LevelInfo, "Created new collection", slog.String("collection", collectionName))
	} else {
		slog.LogAttrs(ctx, slog.LevelInfo, "Collection already exists", slog.String("collection", collectionName))
	}

	return nil
}

func fatal(ctx context.Context, msg string, err error) {
	slog.LogAttrs(
		ctx,
		slog.LevelError,
		msg,
		xslog.Error(err),
	)
	os.Exit(1)
}
