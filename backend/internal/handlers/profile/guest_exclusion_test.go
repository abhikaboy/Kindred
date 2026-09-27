package Profile

import (
	"context"
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// setupProfileTestDB returns an ephemeral database, skipping when MongoDB is
// not reachable. SearchProfiles and AutocompleteProfiles use Atlas Search and
// cannot run against a plain local mongod, so only the non-$search queries are
// covered here.
func setupProfileTestDB(t *testing.T) map[string]*mongo.Collection {
	t.Helper()
	if testing.Short() {
		t.Skip("skipping MongoDB-backed test in -short mode")
	}

	testDB, _, err := testpkg.SetupTestEnvironment()
	if err != nil {
		t.Skipf("skipping: MongoDB not available: %v", err)
	}
	t.Cleanup(func() {
		_ = testpkg.TeardownTestEnvironment(testDB)
	})
	return testDB.GetCollections()
}

// insertPopularGuest adds a guest with more friends than any fixture user, so
// it would top the suggested list if it were not filtered out.
func insertPopularGuest(t *testing.T, users *mongo.Collection) primitive.ObjectID {
	t.Helper()
	friends := make([]primitive.ObjectID, 50)
	for i := range friends {
		friends[i] = primitive.NewObjectID()
	}
	guest := types.User{
		ID:          primitive.NewObjectID(),
		DisplayName: "Guest",
		Handle:      "@guest_test",
		Friends:     friends,
		IsGuest:     true,
	}
	_, err := users.InsertOne(context.Background(), guest)
	require.NoError(t, err)
	return guest.ID
}

func TestGetAllProfiles_ExcludesGuests(t *testing.T) {
	collections := setupProfileTestDB(t)
	service := NewService(collections)
	guestID := insertPopularGuest(t, collections["users"])

	profiles, err := service.GetAllProfiles()
	require.NoError(t, err)
	require.NotEmpty(t, profiles, "fixture users should still be returned")
	for _, p := range profiles {
		assert.NotEqual(t, guestID, p.ID, "guest should not be listed")
	}
}

func TestGetSuggestedUsers_ExcludesGuests(t *testing.T) {
	collections := setupProfileTestDB(t)
	service := NewService(collections)
	guestID := insertPopularGuest(t, collections["users"])

	users, err := service.GetSuggestedUsers()
	require.NoError(t, err)
	require.NotEmpty(t, users, "fixture users should still be suggested")
	for _, u := range users {
		assert.NotEqual(t, guestID.Hex(), u.ID, "guest should not be suggested")
	}
}
