package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
)

/*
One-off migration: adds default dashboard_configuration to all users
that don't already have it set.
*/
func main() {
	ctx := context.Background()

	if err := godotenv.Load(); err != nil {
		fatal(ctx, "Failed to load .env", err)
	}

	cfg, err := config.Load()
	if err != nil {
		fatal(ctx, "Failed to load config", err)
	}

	db, err := xmongo.New(ctx, cfg.Atlas)
	if err != nil {
		fatal(ctx, "Failed to connect to MongoDB", err)
	}

	users := db.DB.Collection("users")
	defaults := types.DefaultUserSettings().DashboardConfiguration

	// Only update users that don't have dashboard_configuration set
	filter := bson.M{
		"settings.dashboard_configuration": bson.M{"$exists": false},
	}
	update := bson.M{
		"$set": bson.M{
			"settings.dashboard_configuration": defaults,
		},
	}

	result, err := users.UpdateMany(ctx, filter, update)
	if err != nil {
		fatal(ctx, "Failed to update users", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Migration complete",
		slog.Int64("matched", result.MatchedCount),
		slog.Int64("modified", result.ModifiedCount),
	)
}

func fatal(ctx context.Context, msg string, err error) {
	slog.LogAttrs(ctx, slog.LevelError, msg, xslog.Error(err))
	os.Exit(1)
}
