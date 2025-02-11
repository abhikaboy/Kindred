package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/abhikaboy/GERM-template/internal/config"
	"github.com/abhikaboy/GERM-template/internal/storage/xmongo"
	"github.com/abhikaboy/GERM-template/internal/xslog"
	"github.com/joho/godotenv"
)

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
		fatal(ctx, "Failed to connect to MongoDB in main", err)
	}

	for _, index := range xmongo.Indexes {
		if err := db.ApplyIndex(ctx, index.Collection, index.Model); err != nil {
			fatal(ctx, "Failed to apply index to collection "+index.Collection, err)
		} else {
			slog.LogAttrs(ctx, slog.LevelInfo, "Index applied to", slog.String("collection", index.Collection), slog.String("Environment", db.DB.Name()))
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
