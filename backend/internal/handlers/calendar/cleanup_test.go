package calendar

import (
	"context"
	"testing"
	"time"

	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type CleanupAfterDisconnectSuite struct {
	testpkg.BaseSuite
	svc           *Service
	pushOutboxCol bson.M // placeholder so tests can find the collection by name
}

func TestCleanupAfterDisconnect(t *testing.T) {
	suite.Run(t, new(CleanupAfterDisconnectSuite))
}

func (s *CleanupAfterDisconnectSuite) SetupTest() {
	s.BaseSuite.SetupTest()

	// Build a Service directly with the test DB collections — we only exercise
	// the cleanup path, which depends solely on `categories` and `pushOutbox`.
	categories := s.Collections["categories"]
	db := categories.Database()
	connections := db.Collection("calendar_connections")
	pushOutbox := NewPushOutbox(db.Collection("calendar_push_outbox"))

	s.svc = &Service{
		connections: connections,
		categories:  categories,
		pushOutbox:  pushOutbox,
	}
}

func (s *CleanupAfterDisconnectSuite) TestClearsPushEnabledOnMatchingCategories() {
	user := s.GetUser(0)
	connID := primitive.NewObjectID()
	otherConnID := primitive.NewObjectID()

	matching := bson.M{
		"_id":           primitive.NewObjectID(),
		"name":          "Work",
		"workspaceName": "Cal",
		"user":          user.ID,
		"tasks":         []bson.M{},
		"integration":   "gcal:" + connID.Hex() + ":cal-a",
		"push_enabled":  true,
	}
	otherUser := bson.M{
		"_id":           primitive.NewObjectID(),
		"name":          "Someone else's",
		"workspaceName": "Cal",
		"user":          primitive.NewObjectID(),
		"tasks":         []bson.M{},
		"integration":   "gcal:" + connID.Hex() + ":cal-b",
		"push_enabled":  true,
	}
	otherConnection := bson.M{
		"_id":           primitive.NewObjectID(),
		"name":          "Other connection",
		"workspaceName": "Cal",
		"user":          user.ID,
		"tasks":         []bson.M{},
		"integration":   "gcal:" + otherConnID.Hex() + ":cal-x",
		"push_enabled":  true,
	}
	plain := bson.M{
		"_id":           primitive.NewObjectID(),
		"name":          "Not a calendar",
		"workspaceName": "Personal",
		"user":          user.ID,
		"tasks":         []bson.M{},
		"push_enabled":  false,
	}

	for _, doc := range []bson.M{matching, otherUser, otherConnection, plain} {
		_, err := s.Collections["categories"].InsertOne(s.Ctx, doc)
		s.Require().NoError(err)
	}

	s.svc.cleanupAfterDisconnect(s.Ctx, user.ID, connID)

	cases := []struct {
		id   primitive.ObjectID
		want bool
		desc string
	}{
		{matching["_id"].(primitive.ObjectID), false, "matching category should be cleared"},
		{otherUser["_id"].(primitive.ObjectID), true, "other user's category should be untouched"},
		{otherConnection["_id"].(primitive.ObjectID), true, "category linked to a different connection should be untouched"},
		{plain["_id"].(primitive.ObjectID), false, "non-calendar category should be unchanged (was false)"},
	}
	for _, tc := range cases {
		var got struct {
			PushEnabled bool `bson:"push_enabled"`
		}
		err := s.Collections["categories"].FindOne(s.Ctx, bson.M{"_id": tc.id}).Decode(&got)
		s.Require().NoError(err, tc.desc)
		s.Equal(tc.want, got.PushEnabled, tc.desc)
	}
}

func (s *CleanupAfterDisconnectSuite) TestDropsPendingPushOutboxRows() {
	user := s.GetUser(0)
	connID := primitive.NewObjectID()
	otherConnID := primitive.NewObjectID()

	matchingCatID := primitive.NewObjectID()
	otherCatID := primitive.NewObjectID()

	// Two categories: one linked to the disconnected connection, one to a different one.
	for _, doc := range []bson.M{
		{
			"_id":           matchingCatID,
			"name":          "Work",
			"workspaceName": "Cal",
			"user":          user.ID,
			"tasks":         []bson.M{},
			"integration":   "gcal:" + connID.Hex() + ":cal-a",
			"push_enabled":  true,
		},
		{
			"_id":           otherCatID,
			"name":          "Other",
			"workspaceName": "Cal",
			"user":          user.ID,
			"tasks":         []bson.M{},
			"integration":   "gcal:" + otherConnID.Hex() + ":cal-b",
			"push_enabled":  true,
		},
	} {
		_, err := s.Collections["categories"].InsertOne(s.Ctx, doc)
		s.Require().NoError(err)
	}

	now := time.Now()
	outboxCol := s.Collections["categories"].Database().Collection("calendar_push_outbox")

	// Three pending rows + one already-permanent row.
	upsertForMatching := PushOutboxRow{
		ID: primitive.NewObjectID(), TaskID: primitive.NewObjectID(), CategoryID: matchingCatID, UserID: user.ID,
		Op: PushOpUpsert, EnqueuedAt: now, NextAttemptAt: now, Status: pushStatusPending,
	}
	deleteForMatching := PushOutboxRow{
		ID: primitive.NewObjectID(), TaskID: primitive.NewObjectID(), CategoryID: matchingCatID, UserID: user.ID,
		Op: PushOpDelete, TargetConnectionID: connID, TargetCalendarID: "cal-a", TargetEventID: "evt1",
		EnqueuedAt: now, NextAttemptAt: now, Status: pushStatusPending,
	}
	upsertForOther := PushOutboxRow{
		ID: primitive.NewObjectID(), TaskID: primitive.NewObjectID(), CategoryID: otherCatID, UserID: user.ID,
		Op: PushOpUpsert, EnqueuedAt: now, NextAttemptAt: now, Status: pushStatusPending,
	}
	alreadyPermanent := PushOutboxRow{
		ID: primitive.NewObjectID(), TaskID: primitive.NewObjectID(), CategoryID: matchingCatID, UserID: user.ID,
		Op: PushOpUpsert, EnqueuedAt: now, NextAttemptAt: now, Status: pushStatusFailedPermanent,
	}
	for _, r := range []PushOutboxRow{upsertForMatching, deleteForMatching, upsertForOther, alreadyPermanent} {
		_, err := outboxCol.InsertOne(s.Ctx, r)
		s.Require().NoError(err)
	}

	s.svc.cleanupAfterDisconnect(s.Ctx, user.ID, connID)

	// The two pending rows referencing the disconnected connection (one upsert
	// matched by category_id, one delete matched by target_connection_id) are
	// gone; the row for the other connection and the already-permanent row
	// survive.
	survives := func(id primitive.ObjectID) bool {
		var dummy bson.M
		err := outboxCol.FindOne(s.Ctx, bson.M{"_id": id}).Decode(&dummy)
		return err == nil
	}
	s.False(survives(upsertForMatching.ID), "pending upsert for matching category should be dropped")
	s.False(survives(deleteForMatching.ID), "pending delete for matching connection should be dropped")
	s.True(survives(upsertForOther.ID), "pending upsert for unrelated category should survive")
	s.True(survives(alreadyPermanent.ID), "failed_permanent row should not be touched")
}

// Compile-time guard: keep the context import used in the file.
var _ = context.Background
