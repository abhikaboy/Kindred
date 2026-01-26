package main

import (
	"context"
	"fmt"
	"log"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/testutils"
)

func main() {
	ctx := context.Background()

	fmt.Println("Loading configuration...")
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	fmt.Printf("Config loaded successfully:\n")
	fmt.Printf("ATLAS_USER: %s\n", cfg.Atlas.User)
	fmt.Printf("ATLAS_CLUSTER: %s\n", cfg.Atlas.Cluster)
	fmt.Printf("ATLAS_ENVIRONMENT: %s\n", cfg.Atlas.Environment)
	fmt.Printf("MongoDB URI (masked): %s\n", maskPassword(cfg.Atlas.URI()))

	fmt.Println("\nCreating test database configuration...")
	testConfig, err := testutils.TestDBFromEnv()
	if err != nil {
		log.Fatalf("Failed to create test config: %v", err)
	}

	fmt.Printf("Test config created successfully:\n")
	fmt.Printf("Test ATLAS_USER: %s\n", testConfig.AtlasConfig.User)
	fmt.Printf("Test ATLAS_CLUSTER: %s\n", testConfig.AtlasConfig.Cluster)
	fmt.Printf("Test ATLAS_ENVIRONMENT: %s\n", testConfig.AtlasConfig.Environment)

	fmt.Println("\nAttempting to connect to test database...")
	testDB, err := testutils.NewTestDB(ctx, testConfig)
	if err != nil {
		log.Fatalf("Failed to connect to test database: %v", err)
	}
	defer func() {
		if err := testDB.TearDown(ctx); err != nil {
			log.Printf("Failed to tear down test database: %v", err)
		}
	}()

	fmt.Println("✅ Successfully connected to test database!")
	fmt.Printf("Test database name: %s\n", testDB.DB.DB.Name())
}

func maskPassword(uri string) string {
	// Simple password masking for security
	if len(uri) > 20 {
		return uri[:15] + "***MASKED***" + uri[len(uri)-10:]
	}
	return "***MASKED***"
}
