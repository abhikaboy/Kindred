package Profile

import (
	"testing"

	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestConvertConnectionToRelationshipInfo(t *testing.T) {
	service := &Service{} // No DB needed for this unit test
	userA := primitive.NewObjectID()
	userB := primitive.NewObjectID()

	t.Run("Friends returns RelationshipConnected", func(t *testing.T) {
		conn := Connection.ConnectionDocumentInternal{
			ID:     primitive.NewObjectID(),
			Users:  []primitive.ObjectID{userA, userB},
			Status: Connection.StatusFriends,
		}

		result := service.convertConnectionToRelationshipInfo(conn, userA)

		assert.Equal(t, RelationshipConnected, result.Status)
		assert.Nil(t, result.RequestID)
	})

	t.Run("Blocked returns RelationshipBlocked", func(t *testing.T) {
		conn := Connection.ConnectionDocumentInternal{
			ID:     primitive.NewObjectID(),
			Users:  []primitive.ObjectID{userA, userB},
			Status: Connection.StatusBlocked,
		}

		result := service.convertConnectionToRelationshipInfo(conn, userA)

		assert.Equal(t, RelationshipBlocked, result.Status)
		assert.Nil(t, result.RequestID)
	})

	t.Run("Pending from requester returns RelationshipRequested with request ID", func(t *testing.T) {
		connID := primitive.NewObjectID()
		conn := Connection.ConnectionDocumentInternal{
			ID:     connID,
			Users:  []primitive.ObjectID{userA, userB},
			Status: Connection.StatusPending,
			Requester: Connection.ConnectionUserInternal{
				ID: userA,
			},
		}

		result := service.convertConnectionToRelationshipInfo(conn, userA)

		assert.Equal(t, RelationshipRequested, result.Status)
		assert.NotNil(t, result.RequestID)
		assert.Equal(t, connID.Hex(), *result.RequestID)
	})

	t.Run("Pending from receiver returns RelationshipReceived with request ID", func(t *testing.T) {
		connID := primitive.NewObjectID()
		conn := Connection.ConnectionDocumentInternal{
			ID:     connID,
			Users:  []primitive.ObjectID{userA, userB},
			Status: Connection.StatusPending,
			Requester: Connection.ConnectionUserInternal{
				ID: userA,
			},
		}

		result := service.convertConnectionToRelationshipInfo(conn, userB)

		assert.Equal(t, RelationshipReceived, result.Status)
		assert.NotNil(t, result.RequestID)
		assert.Equal(t, connID.Hex(), *result.RequestID)
	})

	t.Run("Unknown status returns RelationshipNone", func(t *testing.T) {
		conn := Connection.ConnectionDocumentInternal{
			ID:     primitive.NewObjectID(),
			Users:  []primitive.ObjectID{userA, userB},
			Status: "unknown",
		}

		result := service.convertConnectionToRelationshipInfo(conn, userA)

		assert.Equal(t, RelationshipNone, result.Status)
		assert.Nil(t, result.RequestID)
	})
}

func TestCheckRelationship_Self(t *testing.T) {
	service := &Service{} // No DB needed for self check
	userA := primitive.NewObjectID()

	result, err := service.CheckRelationship(userA, userA)

	assert.NoError(t, err)
	assert.Equal(t, RelationshipSelf, result.Status)
}

func TestParseUserIDs(t *testing.T) {
	a := primitive.NewObjectID()
	b := primitive.NewObjectID()

	t.Run("parses, dedupes, and skips invalid hex", func(t *testing.T) {
		got, err := parseUserIDs([]string{a.Hex(), a.Hex(), "not-hex", b.Hex()}, 200)
		assert.NoError(t, err)
		assert.Equal(t, []primitive.ObjectID{a, b}, got)
	})

	t.Run("empty input returns empty slice", func(t *testing.T) {
		got, err := parseUserIDs(nil, 200)
		assert.NoError(t, err)
		assert.Empty(t, got)
	})

	t.Run("errors when over the cap", func(t *testing.T) {
		_, err := parseUserIDs([]string{a.Hex(), b.Hex(), a.Hex()}, 2)
		assert.Error(t, err)
	})
}
