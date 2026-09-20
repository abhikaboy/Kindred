package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
One-off migration: derives phone_e164 and phone_hash from the existing raw
phone field on every user that has one.

Contact matching joins on phone_hash, so until this runs, users who signed up
before the hashing change are invisible to contact sync and will never trigger
a "someone you know joined" push. Safe to re-run — it only writes users whose
derived values are missing or stale.
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

	cursor, err := users.Find(ctx, bson.M{"phone": bson.M{"$gt": ""}})
	if err != nil {
		fatal(ctx, "Failed to scan users", err)
	}
	defer cursor.Close(ctx)

	var (
		writes      []mongo.WriteModel
		scanned     int
		unparseable int
	)

	for cursor.Next(ctx) {
		var doc struct {
			ID        interface{} `bson:"_id"`
			Phone     string      `bson:"phone"`
			PhoneE164 string      `bson:"phone_e164"`
			PhoneHash string      `bson:"phone_hash"`
		}
		if err := cursor.Decode(&doc); err != nil {
			fatal(ctx, "Failed to decode user", err)
		}
		scanned++

		e164 := xutils.NormalizeE164(doc.Phone)
		if e164 == "" {
			// Junk or ambiguous number — leave it alone rather than storing a
			// hash that can never match anything.
			unparseable++
			continue
		}
		hash := xutils.HashNormalizedPhone(e164)
		if doc.PhoneE164 == e164 && doc.PhoneHash == hash {
			continue
		}

		writes = append(writes, mongo.NewUpdateOneModel().
			SetFilter(bson.M{"_id": doc.ID}).
			SetUpdate(bson.M{"$set": bson.M{"phone_e164": e164, "phone_hash": hash}}))
	}
	if err := cursor.Err(); err != nil {
		fatal(ctx, "Cursor error", err)
	}

	modified := int64(0)
	if len(writes) > 0 {
		result, err := users.BulkWrite(ctx, writes)
		if err != nil {
			fatal(ctx, "Failed to write derived phone fields", err)
		}
		modified = result.ModifiedCount
	}

	// Existing settings documents predate the contact_joins preference, and a
	// missing bool decodes as false — which would silently opt every current
	// user out of the notification. Default them in, matching
	// types.DefaultUserSettings().
	prefResult, err := users.UpdateMany(ctx,
		bson.M{"settings.notifications.contact_joins": bson.M{"$exists": false}},
		bson.M{"$set": bson.M{"settings.notifications.contact_joins": true}},
	)
	if err != nil {
		fatal(ctx, "Failed to default contact_joins preference", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Backfill complete",
		slog.Int("scanned", scanned),
		slog.Int("unparseable", unparseable),
		slog.Int("queued", len(writes)),
		slog.Int64("modified", modified),
		slog.Int64("contactJoinsDefaulted", prefResult.ModifiedCount),
	)
}

func fatal(ctx context.Context, msg string, err error) {
	slog.LogAttrs(ctx, slog.LevelError, msg, xslog.Error(err))
	os.Exit(1)
}
