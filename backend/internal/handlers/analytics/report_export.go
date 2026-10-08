package analytics

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Exports for the report package, so it reuses these computations instead of copying them.

type StatedPeak = statedPeak

const (
	PeakMinTasks       = peakMinTasks
	PeakMinWindowCount = peakMinWindowCount
)

// Corpus is the raw per-user data analytics works from. Completed is in UTC.
type Corpus struct {
	Completed  []AnalyticsTaskLite
	Categories []AnalyticsCategoryMeta
	OpenTasks  []AnalyticsOpenTaskLite
	Habits     []AnalyticsHabitLite
	ProxyIDs   map[string]bool
	StatedPeak *StatedPeak
}

func NewService(c map[string]*mongo.Collection) *Service { return newService(c) }

func LoadLocation(tz string) *time.Location { return loadLocation(tz) }

func (s *Service) LoadCorpus(ctx context.Context, userID primitive.ObjectID, since time.Time) (Corpus, error) {
	var c Corpus
	var err error
	if c.Completed, err = s.loadCompleted(ctx, userID, since); err != nil {
		return c, err
	}
	if c.Categories, c.OpenTasks, c.ProxyIDs, err = s.loadCategories(ctx, userID); err != nil {
		return c, err
	}
	if c.Habits, err = s.loadHabits(ctx, userID); err != nil {
		return c, err
	}
	c.StatedPeak = s.loadStatedPeak(ctx, userID)
	return c, nil
}

func (s *Service) TopSupporters(ctx context.Context, userID primitive.ObjectID, start, end time.Time) []AnalyticsSupporter {
	return s.loadTopSupporters(ctx, userID, start, end)
}

// PeakTime applies the quick-add peak logic and gates; now must be in the user's location.
func PeakTime(tasks []AnalyticsTaskLite, now time.Time, stated *StatedPeak) *AnalyticsPeakTime {
	return computePeakTime(inLocation(tasks, now.Location()), now, stated)
}

func KudosEffect(tasks []AnalyticsTaskLite) AnalyticsKudosEffect { return computeKudosEffect(tasks) }

func OnTimeStats(tasks []AnalyticsTaskLite) (withDeadline, onTime int) { return onTimeStats(tasks) }

func Attention(open []AnalyticsOpenTaskLite, inScope func(string) bool, nameOf, workspaceOf func(string) string, now time.Time) AnalyticsAttention {
	return computeAttention(open, inScope, nameOf, workspaceOf, now)
}
