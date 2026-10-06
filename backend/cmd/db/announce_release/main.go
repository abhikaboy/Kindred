package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

/*
Sends a one-off announcement push (e.g. "a new version of Kindred is out") to
every user with a push token.

It is a dry run unless --send is passed: by default it only counts recipients
and prints the payload. Use --user to send to a single account first and check
how it renders on a real device before fanning out.

	go run ./cmd/db/announce_release --title "Kindred 2.4" --body "Plans are here."
	go run ./cmd/db/announce_release --title ... --body ... --user <userID> --send
	go run ./cmd/db/announce_release --title ... --body ... --send

Tapping the push opens the app; the client has no route for "app_update", so
it lands wherever the user last was.
*/

// Expo accepts at most 100 messages per request.
const expoBatchSize = 100

func main() {
	title := flag.String("title", "", "notification title (required)")
	body := flag.String("body", "", "notification body (required)")
	userID := flag.String("user", "", "send only to this user ID, for testing")
	send := flag.Bool("send", false, "actually send; without it this is a dry run")
	yes := flag.Bool("yes", false, "skip the confirmation prompt when sending to everyone")
	flag.Parse()

	ctx := context.Background()

	if strings.TrimSpace(*title) == "" || strings.TrimSpace(*body) == "" {
		fmt.Fprintln(os.Stderr, "--title and --body are required")
		flag.Usage()
		os.Exit(2)
	}

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

	filter := bson.M{"push_token": bson.M{"$gt": ""}}
	if *userID != "" {
		id, err := primitive.ObjectIDFromHex(*userID)
		if err != nil {
			fatal(ctx, "Invalid --user ID", err)
		}
		filter["_id"] = id
	}

	cursor, err := db.DB.Collection("users").Find(ctx, filter)
	if err != nil {
		fatal(ctx, "Failed to scan users", err)
	}
	defer cursor.Close(ctx)

	// Several accounts can share a device; send each token once.
	seen := map[string]bool{}
	var tokens []string
	for cursor.Next(ctx) {
		var doc struct {
			PushToken string `bson:"push_token"`
		}
		if err := cursor.Decode(&doc); err != nil {
			fatal(ctx, "Failed to decode user", err)
		}
		if doc.PushToken == "" || seen[doc.PushToken] {
			continue
		}
		seen[doc.PushToken] = true
		tokens = append(tokens, doc.PushToken)
	}
	if err := cursor.Err(); err != nil {
		fatal(ctx, "Cursor error", err)
	}

	fmt.Printf("Title:      %s\nBody:       %s\nRecipients: %d unique tokens\n", *title, *body, len(tokens))

	if !*send {
		fmt.Println("Dry run. Pass --send to deliver.")
		return
	}
	if len(tokens) == 0 {
		fmt.Println("No recipients.")
		return
	}
	if *userID == "" && !*yes && !confirm(len(tokens)) {
		fmt.Println("Aborted.")
		return
	}

	data := map[string]string{"type": "app_update"}
	failedBatches := 0
	for start := 0; start < len(tokens); start += expoBatchSize {
		end := min(start+expoBatchSize, len(tokens))
		batch := make([]xutils.Notification, 0, end-start)
		for _, token := range tokens[start:end] {
			batch = append(batch, xutils.Notification{
				Token:   token,
				Title:   *title,
				Message: *body,
				Data:    data,
			})
		}
		if err := xutils.SendBatchNotification(batch); err != nil {
			failedBatches++
			slog.LogAttrs(ctx, slog.LevelError, "Batch failed",
				slog.Int("start", start), slog.Int("size", len(batch)), xslog.Error(err))
		}
		// Stay well under Expo's 600 notifications/second limit.
		time.Sleep(250 * time.Millisecond)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Announcement sent",
		slog.Int("tokens", len(tokens)),
		slog.Int("failedBatches", failedBatches),
	)
}

func confirm(count int) bool {
	fmt.Printf("Send to %d devices? Type \"send\" to confirm: ", count)
	line, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	return strings.TrimSpace(line) == "send"
}

func fatal(ctx context.Context, msg string, err error) {
	slog.LogAttrs(ctx, slog.LevelError, msg, xslog.Error(err))
	os.Exit(1)
}
