package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
)

func main() {
	ctx := context.Background()

	only := flag.String("collections", "", "comma-separated collections to index; empty applies every index and search index")
	dryRun := flag.Bool("dry-run", false, "print the target database, existing indexes and planned indexes without applying")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		fatal(ctx, "Failed to load .env", err)
	}
	config, err := config.Load()
	if err != nil {
		fatal(ctx, "Failed to load config", err)
	}

	db, err := xmongo.New(ctx, config.Atlas)
	if err != nil {
		fatal(ctx, "Failed to connect to MongoDB in main", err)
	}

	selected := map[string]bool{}
	for _, name := range strings.Split(*only, ",") {
		if name = strings.TrimSpace(name); name != "" {
			selected[name] = true
		}
	}
	include := func(collection string) bool { return len(selected) == 0 || selected[collection] }

	if *dryRun {
		fmt.Printf("database: %s\n", db.DB.Name())
		for name := range selected {
			printExisting(ctx, db, name)
		}
		for _, index := range xmongo.Indexes {
			if include(index.Collection) {
				fmt.Printf("planned: %s %v\n", index.Collection, index.Model.Keys)
			}
		}
		return
	}

	for _, index := range xmongo.Indexes {
		if !include(index.Collection) {
			continue
		}
		if err := db.ApplyIndex(ctx, index.Collection, index.Model); err != nil {
			fatal(ctx, "Failed to apply index to collection "+index.Collection, err)
		} else {
			slog.LogAttrs(ctx, slog.LevelInfo, "Index applied to", slog.String("collection", index.Collection), slog.String("Environment", db.DB.Name()))
		}
	}

	if len(selected) > 0 {
		return
	}
	for _, index := range xmongo.SearchIndexes {
		if err := db.ApplySearchIndex(ctx, index.Collection, index.Model); err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Failed to apply search index to collection "+index.Collection, xslog.Error(err))
		} else {
			slog.LogAttrs(ctx, slog.LevelInfo, "Search index applied to", slog.String("collection", index.Collection), slog.String("Environment", db.DB.Name()))
		}
	}
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

func printExisting(ctx context.Context, db *xmongo.DB, collection string) {
	cursor, err := db.DB.Collection(collection).Indexes().List(ctx)
	if err != nil {
		fmt.Printf("existing: %s (none: %v)\n", collection, err)
		return
	}
	var specs []bson.M
	if err := cursor.All(ctx, &specs); err != nil {
		fmt.Printf("existing: %s (unreadable: %v)\n", collection, err)
		return
	}
	for _, s := range specs {
		fmt.Printf("existing: %s %v %v\n", collection, s["name"], s["key"])
	}
}
