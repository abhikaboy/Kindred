package jobs_test

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/jobs"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// CalendarPushOutboxLagTestSuite exercises the lag sampler against a real
// ephemeral MongoDB collection so the bson tags and index-friendly query are
// validated against actual MongoDB behavior.
type CalendarPushOutboxLagTestSuite struct {
	testpkg.BaseSuite
	outbox *mongo.Collection
	job    *jobs.CalendarPushOutboxLagJob
}

func (s *CalendarPushOutboxLagTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()

	// The outbox collection is not part of the default test collections map —
	// we grab it directly off the ephemeral test database.
	s.outbox = s.TestDB.DB.Collection(jobs.PushOutboxCollectionName)

	job, err := jobs.NewCalendarPushOutboxLagJob(s.outbox)
	s.Require().NoError(err)
	s.job = job
}

func TestCalendarPushOutboxLagSuite(t *testing.T) {
	suite.Run(t, new(CalendarPushOutboxLagTestSuite))
}

// TestSample_PendingRow_ReportsLag inserts a single pending row with
// enqueued_at = now - 90s, then asserts the sampler returns ~90s.
func (s *CalendarPushOutboxLagTestSuite) TestSample_PendingRow_ReportsLag() {
	enqueuedAt := time.Now().Add(-90 * time.Second)
	_, err := s.outbox.InsertOne(s.Ctx, bson.M{
		"status":      "pending",
		"enqueued_at": enqueuedAt,
	})
	s.Require().NoError(err)

	lag, err := s.job.Sample(s.Ctx)
	s.Require().NoError(err)

	// Allow a generous tolerance window — the wall clock advances between
	// "now - 90s" and the Sample call, plus MongoDB round-trip latency.
	s.InDelta(90.0, lag, 5.0, "lag should be approximately 90 seconds (got %.2f)", lag)
}

// TestSample_OldestPendingWins_NonPendingIgnored verifies the sampler picks
// the smallest enqueued_at among pending rows and ignores other statuses.
func (s *CalendarPushOutboxLagTestSuite) TestSample_OldestPendingWins_NonPendingIgnored() {
	now := time.Now()

	// Oldest row is non-pending and must be ignored.
	_, err := s.outbox.InsertOne(s.Ctx, bson.M{
		"status":      "failed_permanent",
		"enqueued_at": now.Add(-10 * time.Minute),
	})
	s.Require().NoError(err)

	// Two pending rows — the older one (120s) should determine the lag.
	_, err = s.outbox.InsertOne(s.Ctx, bson.M{
		"status":      "pending",
		"enqueued_at": now.Add(-30 * time.Second),
	})
	s.Require().NoError(err)
	_, err = s.outbox.InsertOne(s.Ctx, bson.M{
		"status":      "pending",
		"enqueued_at": now.Add(-120 * time.Second),
	})
	s.Require().NoError(err)

	lag, err := s.job.Sample(s.Ctx)
	s.Require().NoError(err)

	s.InDelta(120.0, lag, 5.0, "lag should reflect the oldest pending row (got %.2f)", lag)
}

// TestSample_NoPendingRows_EmitsZero verifies that an empty outbox (or one
// containing only non-pending rows) reports 0.
func (s *CalendarPushOutboxLagTestSuite) TestSample_NoPendingRows_EmitsZero() {
	s.Run("empty_collection", func() {
		lag, err := s.job.Sample(s.Ctx)
		s.Require().NoError(err)
		s.Equal(0.0, lag, "empty outbox should report 0")
	})

	s.Run("only_completed_rows", func() {
		_, err := s.outbox.InsertOne(s.Ctx, bson.M{
			"status":      "completed",
			"enqueued_at": time.Now().Add(-1 * time.Hour),
		})
		s.Require().NoError(err)

		lag, err := s.job.Sample(s.Ctx)
		s.Require().NoError(err)
		s.Equal(0.0, lag, "outbox with no pending rows should report 0")
	})
}
