package testing

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// getTestMongoURI returns the MongoDB URI for testing
// Checks environment variables in order:
// 1. TEST_MONGO_URI - explicit test URI
// 2. MONGO_URI - falls back to main URI
// 3. Default to localhost
func getTestMongoURI() string {
	if uri := os.Getenv("TEST_MONGO_URI"); uri != "" {
		return uri
	}
	if uri := os.Getenv("MONGO_URI"); uri != "" {
		return uri
	}
	return "mongodb://localhost:27017"
}

// TestDatabase holds the test database connection
type TestDatabase struct {
	Client       *mongo.Client
	DB           *mongo.Database
	DatabaseName string // Store the database name for cleanup
}

// NewEphemeralTestDatabase creates a new ephemeral test database with a unique name
// The database will be automatically dropped when TeardownTestEnvironment is called
func NewEphemeralTestDatabase() (*TestDatabase, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoURI := getTestMongoURI()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to test database: %w", err)
	}

	// Ping to verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping test database: %w", err)
	}

	// Generate unique database name using timestamp and random component
	dbName := fmt.Sprintf("test_%d", time.Now().UnixNano())
	db := client.Database(dbName)

	return &TestDatabase{
		Client:       client,
		DB:           db,
		DatabaseName: dbName,
	}, nil
}

// Close closes the test database connection
func (td *TestDatabase) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return td.Client.Disconnect(ctx)
}

// DropDatabase drops the entire test database
func (td *TestDatabase) DropDatabase() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return td.DB.Drop(ctx)
}

// SeedFixtures seeds the test database with fixtures
func (td *TestDatabase) SeedFixtures(fixtures *TestFixtures) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	fixturesMap := fixtures.AsMap()

	for collectionName, documents := range fixturesMap {
		if len(documents) == 0 {
			continue
		}

		collection := td.DB.Collection(collectionName)

		// Insert documents
		_, err := collection.InsertMany(ctx, documents)
		if err != nil {
			return fmt.Errorf("failed to seed collection %s: %w", collectionName, err)
		}

		// Seeding logs removed for cleaner test output
	}

	return nil
}

// CleanDatabase removes all documents from all collections but keeps the collections
func (td *TestDatabase) CleanDatabase() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	collections, err := td.DB.ListCollectionNames(ctx, map[string]interface{}{})
	if err != nil {
		return fmt.Errorf("failed to list collections: %w", err)
	}

	for _, collectionName := range collections {
		collection := td.DB.Collection(collectionName)
		_, err := collection.DeleteMany(ctx, map[string]interface{}{})
		if err != nil {
			return fmt.Errorf("failed to clean collection %s: %w", collectionName, err)
		}
		log.Printf("Cleaned collection: %s", collectionName)
	}

	return nil
}

// GetCollections returns a map of collection names to collection objects
func (td *TestDatabase) GetCollections() map[string]*mongo.Collection {
	return map[string]*mongo.Collection{
		"users":            td.DB.Collection("users"),
		"connections":      td.DB.Collection("connections"),
		"activity":         td.DB.Collection("activity"),
		"blueprints":       td.DB.Collection("blueprints"),
		"categories":       td.DB.Collection("categories"),
		"chats":            td.DB.Collection("chats"),
		"completed-tasks":  td.DB.Collection("completed-tasks"),
		"congratulations":  td.DB.Collection("congratulations"),
		"encouragements":   td.DB.Collection("encouragements"),
		"friend-requests":  td.DB.Collection("friend-requests"),
		"groups":           td.DB.Collection("groups"),
		"notifications":    td.DB.Collection("notifications"),
		"posts":            td.DB.Collection("posts"),
		"referrals":        td.DB.Collection("referrals"),
		"reports":          td.DB.Collection("reports"),
		"template-tasks":   td.DB.Collection("template-tasks"),
		"waitlist":         td.DB.Collection("waitlist"),
	}
}

// SetupTestEnvironment sets up a fresh ephemeral test environment with fixtures
// Creates a unique database that will be automatically dropped during teardown
func SetupTestEnvironment() (*TestDatabase, *TestFixtures, error) {
	// Connect to ephemeral test database
	testDB, err := NewEphemeralTestDatabase()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create ephemeral test database: %w", err)
	}

	// Create and seed fixtures (no need to clean - it's brand new)
	fixtures := NewTestFixtures()
	if err := testDB.SeedFixtures(fixtures); err != nil {
		testDB.Close()
		return nil, nil, fmt.Errorf("failed to seed fixtures: %w", err)
	}

	// Environment setup complete (logs removed for cleaner output)
	return testDB, fixtures, nil
}

// TeardownTestEnvironment cleans up the test environment
// Drops the entire ephemeral database
func TeardownTestEnvironment(testDB *TestDatabase) error {
	if testDB == nil {
		return nil
	}

	// Drop the entire ephemeral database
	if err := testDB.DropDatabase(); err != nil {
		log.Printf("Warning: failed to drop ephemeral test database %s: %v", testDB.DatabaseName, err)
	}

	// Close connection
	if err := testDB.Close(); err != nil {
		return fmt.Errorf("failed to close test database: %w", err)
	}

	// Teardown complete (logs removed for cleaner output)
	return nil
}
