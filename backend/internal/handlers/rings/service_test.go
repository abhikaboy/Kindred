package rings_test

import (
	"context"
	"testing"

	. "github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// RingServiceTestSuite tests the ring service
type RingServiceTestSuite struct {
	testpkg.BaseSuite
	service    *RingService
	ringStates *mongo.Collection
	users      *mongo.Collection
}

// SetupTest runs before each test
func (s *RingServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()

	// Create ring_states collection from the test database
	s.ringStates = s.TestDB.DB.Collection("ring_states")
	s.users = s.Collections["users"]

	// Create service
	s.service = NewRingService(s.ringStates, s.users)
}

// TestRingService runs the test suite
func TestRingService(t *testing.T) {
	testpkg.RunSuite(t, new(RingServiceTestSuite))
}

// ========================================
// GetOrCreateToday Tests
// ========================================

func (s *RingServiceTestSuite) TestGetOrCreateToday_CreatesNewState() {
	user := s.GetUser(0)
	ctx := context.Background()

	// First call should create a new state with default targets
	state, err := s.service.GetOrCreateToday(ctx, user.ID, "UTC")

	s.NoError(err)
	s.NotNil(state)
	s.Equal(user.ID, state.UserID)
	s.Equal(0, state.Plan.Current)
	s.Equal(DefaultPlanTarget, state.Plan.Target)
	s.False(state.Plan.Closed)
	s.Equal(0, state.Do.Current)
	s.Equal(DefaultDoTarget, state.Do.Target)
	s.False(state.Do.Closed)
	s.Equal(0, state.Share.Current)
	s.Equal(DefaultShareTarget, state.Share.Target)
	s.False(state.Share.Closed)
	s.False(state.AllClosed)
	s.False(state.RewardClaimed)
}

func (s *RingServiceTestSuite) TestGetOrCreateToday_ReturnsSameDocument() {
	user := s.GetUser(0)
	ctx := context.Background()

	// First call creates
	state1, err := s.service.GetOrCreateToday(ctx, user.ID, "UTC")
	s.NoError(err)

	// Second call should return the same document
	state2, err := s.service.GetOrCreateToday(ctx, user.ID, "UTC")
	s.NoError(err)

	s.Equal(state1.ID, state2.ID)
	s.Equal(state1.Date, state2.Date)
}

// ========================================
// IncrementRing Tests
// ========================================

func (s *RingServiceTestSuite) TestIncrementRing_DoRingOnce() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Increment Do ring once
	state, delta, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingDo)

	s.NoError(err)
	s.NotNil(state)
	s.Equal(1, state.Do.Current)
	s.False(state.Do.Closed) // Target is 3, so not closed yet
	s.NotNil(delta)
	s.Equal(RingDo, delta.Ring)
	s.Equal(0, delta.Previous)
	s.Equal(1, delta.Current)
	s.Equal(DefaultDoTarget, delta.Target)
	s.False(delta.JustClosed)
	s.False(delta.AllClosed)
	s.False(delta.JustClosedAll)
}

func (s *RingServiceTestSuite) TestIncrementRing_DeltaReportsJustClosedForSingleRing() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Share has target=1, so first increment closes it but does not close all rings.
	_, delta, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)

	s.NoError(err)
	s.NotNil(delta)
	s.Equal(RingShare, delta.Ring)
	s.Equal(0, delta.Previous)
	s.Equal(1, delta.Current)
	s.Equal(DefaultShareTarget, delta.Target)
	s.True(delta.JustClosed, "share ring should be flagged just_closed on first increment")
	s.False(delta.AllClosed)
	s.False(delta.JustClosedAll)
}

func (s *RingServiceTestSuite) TestIncrementRing_DeltaJustClosedOnlyOnCrossingIncrement() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Share target = 1. First increment closes; second must NOT report just_closed again.
	_, firstDelta, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)
	s.NoError(err)
	s.True(firstDelta.JustClosed)

	_, secondDelta, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)
	s.NoError(err)
	s.False(secondDelta.JustClosed, "subsequent increments past target must not re-report just_closed")
	s.Equal(1, secondDelta.Previous)
	s.Equal(2, secondDelta.Current)
}

// ========================================
// AllRingsClose Tests
// ========================================

func (s *RingServiceTestSuite) TestAllRingsClose() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Close Plan ring (target = 2)
	var state *RingState
	var delta *RingDelta
	var err error

	for i := 0; i < DefaultPlanTarget; i++ {
		state, delta, err = s.service.IncrementRing(ctx, user.ID, "UTC", RingPlan)
		s.NoError(err)
	}
	s.True(state.Plan.Closed)
	s.False(delta.JustClosedAll)

	// Close Do ring (target = 3)
	for i := 0; i < DefaultDoTarget; i++ {
		state, delta, err = s.service.IncrementRing(ctx, user.ID, "UTC", RingDo)
		s.NoError(err)
	}
	s.True(state.Do.Closed)
	s.False(delta.JustClosedAll)

	// Close Share ring (target = 1) — this should trigger JustClosedAll
	state, delta, err = s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)
	s.NoError(err)
	s.True(state.Share.Closed)
	s.True(state.AllClosed)
	s.True(delta.JustClosedAll)
	s.True(delta.AllClosed)
}

