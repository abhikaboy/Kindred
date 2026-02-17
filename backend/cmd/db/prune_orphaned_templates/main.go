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
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Prunes orphaned template tasks from the database.
This script finds all template tasks that reference category IDs that no longer exist
and deletes them to maintain database integrity.

Usage:

	go run cmd/db/prune_orphaned_templates/main.go [--dry-run]

Flags:

	--dry-run: Show what would be deleted without actually deleting
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

	// Check for dry-run flag
	dryRun := false
	if len(os.Args) > 1 && os.Args[1] == "--dry-run" {
		dryRun = true
		slog.LogAttrs(ctx, slog.LevelInfo, "Running in DRY-RUN mode - no changes will be made")
	}

	if err := pruneOrphanedTemplates(ctx, db.DB, dryRun); err != nil {
		fatal(ctx, "Failed to prune orphaned templates", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Script completed successfully")
}

func pruneOrphanedTemplates(ctx context.Context, database *mongo.Database, dryRun bool) error {
	categoriesCollection := database.Collection("categories")
	templateTasksCollection := database.Collection("template-tasks")

	// Step 1: Get all existing category IDs
	slog.LogAttrs(ctx, slog.LevelInfo, "Fetching all category IDs...")

	cursor, err := categoriesCollection.Find(ctx, bson.M{})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	validCategoryIDs := make(map[primitive.ObjectID]bool)
	categoryCount := 0
	for cursor.Next(ctx) {
		var category struct {
			ID primitive.ObjectID `bson:"_id"`
		}
		if err := cursor.Decode(&category); err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Failed to decode category", xslog.Error(err))
			continue
		}
		validCategoryIDs[category.ID] = true
		categoryCount++
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Found valid categories", slog.Int("count", categoryCount))

	// Step 2: Get all template tasks
	slog.LogAttrs(ctx, slog.LevelInfo, "Fetching all template tasks...")

	templateCursor, err := templateTasksCollection.Find(ctx, bson.M{})
	if err != nil {
		return err
	}
	defer templateCursor.Close(ctx)

	orphanedTemplateIDs := []primitive.ObjectID{}
	totalTemplates := 0

	for templateCursor.Next(ctx) {
		var template struct {
			ID         primitive.ObjectID `bson:"_id"`
			CategoryID primitive.ObjectID `bson:"categoryID"`
			Content    string             `bson:"content"`
		}
		if err := templateCursor.Decode(&template); err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Failed to decode template", xslog.Error(err))
			continue
		}
		totalTemplates++

		// Check if the category ID exists
		if !validCategoryIDs[template.CategoryID] {
			orphanedTemplateIDs = append(orphanedTemplateIDs, template.ID)
			slog.LogAttrs(ctx, slog.LevelInfo, "Found orphaned template",
				slog.String("templateID", template.ID.Hex()),
				slog.String("categoryID", template.CategoryID.Hex()),
				slog.String("content", template.Content))
		}
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Template analysis complete",
		slog.Int("totalTemplates", totalTemplates),
		slog.Int("orphanedTemplates", len(orphanedTemplateIDs)))

	// Step 3: Delete orphaned templates (if not dry-run)
	if len(orphanedTemplateIDs) == 0 {
		slog.LogAttrs(ctx, slog.LevelInfo, "No orphaned templates found - database is clean!")
		return nil
	}

	if dryRun {
		slog.LogAttrs(ctx, slog.LevelInfo, "DRY-RUN: Would delete orphaned templates",
			slog.Int("count", len(orphanedTemplateIDs)))
		return nil
	}

	// Actually delete the orphaned templates
	filter := bson.M{"_id": bson.M{"$in": orphanedTemplateIDs}}
	result, err := templateTasksCollection.DeleteMany(ctx, filter)
	if err != nil {
		return err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Successfully deleted orphaned templates",
		slog.Int64("deletedCount", result.DeletedCount))

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
