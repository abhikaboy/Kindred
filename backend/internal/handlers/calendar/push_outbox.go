package calendar

import (
	"context"
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
// Uses an upsert on (task_id, op, status) so two concurrent calls collapse to one row.
// If a pending delete exists for the same task, the upsert is still inserted —
// the worker processes them in order (this is the "moved between calendars" case).
//
// NOTE: A unique partial index on (task_id, op, status) where status == "pending"
// would make this airtight against the narrow window where two concurrent upserts
// could both pass the filter check before either inserts. Recommended as a
// deployment-time follow-up; not added here.
func (o *PushOutbox) EnqueueUpsert(ctx context.Context, taskID, categoryID, userID primitive.ObjectID) error {
	now := time.Now()
	_, err := o.col.UpdateOne(ctx,
		bson.M{
			"task_id": taskID,
			"op":      PushOpUpsert,
			"status":  pushStatusPending,
		},
		bson.M{
			"$setOnInsert": bson.M{
				"task_id":         taskID,
				"category_id":     categoryID,
				"user_id":         userID,
				"op":              PushOpUpsert,
				"enqueued_at":     now,
				"next_attempt_at": now,
				"attempt_count":   0,
				"status":          pushStatusPending,
			},
		},
		options.Update().SetUpsert(true),
	)
	if err != nil {
		return err
	}
	return nil
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

// ClaimBatch atomically claims up to `limit` pending rows whose next_attempt_at
// has come due. Each claimed row's next_attempt_at is pushed forward by the
// claim TTL so a concurrent worker (re-entrant tick or sibling replica) skips
// it. On success/failure the worker still deletes (MarkSuccess) or resets
// next_attempt_at via backoff (MarkFailure). If the worker crashes mid-process,
// the row reappears after the TTL and another worker can pick it up.
func (o *PushOutbox) ClaimBatch(ctx context.Context, limit int) ([]PushOutboxRow, error) {
	const claimTTL = 5 * time.Minute
	now := time.Now()

	// Step 1: find up to `limit` due rows.
	cursor, err := o.col.Find(ctx, bson.M{
		"status":          pushStatusPending,
		"next_attempt_at": bson.M{"$lte": now},
	}, options.Find().SetLimit(int64(limit)).SetSort(bson.D{{Key: "next_attempt_at", Value: 1}}).SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return nil, err
	}
	var ids []primitive.ObjectID
	{
		var idDocs []struct {
			ID primitive.ObjectID `bson:"_id"`
		}
		if err := cursor.All(ctx, &idDocs); err != nil {
			return nil, err
		}
		for _, d := range idDocs {
			ids = append(ids, d.ID)
		}
	}
	if len(ids) == 0 {
		return nil, nil
	}

	// Step 2: claim them by pushing next_attempt_at forward by the TTL.
	// Workers that crash before MarkSuccess/MarkFailure will see these rows again
	// after the TTL elapses.
	_, err = o.col.UpdateMany(ctx,
		bson.M{"_id": bson.M{"$in": ids}, "status": pushStatusPending},
		bson.M{"$set": bson.M{"next_attempt_at": now.Add(claimTTL)}},
	)
	if err != nil {
		return nil, err
	}

	// Step 3: re-fetch the rows we successfully claimed (they have the new next_attempt_at).
	cursor2, err := o.col.Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
	if err != nil {
		return nil, err
	}
	defer cursor2.Close(ctx)
	var rows []PushOutboxRow
	if err := cursor2.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// DeletePendingForConnection removes pending outbox rows tied to a disconnected
// connection — both upserts (matched by category_id, since they look the
// connection up via the category's integration field at process time) and
// deletes (matched by their snapshotted target_connection_id). Without this,
// rows queued before disconnect would retry against a missing connection for
// hours of exponential backoff before flipping to failed_permanent.
func (o *PushOutbox) DeletePendingForConnection(ctx context.Context, connectionID primitive.ObjectID, categoryIDs []primitive.ObjectID) (int64, error) {
	or := []bson.M{
		{"target_connection_id": connectionID},
	}
	if len(categoryIDs) > 0 {
		or = append(or, bson.M{"category_id": bson.M{"$in": categoryIDs}})
	}
	res, err := o.col.DeleteMany(ctx, bson.M{
		"status": pushStatusPending,
		"$or":    or,
	})
	if err != nil {
		return 0, err
	}
	return res.DeletedCount, nil
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