// ========================================
// ClaimReward Tests
// ========================================

func (s *RingServiceTestSuite) TestClaimReward_CannotClaimWithoutClosingAllRings() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Create today's state (no rings closed)
	_, err := s.service.GetOrCreateToday(ctx, user.ID, "UTC")
	s.NoError(err)

	// Try to claim reward
	result, err := s.service.ClaimReward(ctx, user.ID, "UTC")
	s.NoError(err)
	s.NotNil(result)
	s.False(result.Claimed)
}

func (s *RingServiceTestSuite) TestClaimReward_SuccessAfterClosingAllRings() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Close all rings
	for i := 0; i < DefaultPlanTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingPlan)
		s.NoError(err)
	}
	for i := 0; i < DefaultDoTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingDo)
		s.NoError(err)
	}
	for i := 0; i < DefaultShareTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)
		s.NoError(err)
	}

	// Claim reward
	result, err := s.service.ClaimReward(ctx, user.ID, "UTC")
	s.NoError(err)
	s.NotNil(result)
	s.True(result.Claimed)
	s.NotEmpty(result.CreditType)
	s.Greater(result.Amount, 0)

	// Verify credits were added to user
	var updatedUser types.User
	err = s.users.FindOne(ctx, bson.M{"_id": user.ID}).Decode(&updatedUser)
	s.NoError(err)

	// At least one credit type should have been incremented
	totalCredits := updatedUser.Credits.Voice + updatedUser.Credits.Analytics + updatedUser.Credits.NaturalLanguage
	s.Greater(totalCredits, 0)
}

func (s *RingServiceTestSuite) TestClaimReward_CannotClaimTwice() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Close all rings
	for i := 0; i < DefaultPlanTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingPlan)
		s.NoError(err)
	}
	for i := 0; i < DefaultDoTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingDo)
		s.NoError(err)
	}
	for i := 0; i < DefaultShareTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)
		s.NoError(err)
	}

	// First claim succeeds
	result1, err := s.service.ClaimReward(ctx, user.ID, "UTC")
	s.NoError(err)
	s.True(result1.Claimed)

	// Second claim fails
	result2, err := s.service.ClaimReward(ctx, user.ID, "UTC")
	s.NoError(err)
	s.False(result2.Claimed)
}

// ========================================
// CalculateScore Tests
// ========================================

func (s *RingServiceTestSuite) TestCalculateScore_BaseScoreWithNoRings() {
	user := s.GetUser(0)
	ctx := context.Background()

	score, err := s.service.CalculateScore(ctx, user.ID, "UTC")

	s.NoError(err)
	s.GreaterOrEqual(score, ScoreBase)
}

func (s *RingServiceTestSuite) TestCalculateScore_IncreasesWithClosedRings() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Get base score
	baseScore, err := s.service.CalculateScore(ctx, user.ID, "UTC")
	s.NoError(err)

	// Close some rings
	for i := 0; i < DefaultPlanTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingPlan)
		s.NoError(err)
	}
	for i := 0; i < DefaultDoTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingDo)
		s.NoError(err)
	}

	// Score should be higher now
	newScore, err := s.service.CalculateScore(ctx, user.ID, "UTC")
	s.NoError(err)
	s.Greater(newScore, baseScore)
}

// ========================================
// PickRandomReward Tests
// ========================================

func (s *RingServiceTestSuite) TestPickRandomReward_DistinctTypes() {
	user := s.GetUser(0)
	ctx := context.Background()

	// We need to close all rings and claim rewards multiple times.
	// Since we can only claim once per day, we test the distribution
	// by repeatedly closing rings and claiming.
	// However, pickRandomReward is not exported directly.
	// Instead, we run multiple claims across different "users" or
	// verify through ClaimReward results.

	// Use a map to track distinct reward types
	rewardTypes := make(map[string]bool)

	// Run 10000 iterations by claiming rewards for the same user
	// We need to create a fresh ring state for each iteration.
	for i := 0; i < 10000; i++ {
		// Clean ring_states for this user so we can claim again
		_, err := s.ringStates.DeleteMany(ctx, bson.M{"user_id": user.ID})
		s.NoError(err)

		// Close all rings
		for j := 0; j < DefaultPlanTarget; j++ {
			_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingPlan)
			s.NoError(err)
		}
		for j := 0; j < DefaultDoTarget; j++ {
			_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingDo)
			s.NoError(err)
		}
		for j := 0; j < DefaultShareTarget; j++ {
			_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)
			s.NoError(err)
		}

		// Claim reward
		result, err := s.service.ClaimReward(ctx, user.ID, "UTC")
		s.NoError(err)
		s.True(result.Claimed)

		rewardTypes[result.CreditType] = true

		// Early exit if we already found enough distinct types
		if len(rewardTypes) >= 3 {
			break
		}
	}

	s.GreaterOrEqual(len(rewardTypes), 3, "Expected at least 3 distinct reward types, got: %v", rewardTypes)
}
