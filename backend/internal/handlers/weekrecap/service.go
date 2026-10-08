package weekrecap

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const proxyCategoryName = "!-proxy-!"

// Service loads the week's raw data; compute() does the math.
type Service struct {
	Completed       *mongo.Collection
	Categories      *mongo.Collection
	Templates       *mongo.Collection
	Encouragements  *mongo.Collection
	Congratulations *mongo.Collection
	RingStates      *mongo.Collection
}

func newService(c map[string]*mongo.Collection) *Service {
	return &Service{
		Completed:       c["completed-tasks"],
		Categories:      c["categories"],
		Templates:       c["template-tasks"],
		Encouragements:  c["encouragements"],
		Congratulations: c["congratulations"],
		RingStates:      c["ring_states"],
	}
}

func (s *Service) Get(ctx context.Context, userID primitive.ObjectID, timezone string) (WeekRecapResponse, error) {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now()
	start := recapWindow(now, loc)
	end := start.AddDate(0, 0, 7)
	since := start.AddDate(0, 0, -7*baselineWeeks)

	in := computeInput{Now: now, Loc: loc}
	if in.Completed, err = s.loadCompleted(ctx, userID, since, end); err != nil {
		return WeekRecapResponse{}, err
	}
	in.FirstActivity = s.firstActivity(ctx, userID)
	if in.Habits, err = s.loadHabits(ctx, userID, start.AddDate(0, 0, -7*habitLookback)); err != nil {
		return WeekRecapResponse{}, err
	}
	if in.Open, err = s.loadOpen(ctx, userID, now); err != nil {
		return WeekRecapResponse{}, err
	}
	in.Kudos = append(s.loadKudos(ctx, s.Encouragements, userID, start, end, false),
		s.loadKudos(ctx, s.Congratulations, userID, start, end, true)...)
	in.PlanClosed = s.planClosedDays(ctx, userID, start)
	return compute(in), nil
}

func (s *Service) loadCompleted(ctx context.Context, userID primitive.ObjectID, since, until time.Time) ([]time.Time, error) {
	out := []time.Time{}
	if s.Completed == nil {
		return out, nil
	}
	cur, err := s.Completed.Find(ctx, bson.M{"user": userID, "timeCompleted": bson.M{"$gte": since, "$lt": until}},
		options.Find().SetProjection(bson.M{"timeCompleted": 1}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	for cur.Next(ctx) {
		var d struct {
			TimeCompleted *time.Time `bson:"timeCompleted"`
		}
		if cur.Decode(&d) == nil && d.TimeCompleted != nil {
			out = append(out, *d.TimeCompleted)
		}
	}
	return out, cur.Err()
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

func (s *Service) loadHabits(ctx context.Context, userID primitive.ObjectID, since time.Time) ([]habitLite, error) {
	out := []habitLite{}
	if s.Templates == nil {
		return out, nil
	}
	cur, err := s.Templates.Find(ctx, bson.M{"userID": userID})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	for cur.Next(ctx) {
		var t types.TemplateTaskDocument
		if err := cur.Decode(&t); err != nil {
			slog.Warn("week recap: skipping undecodable template", "error", err)
			continue
		}
		dates := []time.Time{}
		for _, d := range t.CompletionDates {
			if !d.Before(since) {
				dates = append(dates, d)
			}
		}
		if len(dates) > 0 {
			out = append(out, habitLite{ID: t.ID.Hex(), Title: t.Content, Frequency: t.RecurFrequency, Dates: dates})
		}
	}
	return out, cur.Err()
}

func (s *Service) loadOpen(ctx context.Context, userID primitive.ObjectID, now time.Time) ([]openTaskLite, error) {
	out := []openTaskLite{}
	if s.Categories == nil {
		return out, nil
	}
	cur, err := s.Categories.Find(ctx, bson.M{"user": userID})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	for cur.Next(ctx) {
		var c types.CategoryDocument
		if err := cur.Decode(&c); err != nil || c.Name == proxyCategoryName {
			continue
		}
		for _, t := range c.Tasks {
			if !t.Active || t.ReleasedAt != nil || t.SomedayAt != nil || t.ParkedAt != nil || t.Recurring {
				continue
			}
			out = append(out, openTaskLite{
				ID:            t.ID.Hex(),
				CategoryID:    c.ID.Hex(),
				Title:         t.Content,
				CreatedAt:     t.Timestamp,
				Deadline:      t.Deadline,
				Reschedules:   t.RescheduleCount,
				HasFuturePlan: t.Plan != nil && t.Plan.At.After(now),
			})
		}
	}
	return out, cur.Err()
}

func (s *Service) loadKudos(ctx context.Context, coll *mongo.Collection, userID primitive.ObjectID, start, end time.Time, congrats bool) []kudosLite {
	out := []kudosLite{}
	if coll == nil {
		return out
	}
	cur, err := coll.Find(ctx, bson.M{"receiver": userID, "timestamp": bson.M{"$gte": start, "$lt": end}})
	if err != nil {
		slog.Warn("week recap: kudos query failed", "error", err)
		return out
	}
	defer cur.Close(ctx)
	for cur.Next(ctx) {
		var d struct {
			Sender struct {
				Name    string             `bson:"name"`
				Picture string             `bson:"picture"`
				ID      primitive.ObjectID `bson:"id"`
			} `bson:"sender"`
			Message   string    `bson:"message"`
			TaskName  string    `bson:"taskName"`
			Type      string    `bson:"type"`
			Timestamp time.Time `bson:"timestamp"`
		}
		if cur.Decode(&d) != nil || d.Sender.ID.IsZero() || d.Sender.ID == userID {
			continue
		}
		out = append(out, kudosLite{
			SenderID: d.Sender.ID.Hex(), Name: d.Sender.Name, Icon: d.Sender.Picture,
			Message: d.Message, TaskName: d.TaskName, Type: d.Type, Congrats: congrats, At: d.Timestamp,
		})
	}
	return out
}

// planClosedDays counts days the Plan ring closed. Ring dates are stored as
// the local calendar day at midnight UTC.
func (s *Service) planClosedDays(ctx context.Context, userID primitive.ObjectID, start time.Time) int {
	if s.RingStates == nil {
		return 0
	}
	from := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	n, err := s.RingStates.CountDocuments(ctx, bson.M{
		"user_id":     userID,
		"date":        bson.M{"$gte": from, "$lt": from.AddDate(0, 0, 7)},
		"plan.closed": true,
	})
	if err != nil {
		slog.Warn("week recap: ring count failed", "error", err)
		return 0
	}
	return int(n)
}
