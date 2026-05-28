package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/robfig/cron/v3"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
)

// PushOutboxCollectionName is the MongoDB collection that holds the calendar
// push outbox rows (tasks queued to be pushed to Google Calendar).
const PushOutboxCollectionName = "calendar_push_outbox"

// pushOutboxLagMetricName is the OTel metric emitted by this sampler.
// It reports how stale the oldest pending row is (now - enqueued_at) in seconds.
const pushOutboxLagMetricName = "calendar_push_outbox_lag_seconds"

// CalendarPushOutboxLagJob periodically samples the calendar push outbox and
// records a gauge `calendar_push_outbox_lag_seconds` so operators can see when
// the push worker is falling behind (token refresh failures, Google quota
// exhaustion, etc.) before users notice their tasks aren't appearing in
// Google Calendar.
//
// The job is read-only — it never mutates outbox rows.
type CalendarPushOutboxLagJob struct {
	outbox   *mongo.Collection
	lagGauge metric.Float64Gauge
}

// NewCalendarPushOutboxLagJob constructs a new lag sampler. It registers the
// OTel gauge on the global meter provider configured by internal/otel. Returns
// an error if the gauge cannot be created.
func NewCalendarPushOutboxLagJob(outbox *mongo.Collection) (*CalendarPushOutboxLagJob, error) {
	meter := otel.GetMeterProvider().Meter("github.com/abhikaboy/Kindred/internal/jobs")
	gauge, err := meter.Float64Gauge(
		pushOutboxLagMetricName,
		metric.WithUnit("s"),
		metric.WithDescription("Age in seconds of the oldest pending row in the calendar push outbox (now - min(enqueued_at) where status='pending'); 0 when the outbox has no pending rows."),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create %s gauge: %w", pushOutboxLagMetricName, err)
	}
	return &CalendarPushOutboxLagJob{
		outbox:   outbox,
		lagGauge: gauge,
	}, nil
}

// StartCron registers the sampler on the given cron scheduler. Runs every 1h,
// matching the calendar heartbeat cadence. Also runs once on startup so the
// gauge has a value before the first hour elapses.
func (j *CalendarPushOutboxLagJob) StartCron(c *cron.Cron) {
	_, err := c.AddFunc("@every 1h", func() {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				slog.Error("Panic recovered in calendar push outbox lag sampler", "panic", r, "stack", stack)
				sentry.CurrentHub().Recover(r)
				sentry.Flush(2e9)
			}
		}()

		ctx := context.Background()
		if _, err := j.Sample(ctx); err != nil {
			slog.Error("Calendar push outbox lag sampler failed", "error", err)
			sentry.CaptureException(fmt.Errorf("calendar push outbox lag sampler failed: %w", err))
		}
	})
	if err != nil {
		slog.Error("Error adding calendar push outbox lag cron job", "error", err)
	} else {
		slog.Info("Calendar push outbox lag cron registered (every 1h)")
	}

	// Run once on startup (with a short delay to let things initialize).
	go func() {
		time.Sleep(10 * time.Second)
		ctx := context.Background()
		if _, err := j.Sample(ctx); err != nil {
			slog.Error("Initial calendar push outbox lag sample failed", "error", err)
			sentry.CaptureException(fmt.Errorf("initial calendar push outbox lag sample failed: %w", err))
		}
	}()
}

// Sample queries the outbox for the oldest pending row, computes the lag in
// seconds (now - enqueued_at), and records it on the gauge. Emits 0 when no
// pending rows exist. Returns the recorded value (useful for tests).
//
// The query is a cheap findOne sorted by enqueued_at ascending, projecting only
// enqueued_at. It is expected to be covered by an index on
// (status: 1, enqueued_at: 1) — see follow-up note in the ticket.
func (j *CalendarPushOutboxLagJob) Sample(ctx context.Context) (float64, error) {
	filter := bson.M{"status": "pending"}
	opts := options.FindOne().
		SetSort(bson.D{{Key: "enqueued_at", Value: 1}}).
		SetProjection(bson.M{"enqueued_at": 1, "_id": 0})

	var row struct {
		EnqueuedAt time.Time `bson:"enqueued_at"`
	}

	err := j.outbox.FindOne(ctx, filter, opts).Decode(&row)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// No pending rows — worker is fully caught up.
			j.lagGauge.Record(ctx, 0)
			return 0, nil
		}
		return 0, fmt.Errorf("failed to query calendar push outbox: %w", err)
	}

	lag := time.Since(row.EnqueuedAt).Seconds()
	if lag < 0 {
		// Clock skew or future-dated enqueue — clamp to 0 so the gauge stays
		// monotonically meaningful.
		lag = 0
	}
	j.lagGauge.Record(ctx, lag)
	return lag, nil
}
