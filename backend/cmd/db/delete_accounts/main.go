package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

/*
Deletes user accounts by _id, reusing the exact same logic as the
DELETE /v1/user/account endpoint (auth.Service.DeleteAccount): removes the
user from friends lists, deletes connection/category/template-task documents,
then deletes the user document itself.

Usage:

	go run cmd/db/delete_accounts/main.go            # dry-run (default)
	go run cmd/db/delete_accounts/main.go --execute  # actually delete

The target IDs are listed in targetIDs below.
*/

var targetIDs = []string{
	"68f14e222ebca44addd42a88",
	"68e569fff8ceb78a257d9a12",
	"691557d820ae435a4f959111",
	"6993fd381b8da6ade8f784d2",
	"69c365337bfd91d5f48bdb38",
	"69d848e328df76d34dff16d4",
	"6a07c624e417c05b780cb2e5",
}

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

	execute := len(os.Args) > 1 && os.Args[1] == "--execute"
	if !execute {
		slog.LogAttrs(ctx, slog.LevelInfo, "DRY-RUN mode - no changes will be made (pass --execute to delete)")
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Targeting cluster",
		slog.String("cluster", cfg.Atlas.Cluster),
		slog.String("environment", cfg.Atlas.Environment))

	service := auth.NewServiceWithConfig(db.Collections, cfg)
	usersCollection := db.Collections["users"]

	deleted := 0
	for _, idHex := range targetIDs {
		id, err := primitive.ObjectIDFromHex(idHex)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Invalid ObjectID, skipping",
				slog.String("id", idHex), xslog.Error(err))
			continue
		}

		// Confirm the user exists and log who it is before acting.
		var user struct {
			ID          primitive.ObjectID `bson:"_id"`
			DisplayName string             `bson:"display_name"`
			Handle      string             `bson:"handle"`
			Email       string             `bson:"email"`
		}
		err = usersCollection.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
		if err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "User not found, skipping",
				slog.String("id", idHex), xslog.Error(err))
			continue
		}

		slog.LogAttrs(ctx, slog.LevelInfo, "Found user",
			slog.String("id", idHex),
			slog.String("display_name", user.DisplayName),
			slog.String("handle", user.Handle),
			slog.String("email", user.Email))

		if !execute {
			slog.LogAttrs(ctx, slog.LevelInfo, "DRY-RUN: would delete account", slog.String("id", idHex))
			continue
		}

		if err := service.DeleteAccount(ctx, id); err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to delete account",
				slog.String("id", idHex), xslog.Error(err))
			continue
		}

		slog.LogAttrs(ctx, slog.LevelInfo, "Deleted account", slog.String("id", idHex))
		deleted++
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Done",
		slog.Int("requested", len(targetIDs)),
		slog.Int("deleted", deleted),
		slog.Bool("execute", execute))
}

func fatal(ctx context.Context, msg string, err error) {
	slog.LogAttrs(ctx, slog.LevelError, msg, xslog.Error(err))
	os.Exit(1)
}
