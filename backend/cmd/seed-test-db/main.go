package main

import (
	"log"
	"os"

	"github.com/abhikaboy/Kindred/internal/testing"
)

func main() {
	log.Println("Creating ephemeral test database...")

	// Setup ephemeral test environment
	testDB, fixtures, err := testing.SetupTestEnvironment()
	if err != nil {
		log.Fatalf("Failed to setup test environment: %v", err)
	}

	log.Printf("✅ Ephemeral test database created: %s", testDB.DatabaseName)
	log.Println("\nTest data summary:")
	log.Printf("  - Users: %d", len(fixtures.Users))
	log.Printf("  - Connections: %d", len(fixtures.Connections))
	log.Printf("  - Activity: %d", len(fixtures.Activity))
	log.Printf("  - Blueprints: %d", len(fixtures.Blueprints))
	log.Printf("  - Categories: %d", len(fixtures.Categories))
	log.Printf("  - Chats: %d", len(fixtures.Chats))
	log.Printf("  - Completed Tasks: %d", len(fixtures.CompletedTasks))
	log.Printf("  - Congratulations: %d", len(fixtures.Congratulations))
	log.Printf("  - Encouragements: %d", len(fixtures.Encouragements))
	log.Printf("  - Friend Requests: %d", len(fixtures.FriendRequests))
	log.Printf("  - Groups: %d", len(fixtures.Groups))
	log.Printf("  - Notifications: %d", len(fixtures.Notifications))
	log.Printf("  - Posts: %d", len(fixtures.Posts))
	log.Printf("  - Referrals: %d", len(fixtures.Referrals))
	log.Printf("  - Template Tasks: %d", len(fixtures.TemplateTasks))
	log.Printf("  - Waitlist: %d", len(fixtures.Waitlist))

	log.Println("\n⚠️  Note: This is an ephemeral database for demonstration.")
	log.Println("It will remain until manually dropped or server restart.")
	log.Println("For actual tests, use SetupTestEnvironment() which auto-cleans.")

	// Don't teardown - let user inspect the database
	log.Printf("\n💡 To inspect: mongosh %s", testDB.DatabaseName)

	os.Exit(0)
}
