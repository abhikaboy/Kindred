package contacts

import (
	"context"
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestFindUsersByPhoneHashes_ExcludesGuests(t *testing.T) {
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

	users := testDB.GetCollections()["users"]
	service := &Service{Users: users}
	ctx := context.Background()

	member := types.User{ID: primitive.NewObjectID(), Handle: "@member", PhoneHash: "hash-member"}
	guest := types.User{ID: primitive.NewObjectID(), Handle: "@guest_x", PhoneHash: "hash-guest", IsGuest: true}
	_, err = users.InsertMany(ctx, []interface{}{member, guest})
	require.NoError(t, err)

	matches, err := service.findUsersByPhoneHashes(ctx, []string{"hash-member", "hash-guest"}, primitive.NewObjectID())
	require.NoError(t, err)
	require.Len(t, matches, 1)
	assert.Equal(t, member.ID.Hex(), matches[0].ID)
}
