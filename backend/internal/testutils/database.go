package testutils

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// TestDB wraps the xmongo.DB with additional testing utilities
type TestDB struct {
	*xmongo.DB
	testDBName string
	isManaged  bool // Whether this test DB should be auto-cleaned
}

// TestConfig holds test-specific database configuration
type TestConfig struct {
	AtlasConfig config.Atlas
	UseRandomDB bool // If true, creates a random test database name
	CleanupDB   bool // If true, cleans up the database after tests
}

// NewTestDB creates a new test database connection
func NewTestDB(ctx context.Context, cfg TestConfig) (*TestDB, error) {
	fmt.Println("=== NewTestDB Debug Log ===")
	
	// Create test database name
	testDBName := cfg.AtlasConfig.Environment
	if cfg.UseRandomDB {
		testDBName = generateTestDBName()
		fmt.Printf("Generated random test DB name: %s\n", testDBName)
	} else {
		fmt.Printf("Using configured test DB name: %s\n", testDBName)
	}

	// Override the environment to use our test database
	testAtlasConfig := cfg.AtlasConfig
	testAtlasConfig.Environment = testDBName

	fmt.Printf("Test connection config:\n")
	fmt.Printf("  User: %s\n", testAtlasConfig.User)
	fmt.Printf("  Cluster: %s\n", testAtlasConfig.Cluster)
	fmt.Printf("  Environment: %s\n", testAtlasConfig.Environment)
	fmt.Printf("  URI: %s\n", maskPassword(testAtlasConfig.URI()))

	// Connect directly without validation (for testing)
	fmt.Println("Attempting to connect to test database...")
	db, err := connectTestDB(ctx, testAtlasConfig)
	if err != nil {
		fmt.Printf("❌ Failed to connect to test database: %v\n", err)
		return nil, fmt.Errorf("failed to create test database connection: %w", err)
	}
	fmt.Println("✅ Successfully connected to test database")

	testDB := &TestDB{
		DB:         db,
		testDBName: testDBName,
		isManaged:  cfg.CleanupDB,
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Test database created",
		slog.String("database_name", testDBName),
		slog.Bool("managed", cfg.CleanupDB))

	fmt.Printf("✅ NewTestDB completed successfully - DB name: %s\n", testDBName)
	fmt.Println("=== End NewTestDB Debug Log ===")

	return testDB, nil
}

// Cleanup removes all data from the test database
func (tdb *TestDB) Cleanup(ctx context.Context) error {
	if !tdb.isManaged {
		return nil
	}

	// Drop all collections in the test database
	collections, err := tdb.DB.DB.ListCollectionNames(ctx, bson.D{})
	if err != nil {
		return fmt.Errorf("failed to list collections: %w", err)
	}

	for _, collection := range collections {
		if err := tdb.DB.DB.Collection(collection).Drop(ctx); err != nil {
			slog.LogAttrs(ctx, slog.LevelWarn, "Failed to drop collection",
				slog.String("collection", collection),
				slog.String("error", err.Error()))
		}
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Test database cleaned up",
		slog.String("database_name", tdb.testDBName))

	return nil
}

// TearDown completely removes the test database
func (tdb *TestDB) TearDown(ctx context.Context) error {
	if !tdb.isManaged {
		return nil
	}

	if err := tdb.DB.DB.Drop(ctx); err != nil {
		return fmt.Errorf("failed to drop test database: %w", err)
	}

	// Close the connection
	if err := tdb.DB.Client.Disconnect(ctx); err != nil {
		return fmt.Errorf("failed to disconnect from test database: %w", err)
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Test database torn down",
		slog.String("database_name", tdb.testDBName))

	return nil
}

// SeedData populates the test database with test fixtures
func (tdb *TestDB) SeedData(ctx context.Context, fixtures map[string][]interface{}) error {
	for collectionName, docs := range fixtures {
		if len(docs) == 0 {
			continue
		}

		collection := tdb.DB.DB.Collection(collectionName)
		
		// Add collection to the collections map if not present
		if tdb.DB.Collections == nil {
			tdb.DB.Collections = make(map[string]*mongo.Collection)
		}
		tdb.DB.Collections[collectionName] = collection
		
		// Insert documents
		result, err := collection.InsertMany(ctx, docs)
		if err != nil {
			return fmt.Errorf("failed to seed collection %s: %w", collectionName, err)
		}

		slog.LogAttrs(ctx, slog.LevelDebug, "Collection seeded",
			slog.String("collection", collectionName),
			slog.Int("count", len(result.InsertedIDs)))
	}

	return nil
}

// ClearCollection removes all documents from a specific collection
func (tdb *TestDB) ClearCollection(ctx context.Context, collectionName string) error {
	collection := tdb.DB.DB.Collection(collectionName)
	_, err := collection.DeleteMany(ctx, bson.D{})
	if err != nil {
		return fmt.Errorf("failed to clear collection %s: %w", collectionName, err)
	}
	return nil
}

