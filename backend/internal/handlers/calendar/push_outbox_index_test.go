package calendar

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// TestPushOutboxPendingUniqueIndex verifies the unique partial index on
// (task_id, op) where status=="pending" enforces the invariant that at most
// one pending row exists per (task_id, op) pair at the storage layer, while
// still permitting historical rows (succeeded/failed) and pending rows for
// different ops.
//
// This is the storage-layer defense-in-depth that backs the application-layer
// $setOnInsert guarantee in EnqueueUpsert. See KIN-275.
func TestPushOutboxPendingUniqueIndex(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping MongoDB-backed test in short mode")
	}

	mongoURI := os.Getenv("TEST_MONGO_URI")
	if mongoURI == "" {
		mongoURI = os.Getenv("MONGO_URI")
	}
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		t.Skipf("could not connect to MongoDB at %s: %v", mongoURI, err)
	}
	defer func() { _ = client.Disconnect(context.Background()) }()

	if err := client.Ping(ctx, nil); err != nil {
		t.Skipf("could not ping MongoDB at %s: %v", mongoURI, err)
	}

	dbName := fmt.Sprintf("test_kin275_%d", time.Now().UnixNano())
	db := client.Database(dbName)
	t.Cleanup(func() {
		_ = db.Drop(context.Background())
	})

	col := db.Collection("calendar_push_outbox")

	// Locate the push outbox index from the centralized registry and apply it.
	// This mirrors how production applies indexes via cmd/db/apply_indexes.
	var found *mongo.IndexModel
	for i := range xmongo.Indexes {
		idx := xmongo.Indexes[i]
		if idx.Collection != "calendar_push_outbox" {
			continue
		}
		// Match by key spec to be resilient to other future outbox indexes.
		keys, ok := idx.Model.Keys.(bson.D)
		if !ok {
			continue
		}
		if keysEqual(keys, bson.D{{Key: "task_id", Value: 1}, {Key: "op", Value: 1}}) {
			m := idx.Model
			found = &m
			break
		}
	}
	if found == nil {
		t.Fatal("calendar_push_outbox (task_id, op) index not declared in xmongo.Indexes")
	}

	if _, err := col.Indexes().CreateOne(ctx, *found); err != nil {
		t.Fatalf("failed to create index: %v", err)
	}

	// Idempotency check: applying the same index twice should not error.
	if _, err := col.Indexes().CreateOne(ctx, *found); err != nil {
		t.Fatalf("CreateIndexes is not idempotent: %v", err)
	}

	taskA := primitive.NewObjectID()
	categoryID := primitive.NewObjectID()
	userID := primitive.NewObjectID()
	now := time.Now()

	makeRow := func(op PushOp, status string) PushOutboxRow {
		return PushOutboxRow{
			TaskID:        taskA,
			CategoryID:    categoryID,
			UserID:        userID,
			Op:            op,
			EnqueuedAt:    now,
			NextAttemptAt: now,
			Status:        status,
		}
	}

	// 1. First pending (taskA, upsert) succeeds.
	if _, err := col.InsertOne(ctx, makeRow(PushOpUpsert, pushStatusPending)); err != nil {
		t.Fatalf("first pending upsert insert should succeed, got: %v", err)
	}

	// 2. Second pending (taskA, upsert) fails with duplicate key error.
	_, err = col.InsertOne(ctx, makeRow(PushOpUpsert, pushStatusPending))
	if err == nil {
		t.Fatal("expected duplicate key error for second pending (taskA, upsert), got nil")
	}
	if !xmongo.IsDuplicateKeyError(err) {
		t.Fatalf("expected duplicate key error, got: %v", err)
	}

	// 3. A non-pending row for (taskA, upsert) succeeds — partial filter is
	//    scoped to status=="pending", so terminal-status rows are not indexed.
	if _, err := col.InsertOne(ctx, makeRow(PushOpUpsert, "succeeded")); err != nil {
		t.Fatalf("succeeded upsert for taskA should succeed, got: %v", err)
	}
	if _, err := col.InsertOne(ctx, makeRow(PushOpUpsert, pushStatusFailedPermanent)); err != nil {
		t.Fatalf("failed_permanent upsert for taskA should succeed, got: %v", err)
	}

	// 4. A pending row for (taskA, delete) succeeds — different op.
	if _, err := col.InsertOne(ctx, makeRow(PushOpDelete, pushStatusPending)); err != nil {
		t.Fatalf("pending delete for taskA should succeed (different op), got: %v", err)
	}

	// 5. A second pending (taskA, delete) is also rejected — sanity check that
	//    the uniqueness holds across ops, not just upsert.
	_, err = col.InsertOne(ctx, makeRow(PushOpDelete, pushStatusPending))
	if err == nil {
		t.Fatal("expected duplicate key error for second pending (taskA, delete), got nil")
	}
	if !xmongo.IsDuplicateKeyError(err) {
		t.Fatalf("expected duplicate key error for second pending delete, got: %v", err)
	}

	// 6. A pending upsert for a different task succeeds.
	taskB := primitive.NewObjectID()
	row := makeRow(PushOpUpsert, pushStatusPending)
	row.TaskID = taskB
	if _, err := col.InsertOne(ctx, row); err != nil {
		t.Fatalf("pending upsert for taskB should succeed (different task_id), got: %v", err)
	}
}

// keysEqual compares two bson.D index key specs by field order and value.
func keysEqual(a, b bson.D) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Key != b[i].Key {
			return false
		}
		if fmt.Sprint(a[i].Value) != fmt.Sprint(b[i].Value) {
			return false
		}
	}
	return true
}
