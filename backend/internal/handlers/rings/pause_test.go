package rings_test

import (
	"context"
	"time"

	. "github.com/abhikaboy/Kindred/internal/handlers/rings"
	"go.mongodb.org/mongo-driver/bson"
)

func (s *RingServiceTestSuite) setStreak(n int) {
	user := s.GetUser(0)
	_, err := s.users.UpdateOne(context.Background(), bson.M{"_id": user.ID}, bson.M{"$set": bson.M{"streak": n}})
	s.Require().NoError(err)
}

func (s *RingServiceTestSuite) streak() int {
	var doc struct {
		Streak int `bson:"streak"`
	}
	s.Require().NoError(s.users.FindOne(context.Background(), bson.M{"_id": s.GetUser(0).ID}).Decode(&doc))
	return doc.Streak
}

func (s *RingServiceTestSuite) TestPauseDay_TodayAndUndo() {
	ctx := context.Background()
	user := s.GetUser(0)

	state, err := s.service.PauseDay(ctx, user.ID, "UTC", 0, "  sick day  ")
	s.Require().NoError(err)
	s.True(state.Paused)
	s.Equal("sick day", state.PausedNote)
	s.NotNil(state.PausedAt)
	s.True(s.service.IsDayPaused(ctx, user.ID, TodayInTimezone("UTC")))

	state, err = s.service.UnpauseDay(ctx, user.ID, "UTC", 0)
	s.Require().NoError(err)
	s.False(state.Paused)
	s.Empty(state.PausedNote)
	s.False(s.service.IsDayPaused(ctx, user.ID, TodayInTimezone("UTC")))
}

func (s *RingServiceTestSuite) TestPauseDay_Retroactive() {
	ctx := context.Background()
	user := s.GetUser(0)

	state, err := s.service.PauseDay(ctx, user.ID, "UTC", 2, "")
	s.Require().NoError(err)
	s.True(state.Paused)
	s.Equal(DayInTimezone("UTC", 2), state.Date.UTC())

	_, err = s.service.PauseDay(ctx, user.ID, "UTC", 3, "")
	s.ErrorIs(err, ErrPauseOutOfRange)
	_, err = s.service.UnpauseDay(ctx, user.ID, "UTC", -1)
	s.ErrorIs(err, ErrPauseOutOfRange)
}

func (s *RingServiceTestSuite) TestPauseDay_NoteIsCapped() {
	long := make([]rune, MaxPauseNoteLength+20)
	for i := range long {
		long[i] = 'a'
	}
	state, err := s.service.PauseDay(context.Background(), s.GetUser(0).ID, "UTC", 0, string(long))
	s.Require().NoError(err)
	s.Len([]rune(state.PausedNote), MaxPauseNoteLength)
}

func (s *RingServiceTestSuite) TestCalculateScore_PausedDayIsNotAMiss() {
	ctx := context.Background()
	user := s.GetUser(0)
	s.setStreak(0)

	// Six fully closed days before today; today is untouched.
	for d := 1; d <= 6; d++ {
		_, err := s.ringStates.InsertOne(ctx, bson.M{
			"user_id":    user.ID,
			"date":       DayInTimezone("UTC", d),
			"plan":       RingProgress{Current: 2, Target: 2, Closed: true},
			"do":         RingProgress{Current: 3, Target: 3, Closed: true},
			"share":      RingProgress{Current: 1, Target: 1, Closed: true},
			"all_closed": true,
			"created_at": time.Now(),
		})
		s.Require().NoError(err)
	}
	before, err := s.service.CalculateScore(ctx, user.ID, "UTC")
	s.Require().NoError(err)

	_, err = s.service.PauseDay(ctx, user.ID, "UTC", 0, "")
	s.Require().NoError(err)
	after, err := s.service.CalculateScore(ctx, user.ID, "UTC")
	s.Require().NoError(err)

	s.Less(before, 100)
	s.Equal(ScoreBase+ScoreRingBonus+ScoreConsistencyMax, after)
}

func (s *RingServiceTestSuite) TestHoldRun_RestoresResetRunOnceAndUndoReverts() {
	ctx := context.Background()
	user := s.GetUser(0)
	s.setStreak(5)

	_, err := s.service.PauseDay(ctx, user.ID, "UTC", 0, "")
	s.Require().NoError(err)

	// Not reset yet: nothing to repair.
	s.service.HoldRun(ctx, user.ID, "UTC")
	s.Equal(5, s.streak())

	// The nightly reset zeroes the run; the paused day repairs it once.
	s.setStreak(0)
	s.service.HoldRun(ctx, user.ID, "UTC")
	s.Equal(5, s.streak())
	s.service.HoldRun(ctx, user.ID, "UTC")
	s.Equal(5, s.streak())

	_, err = s.service.UnpauseDay(ctx, user.ID, "UTC", 0)
	s.Require().NoError(err)
	s.Equal(0, s.streak())
}

func (s *RingServiceTestSuite) TestAllDaysPaused() {
	ctx := context.Background()
	user := s.GetUser(0)
	_, err := s.service.PauseDay(ctx, user.ID, "UTC", 1, "")
	s.Require().NoError(err)

	yesterdayNoon := DayInTimezone("UTC", 1).Add(12 * time.Hour)
	todayNoon := DayInTimezone("UTC", 0).Add(12 * time.Hour)
	s.True(s.service.AllDaysPaused(ctx, user.ID, "UTC", []time.Time{yesterdayNoon}))
	s.False(s.service.AllDaysPaused(ctx, user.ID, "UTC", []time.Time{yesterdayNoon, todayNoon}))
	s.False(s.service.AllDaysPaused(ctx, user.ID, "UTC", nil))
}

func (s *RingServiceTestSuite) TestForViewer_StripsPauseForFriends() {
	now := time.Now()
	st := &RingState{Paused: true, PausedNote: "private", PausedAt: &now, RunHeld: 4}
	friend := st.ForViewer(false)
	s.False(friend.Paused)
	s.Empty(friend.PausedNote)
	s.Nil(friend.PausedAt)
	s.True(st.ForViewer(true).Paused)
	s.True(st.Paused, "original must not be mutated")
}
