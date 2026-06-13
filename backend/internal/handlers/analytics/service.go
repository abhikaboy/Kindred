package analytics

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Service loads the raw corpus for a user and delegates the math to the pure
// computeAnalytics function so the heavy logic stays unit-testable.
type Service struct {
	Completed      *mongo.Collection
	Categories     *mongo.Collection
	Templates      *mongo.Collection
	Encouragements *mongo.Collection
}

func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Completed:      collections["completed-tasks"],
		Categories:     collections["categories"],
		Templates:      collections["template-tasks"],
		Encouragements: collections["encouragements"],
	}
}

// GetAnalytics builds the widget-ready dashboard payload for one user.
func (s *Service) GetAnalytics(userID primitive.ObjectID, rng, workspace, category string) (AnalyticsResponse, error) {
	ctx := context.Background()
	now := xutils.NowUTC()

	curStart, curEnd, prevStart, prevEnd, _ := windowBounds(rng, now)

	// Load completed tasks back to the earliest window we need (the heatmap
	// reaches further back than the previous period for short ranges).
	loadStart := prevStart
	if hm := startOfDay(now).AddDate(0, 0, -(heatmapDays - 1)); hm.Before(loadStart) {
		loadStart = hm
	}

	completed, err := s.loadCompleted(ctx, userID, loadStart)
	if err != nil {
		return AnalyticsResponse{}, err
	}
	categories, err := s.loadCategories(ctx, userID)
	if err != nil {
		return AnalyticsResponse{}, err
	}
	habits, err := s.loadHabits(ctx, userID)
	if err != nil {
		return AnalyticsResponse{}, err
	}
	supportCur := s.countSupport(ctx, userID, curStart, curEnd)
	supportPrev := s.countSupport(ctx, userID, prevStart, prevEnd)

	in := computeInput{
		Range:           rng,
		Now:             now,
		WorkspaceFilter: workspace,
		CategoryFilter:  category,
		Completed:       completed,
		Categories:      categories,
		Habits:          habits,
		SupportCurrent:  supportCur,
		SupportPrev:     supportPrev,
	}
	return computeAnalytics(in), nil
}

func (s *Service) loadCompleted(ctx context.Context, userID primitive.ObjectID, since time.Time) ([]AnalyticsTaskLite, error) {
	if s.Completed == nil {
		return nil, nil
	}
	filter := bson.M{
		"user":          userID,
		"timeCompleted": bson.M{"$gte": since},
	}
	cursor, err := s.Completed.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	out := []AnalyticsTaskLite{}
	for cursor.Next(ctx) {
		var t types.TaskDocument
		if err := cursor.Decode(&t); err != nil {
			slog.Warn("analytics: skipping undecodable completed task", "error", err)
			continue
		}
		if t.TimeCompleted == nil {
			continue
		}
		catID := ""
		if !t.CategoryID.IsZero() {
			catID = t.CategoryID.Hex()
		}
		out = append(out, AnalyticsTaskLite{
			CategoryID:  catID,
			CompletedAt: t.TimeCompleted.UTC(),
			Deadline:    t.Deadline,
			KudosCount:  len(t.Encouragements),
		})
	}
	return out, cursor.Err()
}

func (s *Service) loadCategories(ctx context.Context, userID primitive.ObjectID) ([]AnalyticsCategoryMeta, error) {
	if s.Categories == nil {
		return nil, nil
	}
	cursor, err := s.Categories.Find(ctx, bson.M{"user": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	out := []AnalyticsCategoryMeta{}
	for cursor.Next(ctx) {
		var c types.CategoryDocument
		if err := cursor.Decode(&c); err != nil {
			slog.Warn("analytics: skipping undecodable category", "error", err)
			continue
		}
		out = append(out, AnalyticsCategoryMeta{
			ID:        c.ID.Hex(),
			Name:      c.Name,
			Workspace: c.WorkspaceName,
		})
	}
	return out, cursor.Err()
}

func (s *Service) loadHabits(ctx context.Context, userID primitive.ObjectID) ([]AnalyticsHabitLite, error) {
	if s.Templates == nil {
		return nil, nil
	}
	cursor, err := s.Templates.Find(ctx, bson.M{"userID": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	out := []AnalyticsHabitLite{}
	for cursor.Next(ctx) {
		var t types.TemplateTaskDocument
		if err := cursor.Decode(&t); err != nil {
			slog.Warn("analytics: skipping undecodable template", "error", err)
			continue
		}
		catID := ""
		if !t.CategoryID.IsZero() {
			catID = t.CategoryID.Hex()
		}
		out = append(out, AnalyticsHabitLite{
			TemplateID:      t.ID.Hex(),
			CategoryID:      catID,
			Title:           t.Content,
			Frequency:       t.RecurFrequency,
			Streak:          t.Streak,
			CompletionDates: t.CompletionDates,
			NextDueAt:       t.NextGenerated,
		})
	}
	return out, cursor.Err()
}

func (s *Service) countSupport(ctx context.Context, userID primitive.ObjectID, start, end time.Time) int {
	if s.Encouragements == nil {
		return 0
	}
	count, err := s.Encouragements.CountDocuments(ctx, bson.M{
		"receiver":  userID,
		"timestamp": bson.M{"$gte": start, "$lt": end},
	})
	if err != nil {
		slog.Warn("analytics: support count failed", "error", err)
		return 0
	}
	return int(count)
}
