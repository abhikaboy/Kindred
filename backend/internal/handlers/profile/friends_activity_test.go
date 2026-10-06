package Profile

import (
	"context"
	"testing"
	"time"

	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestFriendsActivityQueries(t *testing.T) {
	collections := setupProfileTestDB(t)
	service := NewService(collections)
	ctx := context.Background()

	me, friend, pending, stranger := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	_, err := collections["friend-requests"].InsertMany(ctx, []interface{}{
		bson.M{"users": Connection.SortUserIDs(me, friend), "status": Connection.StatusFriends},
		bson.M{"users": Connection.SortUserIDs(me, pending), "status": Connection.StatusPending},
	})
	require.NoError(t, err)

	t.Run("FilterFriends keeps only accepted friends", func(t *testing.T) {
		got, err := service.FilterFriends(ctx, me, []primitive.ObjectID{friend, pending, stranger})
		require.NoError(t, err)
		assert.Equal(t, []primitive.ObjectID{friend}, got)
	})

	now := time.Now()
	task := func(content string, extra bson.M) bson.M {
		doc := bson.M{"_id": primitive.NewObjectID(), "content": content, "public": true, "timestamp": now}
		for k, v := range extra {
			doc[k] = v
		}
		return doc
	}
	_, err = collections["categories"].InsertOne(ctx, bson.M{
		"user": friend,
		"tasks": bson.A{
			task("pending a", nil),
			task("pending b", nil),
			task("pending c", nil),
			task("private", bson.M{"public": false}),
			task("released", bson.M{"releasedAt": now}),
			task("working", bson.M{"workingOnSince": now}),
		},
	})
	require.NoError(t, err)

	t.Run("GetFriendsOpenTasks puts working first and caps per user", func(t *testing.T) {
		got, err := service.GetFriendsOpenTasks(ctx, []primitive.ObjectID{friend}, 3)
		require.NoError(t, err)
		require.Len(t, got[friend], 3)
		assert.Equal(t, "working", got[friend][0].Content)
		for _, tk := range got[friend] {
			assert.NotContains(t, []string{"private", "released"}, tk.Content)
		}
	})

	_, err = collections["completed-tasks"].InsertMany(ctx, []interface{}{
		bson.M{"user": friend, "public": true, "content": "old", "timeCompleted": now.Add(-72 * time.Hour)},
		bson.M{"user": friend, "public": true, "content": "earlier", "timeCompleted": now.Add(-2 * time.Hour)},
		bson.M{"user": friend, "public": true, "content": "latest", "timeCompleted": now.Add(-time.Minute)},
		bson.M{"user": friend, "public": false, "content": "hidden", "timeCompleted": now},
	})
	require.NoError(t, err)

	t.Run("GetFriendsRecentCompletedTasks returns newest public completions in the window", func(t *testing.T) {
		got, err := service.GetFriendsRecentCompletedTasks(ctx, []primitive.ObjectID{friend}, now.Add(-36*time.Hour), 3)
		require.NoError(t, err)
		require.Len(t, got[friend], 2)
		assert.Equal(t, "latest", got[friend][0].Content)
		assert.Equal(t, "earlier", got[friend][1].Content)
	})
}
