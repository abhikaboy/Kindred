package userreport

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/gemini"
	"github.com/abhikaboy/Kindred/internal/handlers/analytics"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Service loads raw data (mostly via analytics) and hands it to compute().
type Service struct {
	analytics       *analytics.Service
	Completed       *mongo.Collection
	Encouragements  *mongo.Collection
	Congratulations *mongo.Collection
	RingStates      *mongo.Collection
	Memory          *mongo.Collection
}

func newService(c map[string]*mongo.Collection) *Service {
	return &Service{
		analytics:       analytics.NewService(c),
		Completed:       c["completed-tasks"],
		Encouragements:  c["encouragements"],
		Congratulations: c["congratulations"],
		RingStates:      c["ring_states"],
		Memory:          c[gemini.UserMemoryCollection],
	}
}

func (s *Service) Get(ctx context.Context, userID primitive.ObjectID, timezone string) (UserReportResponse, error) {
	loc := analytics.LoadLocation(timezone)
	now := time.Now().In(loc)
	start := rangeStart(now)

	corpus, err := s.analytics.LoadCorpus(ctx, userID, start)
	if err != nil {
		return UserReportResponse{}, err
	}
	in := computeInput{
		Now:        now,
		Corpus:     corpus,
		Supporters: s.analytics.TopSupporters(ctx, userID, start, now),
		Facts:      s.loadFacts(ctx, userID),
	}
	in.FirstActivity = s.firstActivity(ctx, userID)
	for _, coll := range []*mongo.Collection{s.Encouragements, s.Congratulations} {
		in.KudosReceived += s.count(ctx, coll, bson.M{"receiver": userID, "timestamp": bson.M{"$gte": start}})
		in.KudosSent += s.count(ctx, coll, bson.M{"sender.id": userID, "timestamp": bson.M{"$gte": start}})
	}
	// Ring dates are stored as the local calendar day at midnight UTC.
	ringFrom := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	in.RingDays = s.count(ctx, s.RingStates, bson.M{"user_id": userID, "date": bson.M{"$gte": ringFrom}})
	return compute(in), nil
}

func (s *Service) count(ctx context.Context, coll *mongo.Collection, filter bson.M) int {
	if coll == nil {
		return 0
	}
	n, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		slog.Warn("user report: count failed", "collection", coll.Name(), "error", err)
		return 0
	}
	return int(n)
}

func (s *Service) firstActivity(ctx context.Context, userID primitive.ObjectID) *time.Time {
	if s.Completed == nil {
		return nil
	}
	var d struct {
		TimeCompleted *time.Time `bson:"timeCompleted"`
	}
	err := s.Completed.FindOne(ctx, bson.M{"user": userID, "timeCompleted": bson.M{"$ne": nil}},
		options.FindOne().SetSort(bson.M{"timeCompleted": 1}).SetProjection(bson.M{"timeCompleted": 1})).Decode(&d)
	if err != nil {
		return nil
	}
	return d.TimeCompleted
}

func (s *Service) loadFacts(ctx context.Context, userID primitive.ObjectID) []factLite {
	facts, err := gemini.LoadUserFacts(ctx, s.Memory, userID, 12)
	if err != nil {
		slog.Warn("user report: memory lookup failed", "error", err)
		return nil
	}
	out := make([]factLite, 0, len(facts))
	for _, f := range facts {
		out = append(out, factLite{Content: f.Content, Stated: f.Source == "stated"})
	}
	return out
}