// CountDocuments returns the number of documents in a collection
func (tdb *TestDB) CountDocuments(ctx context.Context, collectionName string, filter bson.D) (int64, error) {
	collection := tdb.DB.DB.Collection(collectionName)
	return collection.CountDocuments(ctx, filter)
}

// EnsureIndexes creates indexes needed for testing
func (tdb *TestDB) EnsureIndexes(ctx context.Context) error {
	// Apply the same indexes as production
	for _, index := range xmongo.Indexes {
		if err := tdb.DB.ApplyIndex(ctx, index.Collection, index.Model); err != nil {
			return fmt.Errorf("failed to apply index to collection %s: %w", index.Collection, err)
		}
	}

	for _, searchIndex := range xmongo.SearchIndexes {
		if err := tdb.DB.ApplySearchIndex(ctx, searchIndex.Collection, searchIndex.Model); err != nil {
			return fmt.Errorf("failed to apply search index to collection %s: %w", searchIndex.Collection, err)
		}
	}

	return nil
}

// WaitForIndex waits for an index to be ready
func (tdb *TestDB) WaitForIndex(ctx context.Context, collectionName string, timeout time.Duration) error {
	collection := tdb.DB.DB.Collection(collectionName)
	
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for indexes on collection %s", collectionName)
		case <-ticker.C:
			cursor, err := collection.Indexes().List(ctx)
			if err != nil {
				continue
			}
			
			var indexes []bson.M
			if err := cursor.All(ctx, &indexes); err != nil {
				continue
			}
			
			// Check if we have at least the default _id index
			if len(indexes) > 0 {
				return nil
			}
		}
	}
}

// generateTestDBName creates a unique test database name
func generateTestDBName() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	
	return fmt.Sprintf("test_%s_%d", string(b), time.Now().Unix())
}

// TestDBFromEnv creates a test database configuration from environment variables
func TestDBFromEnv() (TestConfig, error) {
	fmt.Println("=== TestDBFromEnv Debug Log ===")
	
	// Check current working directory
	if cwd, err := os.Getwd(); err == nil {
		fmt.Printf("Current working directory: %s\n", cwd)
	}
	
	// Try to find .env.test in multiple locations
	envTestPaths := []string{
		".env.test",           // Current directory
		"../.env.test",        // Parent directory
		"../../.env.test",     // Grandparent directory
		"../../../.env.test",  // Great-grandparent directory
	}
	
	var foundEnvTestPath string
	for _, path := range envTestPaths {
		if _, err := os.Stat(path); err == nil {
			foundEnvTestPath = path
			fmt.Printf("✅ .env.test file found at: %s\n", path)
			break
		}
	}
	
	if foundEnvTestPath == "" {
		fmt.Println("❌ .env.test file not found in any expected location")
		// Check for .env as fallback
		envPaths := []string{
			".env",
			"../.env", 
			"../../.env",
			"../../../.env",
		}
		
		var foundEnvPath string
		for _, path := range envPaths {
			if _, err := os.Stat(path); err == nil {
				foundEnvPath = path
				fmt.Printf("✅ .env file found at: %s\n", path)
				break
			}
		}
		
		if foundEnvPath == "" {
			fmt.Println("❌ No .env or .env.test file found")
			return TestConfig{}, fmt.Errorf("no environment file found in current or parent directories")
		}
	}
	
	// Check environment variables before loading
	fmt.Println("Environment variables before loading:")
	fmt.Printf("ATLAS_USER: %s\n", os.Getenv("ATLAS_USER"))
	fmt.Printf("ATLAS_PASS: %s\n", maskPassword(os.Getenv("ATLAS_PASS")))
	fmt.Printf("ATLAS_CLUSTER: %s\n", os.Getenv("ATLAS_CLUSTER"))
	fmt.Printf("ATLAS_ENVIRONMENT: %s\n", os.Getenv("ATLAS_ENVIRONMENT"))
	
	// Try to load .env.test first, then fall back to .env
	fmt.Println("\nAttempting to load environment file...")
	if foundEnvTestPath != "" {
		fmt.Printf("Loading .env.test from: %s\n", foundEnvTestPath)
		if err := godotenv.Load(foundEnvTestPath); err != nil {
			fmt.Printf("❌ Failed to load %s: %v\n", foundEnvTestPath, err)
			return TestConfig{}, fmt.Errorf("failed to load .env.test from %s: %w", foundEnvTestPath, err)
		}
		fmt.Printf("✅ Successfully loaded .env.test from: %s\n", foundEnvTestPath)
	} else {
		// Fallback to .env
		envPaths := []string{
			".env",
			"../.env", 
			"../../.env",
			"../../../.env",
		}
		
		var loaded bool
		for _, path := range envPaths {
			if _, err := os.Stat(path); err == nil {
				fmt.Printf("Loading .env from: %s\n", path)
				if err := godotenv.Load(path); err != nil {
					fmt.Printf("❌ Failed to load %s: %v\n", path, err)
					continue
				}
				fmt.Printf("✅ Successfully loaded .env from: %s\n", path)
				loaded = true
				break
			}
		}
		
		if !loaded {
			return TestConfig{}, fmt.Errorf("failed to load any environment file")
		}
	}
	
	// Check environment variables after loading
	fmt.Println("Environment variables after loading:")
	fmt.Printf("ATLAS_USER: %s\n", os.Getenv("ATLAS_USER"))
	fmt.Printf("ATLAS_PASS: %s\n", maskPassword(os.Getenv("ATLAS_PASS")))
	fmt.Printf("ATLAS_CLUSTER: %s\n", os.Getenv("ATLAS_CLUSTER"))
	fmt.Printf("ATLAS_ENVIRONMENT: %s\n", os.Getenv("ATLAS_ENVIRONMENT"))
	
	fmt.Println("\nAttempting to load config...")
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("❌ Failed to load config: %v\n", err)
		return TestConfig{}, fmt.Errorf("failed to load config: %w", err)
	}
	
	fmt.Println("✅ Config loaded successfully:")
	fmt.Printf("  ATLAS_USER: %s\n", cfg.Atlas.User)
	fmt.Printf("  ATLAS_CLUSTER: %s\n", cfg.Atlas.Cluster)
	fmt.Printf("  ATLAS_ENVIRONMENT: %s\n", cfg.Atlas.Environment)
	fmt.Printf("  MongoDB URI: %s\n", maskPassword(cfg.Atlas.URI()))

	// Override environment for testing
	testCfg := cfg.Atlas
	if !strings.Contains(testCfg.Environment, "test") {
		testCfg.Environment = "test_" + testCfg.Environment
		fmt.Printf("Modified environment to: %s\n", testCfg.Environment)
	}

	fmt.Println("✅ TestDBFromEnv completed successfully")
	fmt.Println("=== End TestDBFromEnv Debug Log ===")

	return TestConfig{
		AtlasConfig: testCfg,
		UseRandomDB: true,
		CleanupDB:   true,
	}, nil
}

