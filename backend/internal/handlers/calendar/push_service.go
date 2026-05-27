package calendar

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.opentelemetry.io/otel"
)

// ProcessPushRow handles one outbox row end-to-end. Returns nil on success,
// an error otherwise; the worker translates that into a backoff via MarkFailure.
func (s *Service) ProcessPushRow(ctx context.Context, row PushOutboxRow) error {
	ctx, span := otel.Tracer("kindred").Start(ctx, "calendar.push.process")
	defer span.End()
	slog.Info("Push: processing outbox row",
		"row_id", row.ID,
		"task_id", row.TaskID,
		"op", row.Op,
		"attempt", row.AttemptCount)

	switch row.Op {
	case PushOpDelete:
		return s.processPushDelete(ctx, row)
	case PushOpUpsert:
		return s.processPushUpsert(ctx, row)
	default:
		return fmt.Errorf("unknown push op: %s", row.Op)
	}
}

func (s *Service) processPushDelete(ctx context.Context, row PushOutboxRow) error {
	if row.TargetEventID == "" || row.TargetCalendarID == "" || row.TargetConnectionID.IsZero() {
		slog.Warn("Push delete missing target snapshot; nothing to do", "row_id", row.ID)
		return nil
	}
	conn, err := s.connectionByID(ctx, row.TargetConnectionID)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			slog.Info("Push delete: connection gone, treating as success", "connection_id", row.TargetConnectionID)
			return nil
		}
		return fmt.Errorf("load connection: %w", err)
	}
	provider, ok := s.providers[conn.Provider]
	if !ok {
		return fmt.Errorf("unsupported provider %s", conn.Provider)
	}
	token, err := s.getValidToken(ctx, conn)
	if err != nil {
		return fmt.Errorf("refresh token: %w", err)
	}
	if err := provider.DeleteEvent(ctx, token, row.TargetCalendarID, row.TargetEventID); err != nil {
		return fmt.Errorf("provider delete: %w", err)
	}

	// Clear pushed_* fields on the task if they still point at this event.
	_, _ = s.categories.UpdateOne(ctx,
		bson.M{
			"_id":                   row.CategoryID,
			"tasks._id":             row.TaskID,
			"tasks.pushed_event_id": row.TargetEventID,
		},
		bson.M{
			"$unset": bson.M{
				"tasks.$.pushed_event_id":    "",
				"tasks.$.pushed_calendar_id": "",
				"tasks.$.pushed_event_etag":  "",
			},
		},
	)
	return nil
}

func (s *Service) processPushUpsert(ctx context.Context, row PushOutboxRow) error {
	task, category, err := s.loadTaskWithCategory(ctx, row.TaskID, row.CategoryID)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			slog.Info("Push upsert: task or category gone, dropping", "task_id", row.TaskID)
			return nil
		}
		return fmt.Errorf("load task: %w", err)
	}
	if !category.PushEnabled {
		slog.Info("Push upsert: category push disabled, dropping", "category_id", row.CategoryID)
		return nil
	}
	connID, calendarID, ok := parseCategoryIntegration(category.Integration)
	if !ok {
		slog.Info("Push upsert: category integration not a Google calendar, dropping", "integration", category.Integration)
		return nil
	}

	ev, err := BuildProviderEventFromTask(task, calendarID)
	if err != nil {
		if errors.Is(err, ErrTaskNotPushable) {
			// Task lost its date. If we previously pushed an event, delete it now —
			// otherwise the calendar would carry a stale event indefinitely.
			if task.PushedEventID != "" {
				slog.Info("Push upsert: task no longer pushable, deleting prior event", "task_id", task.ID, "event_id", task.PushedEventID)
				return s.deleteEventForTask(ctx, task, row.CategoryID)
			}
			slog.Info("Push upsert: task not pushable and never was pushed, dropping", "task_id", task.ID)
			return nil
		}
		return fmt.Errorf("build event: %w", err)
	}

	conn, err := s.connectionByID(ctx, connID)
	if err != nil {
		return fmt.Errorf("load connection: %w", err)
	}
	provider, ok2 := s.providers[conn.Provider]
	if !ok2 {
		return fmt.Errorf("unsupported provider %s", conn.Provider)
	}
	token, err := s.getValidToken(ctx, conn)
	if err != nil {
		return fmt.Errorf("refresh token: %w", err)
	}

	var written ProviderEvent
	if task.PushedEventID == "" {
		written, err = provider.CreateEvent(ctx, token, ev)
		if err != nil {
			return fmt.Errorf("provider create: %w", err)
		}
	} else {
		written, err = provider.UpdateEvent(ctx, token, task.PushedEventID, ev)
		if err != nil {
			return fmt.Errorf("provider update: %w", err)
		}
	}

	_, err = s.categories.UpdateOne(ctx,
		bson.M{"_id": row.CategoryID, "tasks._id": row.TaskID},
		bson.M{
			"$set": bson.M{
				"tasks.$.pushed_event_id":    written.ID,
				"tasks.$.pushed_calendar_id": written.CalendarID,
				"tasks.$.pushed_event_etag":  written.ExtendedProperties["etag"],
			},
		},
	)
	if err != nil {
		return fmt.Errorf("persist pushed_event_id: %w", err)
	}
	return nil
}

