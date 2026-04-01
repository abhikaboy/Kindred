package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/server"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const authSecret = "loadtest-secret-key"

type LoadTestEnv struct {
	App         *fiber.App
	DB          *mongo.Database
	Client      *mongo.Client
	Collections map[string]*mongo.Collection
	Fixtures    *LoadTestFixtures
	AuthTokens  map[string]string // userID hex -> JWT token
	DBName      string
}

func getTestMongoURI() string {
	if uri := os.Getenv("TEST_MONGO_URI"); uri != "" {
		return uri
	}
	if uri := os.Getenv("MONGO_URI"); uri != "" {
		return uri
	}
	return "mongodb://localhost:27017"
}

func Setup(ctx context.Context) (*LoadTestEnv, error) {
	os.Setenv("AUTH_SECRET", authSecret)

	mongoURI := getTestMongoURI()
	fmt.Printf("  Connecting to MongoDB at %s\n", mongoURI)

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		return nil, fmt.Errorf("mongo connect: %w", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("mongo ping: %w", err)
	}

	dbName := fmt.Sprintf("loadtest_%d", time.Now().UnixNano())
	db := client.Database(dbName)
	fmt.Printf("  Created ephemeral database: %s\n", dbName)

	collections := buildCollections(db)

	fixtures := NewLoadTestFixtures()
	if err := seedFixtures(ctx, db, fixtures); err != nil {
		return nil, fmt.Errorf("seed fixtures: %w", err)
	}
	fmt.Printf("  Seeded %d users, %d categories with tasks, %d posts\n",
		len(fixtures.Users), len(fixtures.Categories), len(fixtures.Posts))

	cfg := config.Config{
		App:  config.App{Port: "0"},
		Auth: config.Auth{Secret: authSecret},
	}

	_, app := server.New(collections, nil, nil, cfg)

	tokens, err := generateTokens(fixtures, cfg, collections)
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}
	fmt.Printf("  Generated auth tokens for %d users\n", len(tokens))

	return &LoadTestEnv{
		App:         app,
		DB:          db,
		Client:      client,
		Collections: collections,
		Fixtures:    fixtures,
		AuthTokens:  tokens,
		DBName:      dbName,
	}, nil
}

func (env *LoadTestEnv) Teardown(ctx context.Context) {
	if env.DB != nil {
		_ = env.DB.Drop(ctx)
		fmt.Printf("  Dropped database: %s\n", env.DBName)
	}
	if env.Client != nil {
		_ = env.Client.Disconnect(ctx)
	}
}

func buildCollections(db *mongo.Database) map[string]*mongo.Collection {
	names := []string{
		"users", "connections", "activity", "blueprints", "categories",
		"chats", "completed-tasks", "congratulations", "encouragements",
		"friend-requests", "groups", "notifications", "posts", "referrals",
		"reports", "template-tasks", "waitlist",
	}
	cols := make(map[string]*mongo.Collection, len(names))
	for _, n := range names {
		cols[n] = db.Collection(n)
	}
	return cols
}

func seedFixtures(ctx context.Context, db *mongo.Database, f *LoadTestFixtures) error {
	data := f.AsMap()
	for collName, docs := range data {
		if len(docs) == 0 {
			continue
		}
		if _, err := db.Collection(collName).InsertMany(ctx, docs); err != nil {
			return fmt.Errorf("insert %s: %w", collName, err)
		}
	}
	return nil
}

func generateTokens(f *LoadTestFixtures, cfg config.Config, collections map[string]*mongo.Collection) (map[string]string, error) {
	svc := auth.NewServiceWithConfig(collections, cfg)
	tokens := make(map[string]string, len(f.Users))
	for _, u := range f.Users {
		tok, err := svc.GenerateAccessToken(u.ID.Hex(), u.Count, "America/New_York")
		if err != nil {
			return nil, fmt.Errorf("token for %s: %w", u.ID.Hex(), err)
		}
		tokens[u.ID.Hex()] = tok
	}
	return tokens, nil
}