// Helper function to mask passwords in logs
func maskPassword(password string) string {
	if len(password) > 3 {
		return password[:3] + "***"
	}
	return "***"
}

// IsTestEnvironment checks if we're running in a test environment
func IsTestEnvironment(env string) bool {
	testEnvs := []string{"test", "testing", "development", "dev"}
	env = strings.ToLower(env)
	
	for _, testEnv := range testEnvs {
		if strings.Contains(env, testEnv) || env == testEnv {
			return true
		}
	}
	return false
}

// IsCI checks if we're running in a CI environment
func IsCI() bool {
	ciEnvs := []string{"CI", "CONTINUOUS_INTEGRATION", "GITHUB_ACTIONS", "GITLAB_CI", "JENKINS_URL"}
	for _, env := range ciEnvs {
		if os.Getenv(env) != "" {
			return true
		}
	}
	return false
}

// connectTestDB creates a database connection specifically for testing
// This bypasses the environment validation that exists in the main xmongo package
func connectTestDB(ctx context.Context, cfg config.Atlas) (*xmongo.DB, error) {
	// Connect to MongoDB client
	client, err := connectTestClient(ctx, cfg.URI())
	if err != nil {
		return nil, fmt.Errorf("failed to setup test client: %w", err)
	}

	// Use the database directly without validation
	db := client.Database(cfg.Environment)
	
	// Setup collections map (empty initially for tests)
	collections := make(map[string]*mongo.Collection)

	// Create the DB struct without change stream for testing
	return &xmongo.DB{
		Client:      client,
		DB:          db,
		Collections: collections,
		Stream:      nil, // No change stream for tests
	}, nil
}

// connectTestClient connects to MongoDB for testing
func connectTestClient(ctx context.Context, uri string) (*mongo.Client, error) {
	fmt.Printf("=== connectTestClient Debug ===\n")
	fmt.Printf("Connecting to URI: %s\n", maskPassword(uri))
	
	serverAPI := options.ServerAPI(options.ServerAPIVersion1)
	opts := options.Client().ApplyURI(uri).SetServerAPIOptions(serverAPI)
	
	fmt.Println("Attempting mongo.Connect...")
	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		fmt.Printf("❌ mongo.Connect failed: %v\n", err)
		return nil, fmt.Errorf("failed to connect to test database: %w", err)
	}
	fmt.Println("✅ mongo.Connect successful")
	
	fmt.Println("Attempting to ping database...")
	if err := client.Ping(ctx, nil); err != nil {
		fmt.Printf("❌ ping failed: %v\n", err)
		return nil, fmt.Errorf("failed to ping test database: %w", err)
	}
	fmt.Println("✅ ping successful")
	fmt.Println("=== End connectTestClient Debug ===")
	
	return client, nil
} 