// deleteEventForTask deletes the task's previously-pushed event using the
// connection inferred from its category's integration field. Also clears the
// task's pushed_* fields.
func (s *Service) deleteEventForTask(ctx context.Context, task *types.TaskDocument, categoryID primitive.ObjectID) error {
	var cat struct {
		Integration string `bson:"integration"`
	}
	if err := s.categories.FindOne(ctx, bson.M{"_id": categoryID}).Decode(&cat); err != nil {
		return fmt.Errorf("load category for delete: %w", err)
	}
	connID, _, ok := parseCategoryIntegration(cat.Integration)
	if !ok {
		return nil
	}
	conn, err := s.connectionByID(ctx, connID)
	if err != nil {
		return fmt.Errorf("load connection for delete: %w", err)
	}
	provider, ok := s.providers[conn.Provider]
	if !ok {
		return fmt.Errorf("unsupported provider %s", conn.Provider)
	}
	token, err := s.getValidToken(ctx, conn)
	if err != nil {
		return fmt.Errorf("refresh token: %w", err)
	}
	if err := provider.DeleteEvent(ctx, token, task.PushedCalendarID, task.PushedEventID); err != nil {
		return fmt.Errorf("provider delete: %w", err)
	}
	_, _ = s.categories.UpdateOne(ctx,
		bson.M{"_id": categoryID, "tasks._id": task.ID},
		bson.M{"$unset": bson.M{
			"tasks.$.pushed_event_id":    "",
			"tasks.$.pushed_calendar_id": "",
			"tasks.$.pushed_event_etag":  "",
		}},
	)
	return nil
}

// connectionByID is a thin helper around the connections collection.
func (s *Service) connectionByID(ctx context.Context, id primitive.ObjectID) (*CalendarConnection, error) {
	var conn CalendarConnection
	err := s.connections.FindOne(ctx, bson.M{"_id": id}).Decode(&conn)
	if err != nil {
		return nil, err
	}
	return &conn, nil
}

// categoryRow is a partial category projection — only what the push worker needs.
type categoryRow struct {
	ID          primitive.ObjectID `bson:"_id"`
	Integration string             `bson:"integration"`
	PushEnabled bool               `bson:"push_enabled"`
}

// loadTaskWithCategory finds the embedded task in its category.
func (s *Service) loadTaskWithCategory(ctx context.Context, taskID, categoryID primitive.ObjectID) (*types.TaskDocument, *categoryRow, error) {
	var doc struct {
		ID          primitive.ObjectID   `bson:"_id"`
		Integration string               `bson:"integration"`
		PushEnabled bool                 `bson:"push_enabled"`
		Tasks       []types.TaskDocument `bson:"tasks"`
	}
	err := s.categories.FindOne(ctx, bson.M{
		"_id":       categoryID,
		"tasks._id": taskID,
	}).Decode(&doc)
	if err != nil {
		return nil, nil, err
	}
	for i := range doc.Tasks {
		if doc.Tasks[i].ID == taskID {
			return &doc.Tasks[i], &categoryRow{
				ID:          doc.ID,
				Integration: doc.Integration,
				PushEnabled: doc.PushEnabled,
			}, nil
		}
	}
	return nil, nil, mongo.ErrNoDocuments
}

// parseCategoryIntegration extracts (connectionID, calendarID) from "gcal:<connID>:<calID>".
// Returns ok=false if the format does not match.
func parseCategoryIntegration(integration string) (primitive.ObjectID, string, bool) {
	const prefix = "gcal:"
	if len(integration) < len(prefix) || integration[:len(prefix)] != prefix {
		return primitive.NilObjectID, "", false
	}
	rest := integration[len(prefix):]
	// Find the second colon; everything before is the connection id (24 hex chars).
	colonIdx := -1
	for i := 0; i < len(rest); i++ {
		if rest[i] == ':' {
			colonIdx = i
			break
		}
	}
	if colonIdx <= 0 || colonIdx >= len(rest)-1 {
		return primitive.NilObjectID, "", false
	}
	connID, err := primitive.ObjectIDFromHex(rest[:colonIdx])
	if err != nil {
		return primitive.NilObjectID, "", false
	}
	return connID, rest[colonIdx+1:], true
}
