package rings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// "Life happened": a private, retroactive pause on a single day. A paused day
// drops out of the score window, excuses habits due that day, holds the daily
// run, and suppresses ring-close notifications.

const (
	MaxPauseDaysBack   = 2
	MaxPauseNoteLength = 140
)

var ErrPauseOutOfRange = errors.New("pause day out of range")

// DayInTimezone returns the day N days before today in the given timezone.
func DayInTimezone(timezone string, daysAgo int) time.Time {
	return TodayInTimezone(timezone).AddDate(0, 0, -daysAgo)
}

// LocalDay converts an instant to the user's calendar day (midnight UTC key).
func LocalDay(t time.Time, timezone string) time.Time {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	l := t.In(loc)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC)
}

// ForViewer strips the owner-only pause fields when someone else is looking.
func (st *RingState) ForViewer(isOwner bool) *RingState {
	if st == nil || isOwner {
		return st
	}
	c := *st
	c.Paused, c.PausedNote, c.PausedAt, c.RunHeld, c.RunRestored = false, "", nil, 0, false
	return &c
}

// PauseDay marks a day (0 = today, up to MaxPauseDaysBack) as life happened.
// Re-pausing an already paused day just updates the note.
func (s *RingService) PauseDay(ctx context.Context, userID primitive.ObjectID, timezone string, daysAgo int, note string) (*RingState, error) {
	if daysAgo < 0 || daysAgo > MaxPauseDaysBack {
		return nil, ErrPauseOutOfRange
	}
	note = strings.TrimSpace(note)
	if len([]rune(note)) > MaxPauseNoteLength {
		note = string([]rune(note)[:MaxPauseNoteLength])
	}
	day := DayInTimezone(timezone, daysAgo)
	existing, err := s.getOrCreateForDate(ctx, userID, day)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	set := bson.M{"paused": true, "paused_note": note, "updated_at": now}
	if !existing.Paused {
		set["paused_at"] = now
		var user types.User
		if err := s.users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
			return nil, fmt.Errorf("fetch user for pause: %w", err)
		}
		set["run_held"] = user.Streak
	}

	var state RingState
	err = s.ringStates.FindOneAndUpdate(ctx,
		bson.M{"user_id": userID, "date": day},
		bson.M{"$set": set},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&state)
	if err != nil {
		return nil, fmt.Errorf("pause day: %w", err)
	}
	if err := s.recalculateScore(ctx, userID, timezone); err != nil {
		return nil, err
	}
	return &state, nil
}

// UnpauseDay undoes a pause. If the pause had already restored the run, the
// restored amount is taken back off so undo is a true undo.
func (s *RingService) UnpauseDay(ctx context.Context, userID primitive.ObjectID, timezone string, daysAgo int) (*RingState, error) {
	if daysAgo < 0 || daysAgo > MaxPauseDaysBack {
		return nil, ErrPauseOutOfRange
	}
	day := DayInTimezone(timezone, daysAgo)
	var before RingState
	err := s.ringStates.FindOneAndUpdate(ctx,
		bson.M{"user_id": userID, "date": day},
		bson.M{
			"$unset": bson.M{"paused": "", "paused_note": "", "paused_at": "", "run_held": "", "run_restored": ""},
			"$set":   bson.M{"updated_at": time.Now()},
		},
	).Decode(&before)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return s.getOrCreateForDate(ctx, userID, day)
	}
	if err != nil {
		return nil, fmt.Errorf("unpause day: %w", err)
	}

	if before.RunRestored && before.RunHeld > 0 {
		_, err = s.users.UpdateOne(ctx, bson.M{"_id": userID}, mongo.Pipeline{
			{{Key: "$set", Value: bson.M{"streak": bson.M{"$max": bson.A{0, bson.M{"$subtract": bson.A{bson.M{"$ifNull": bson.A{"$streak", 0}}, before.RunHeld}}}}}}},
		})
		if err != nil {
			return nil, fmt.Errorf("revert held run: %w", err)
		}
	}
	if err := s.recalculateScore(ctx, userID, timezone); err != nil {
		return nil, err
	}
	return s.getOrCreateForDate(ctx, userID, day)
}

// IsDayPaused reports whether the user paused the given day.
func (s *RingService) IsDayPaused(ctx context.Context, userID primitive.ObjectID, day time.Time) bool {
	n, err := s.ringStates.CountDocuments(ctx, bson.M{"user_id": userID, "date": day, "paused": true})
	return err == nil && n > 0
}

// AllDaysPaused reports whether every instant falls on a day the user paused.
// Used to excuse habits that came due on paused days.
func (s *RingService) AllDaysPaused(ctx context.Context, userID primitive.ObjectID, timezone string, instants []time.Time) bool {
	if len(instants) == 0 {
		return false
	}
	days := make([]time.Time, 0, len(instants))
	seen := map[time.Time]bool{}
	for _, t := range instants {
		d := LocalDay(t, timezone)
		if !seen[d] {
			seen[d] = true
			days = append(days, d)
		}
	}
	n, err := s.ringStates.CountDocuments(ctx, bson.M{"user_id": userID, "date": bson.M{"$in": days}, "paused": true})
	return err == nil && int(n) == len(days)
}

// HoldRun repairs the daily run if it was reset by a paused day. The run held
// at pause time is added back once; only today's and yesterday's pauses apply.
func (s *RingService) HoldRun(ctx context.Context, userID primitive.ObjectID, timezone string) {
	today := TodayInTimezone(timezone)
	cur, err := s.ringStates.Find(ctx, bson.M{
		"user_id":      userID,
		"date":         bson.M{"$gte": today.AddDate(0, 0, -1), "$lte": today},
		"paused":       true,
		"run_held":     bson.M{"$gt": 0},
		"run_restored": bson.M{"$ne": true},
	}, options.Find().SetSort(bson.M{"date": -1}).SetLimit(1))
	if err != nil {
		return
	}
	var states []RingState
	if err := cur.All(ctx, &states); err != nil || len(states) == 0 {
		return
	}
	held := states[0]

	var user types.User
	if err := s.users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		return
	}
	if user.Streak >= held.RunHeld {
		return // not reset (yet)
	}
	if _, err := s.users.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$inc": bson.M{"streak": held.RunHeld}}); err != nil {
		slog.Error("hold run: restore failed", "error", err, "user_id", userID)
		return
	}
	_, _ = s.ringStates.UpdateOne(ctx, bson.M{"_id": held.ID}, bson.M{"$set": bson.M{"run_restored": true}})
}
