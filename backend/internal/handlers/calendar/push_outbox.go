package calendar

import (
	"context"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// PushOp is the kind of push action queued for the worker.
type PushOp string

const (
	PushOpUpsert PushOp = "upsert"
	PushOpDelete PushOp = "delete"
)

// PushOutboxRow is a queued push action.
type PushOutboxRow struct {
	ID         primitive.ObjectID `bson:"_id,omitempty"`
	TaskID     primitive.ObjectID `bson:"task_id"`
	CategoryID primitive.ObjectID `bson:"category_id"`
	UserID     primitive.ObjectID `bson:"user_id"`
	Op         PushOp             `bson:"op"`

	// Snapshot fields (set only for delete ops).
	TargetEventID      string             `bson:"target_event_id,omitempty"`
	TargetCalendarID   string             `bson:"target_calendar_id,omitempty"`
	TargetConnectionID primitive.ObjectID `bson:"target_connection_id,omitempty"`

	EnqueuedAt    time.Time `bson:"enqueued_at"`
	AttemptCount  int       `bson:"attempt_count"`
	NextAttemptAt time.Time `bson:"next_attempt_at"`
	LastError     string    `bson:"last_error,omitempty"`
	Status        string    `bson:"status"` // "pending" | "failed_permanent"
}

const (
	pushStatusPending         = "pending"
	pushStatusFailedPermanent = "failed_permanent"
	pushMaxAttempts           = 10
)

// PushOutbox handles enqueue, coalescing, and drain queries.
type PushOutbox struct {
	col *mongo.Collection
}

func NewPushOutbox(col *mongo.Collection) *PushOutbox {
	return &PushOutbox{col: col}
}

// EnqueueUpsert inserts an upsert row unless one is already pending for this task.
// If a pending delete exists for the same task, the upsert is still inserted —
// the worker processes them in order (this is the "moved between calendars" case).
func (o *PushOutbox) EnqueueUpsert(ctx context.Context, taskID, categoryID, userID primitive.ObjectID) error {
	// Check for an existing pending upsert for this task.
	count, err := o.col.CountDocuments(ctx, bson.M{
		"task_id": taskID,
		"op":      PushOpUpsert,
		"status":  pushStatusPending,
	})
	if err != nil {
		return err
	}
	if count > 0 {
		slog.Debug("Push outbox: upsert already pending, coalescing", "task_id", taskID)
		return nil
	}

	now := time.Now()
	_, err = o.col.InsertOne(ctx, PushOutboxRow{
		TaskID:        taskID,
		CategoryID:    categoryID,
		UserID:        userID,
		Op:            PushOpUpsert,
		EnqueuedAt:    now,
		NextAttemptAt: now,
		Status:        pushStatusPending,
	})
	return err
}

// EnqueueDelete inserts a delete row carrying the snapshot of what to delete.
// Removes any pending upsert for the same task (delete supersedes upsert).
func (o *PushOutbox) EnqueueDelete(ctx context.Context, taskID, categoryID, userID, connectionID primitive.ObjectID, eventID, calendarID string) error {
	// Drop any pending upsert for this task.
	_, err := o.col.DeleteMany(ctx, bson.M{
		"task_id": taskID,
		"op":      PushOpUpsert,
		"status":  pushStatusPending,
	})
	if err != nil {
		return err
	}

	now := time.Now()
	_, err = o.col.InsertOne(ctx, PushOutboxRow{
		TaskID:             taskID,
		CategoryID:         categoryID,
		UserID:             userID,
		Op:                 PushOpDelete,
		TargetEventID:      eventID,
		TargetCalendarID:   calendarID,
		TargetConnectionID: connectionID,
		EnqueuedAt:         now,
		NextAttemptAt:      now,
		Status:             pushStatusPending,
	})
	return err
}

// ClaimBatch fetches up to `limit` pending rows whose next_attempt_at <= now.
// Caller is responsible for re-queuing or marking permanent.
func (o *PushOutbox) ClaimBatch(ctx context.Context, limit int) ([]PushOutboxRow, error) {
	cursor, err := o.col.Find(ctx, bson.M{
		"status":          pushStatusPending,
		"next_attempt_at": bson.M{"$lte": time.Now()},
	}, options.Find().SetLimit(int64(limit)).SetSort(bson.D{{Key: "next_attempt_at", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var rows []PushOutboxRow
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// MarkSuccess deletes the row after a successful drain.
func (o *PushOutbox) MarkSuccess(ctx context.Context, id primitive.ObjectID) error {
	_, err := o.col.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

// MarkFailure increments attempt_count, sets next_attempt_at with backoff,
// stores last_error, and flips to failed_permanent after pushMaxAttempts.
func (o *PushOutbox) MarkFailure(ctx context.Context, id primitive.ObjectID, attempt int, errMsg string) error {
	backoff := backoffFor(attempt)
	status := pushStatusPending
	if attempt+1 >= pushMaxAttempts {
		status = pushStatusFailedPermanent
	}
	_, err := o.col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{
		"$set": bson.M{
			"attempt_count":   attempt + 1,
			"next_attempt_at": time.Now().Add(backoff),
			"last_error":      errMsg,
			"status":          status,
		},
	})
	return err
}

// backoffFor returns the wait before retrying attempt n (0-indexed).
// 10s, 30s, 1m, 5m, 15m, 1h, then 1h repeating.
func backoffFor(attempt int) time.Duration {
	schedule := []time.Duration{
		10 * time.Second,
		30 * time.Second,
		1 * time.Minute,
		5 * time.Minute,
		15 * time.Minute,
		1 * time.Hour,
	}
	if attempt < 0 {
		attempt = 0
	}
	if attempt >= len(schedule) {
		return schedule[len(schedule)-1]
	}
	return schedule[attempt]
}
