package rings

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ClaimResult is the internal result of a reward claim operation.
type ClaimResult struct {
	Claimed    bool
	CreditType string
	Amount     int
}

// RingService contains the core ring logic.
type RingService struct {
	ringStates    *mongo.Collection
	users         *mongo.Collection
	notifications *mongo.Collection
}

// NewRingService creates a new RingService.
func NewRingService(ringStates, users *mongo.Collection) *RingService {
	var notifs *mongo.Collection
	if users != nil {
		notifs = users.Database().Collection("notifications")
	}
	return &RingService{
		ringStates:    ringStates,
		users:         users,
		notifications: notifs,
	}
}

// todayInTimezone returns today's date (midnight UTC representation) based on
// the given IANA timezone string. If the timezone is invalid, UTC is used.
func todayInTimezone(timezone string) time.Time {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

// GetOrCreateToday returns today's ring state for the user, creating one with
// default targets if it does not already exist.
func (s *RingService) GetOrCreateToday(ctx context.Context, userID primitive.ObjectID, timezone string) (*RingState, error) {
	today := todayInTimezone(timezone)
	now := time.Now()

	filter := bson.M{
		"user_id": userID,
		"date":    today,
	}

	update := bson.M{
		"$setOnInsert": bson.M{
			"user_id": userID,
			"date":    today,
			"plan": RingProgress{
				Current: 0,
				Target:  DefaultPlanTarget,
				Closed:  false,
			},
			"do": RingProgress{
				Current: 0,
				Target:  DefaultDoTarget,
				Closed:  false,
			},
			"share": RingProgress{
				Current: 0,
				Target:  DefaultShareTarget,
				Closed:  false,
			},
			"all_closed":     false,
			"reward_claimed": false,
			"created_at":     now,
			"updated_at":     now,
		},
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var state RingState
	err := s.ringStates.FindOneAndUpdate(ctx, filter, update, opts).Decode(&state)
	if err != nil {
		return nil, fmt.Errorf("get or create ring state: %w", err)
	}
	return &state, nil
}

// IncrementRing increments the specified ring's current count by 1, updates
// closure flags, and recalculates the productivity score. It returns the
// updated state and a RingDelta describing the increment so callers can drive
// frontend feedback (haptics, animation, toast).
func (s *RingService) IncrementRing(ctx context.Context, userID primitive.ObjectID, timezone string, ringType RingType) (*RingState, *RingDelta, error) {
	// Ensure today's state exists first.
	_, err := s.GetOrCreateToday(ctx, userID, timezone)
	if err != nil {
		return nil, nil, err
	}

	today := todayInTimezone(timezone)
	now := time.Now()

	ringField := string(ringType) + ".current"

	// Atomically increment the ring's current value.
	filter := bson.M{
		"user_id": userID,
		"date":    today,
	}

	incUpdate := bson.M{
		"$inc": bson.M{ringField: 1},
		"$set": bson.M{"updated_at": now},
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var state RingState
	err = s.ringStates.FindOneAndUpdate(ctx, filter, incUpdate, opts).Decode(&state)
	if err != nil {
		return nil, nil, fmt.Errorf("increment ring: %w", err)
	}

	// Per-ring delta: previous = current - 1 since $inc added exactly 1.
	var ringProgress RingProgress
	switch ringType {
	case RingPlan:
		ringProgress = state.Plan
	case RingDo:
		ringProgress = state.Do
	case RingShare:
		ringProgress = state.Share
	}
	previous := ringProgress.Current - 1
	justClosedThisRing := previous < ringProgress.Target && ringProgress.Current >= ringProgress.Target

	// Recalculate closure flags.
	planClosed := state.Plan.Current >= state.Plan.Target
	doClosed := state.Do.Current >= state.Do.Target
	shareClosed := state.Share.Current >= state.Share.Target
	allClosed := planClosed && doClosed && shareClosed
	wasPreviouslyAllClosed := state.AllClosed
	justClosedAll := allClosed && !wasPreviouslyAllClosed

	// Update closure flags on the document.
	closureUpdate := bson.M{
		"$set": bson.M{
			"plan.closed":  planClosed,
			"do.closed":    doClosed,
			"share.closed": shareClosed,
			"all_closed":   allClosed,
			"updated_at":   now,
		},
	}

	err = s.ringStates.FindOneAndUpdate(ctx, filter, closureUpdate, opts).Decode(&state)
	if err != nil {
		return nil, nil, fmt.Errorf("update closure flags: %w", err)
	}

	// First-ever all-closed: set the milestone timestamp on the user document.
	// Guarded by $exists:false so it's only set once and is idempotent.
	if justClosedAll && s.users != nil {
		_, _ = s.users.UpdateOne(ctx,
			bson.M{"_id": userID, "first_all_rings_closed_at": bson.M{"$exists": false}},
			bson.M{"$set": bson.M{"first_all_rings_closed_at": now}},
		)
	}

	// Recalculate and cache the productivity score on the user document.
	if err := s.recalculateScore(ctx, userID, timezone); err != nil {
		return nil, nil, err
	}

	delta := &RingDelta{
		Ring:          ringType,
		Previous:      previous,
		Current:       ringProgress.Current,
		Target:        ringProgress.Target,
		JustClosed:    justClosedThisRing,
		AllClosed:     allClosed,
		JustClosedAll: justClosedAll,
	}

	return &state, delta, nil
}

// CalculateScore computes the productivity score for a user based on recent
// ring closures and streak.
func (s *RingService) CalculateScore(ctx context.Context, userID primitive.ObjectID, timezone string) (int, error) {
	today := todayInTimezone(timezone)
	windowStart := today.AddDate(0, 0, -ScoreRingWindow+1)

	// Query ring states for the last 7 days.
	filter := bson.M{
		"user_id": userID,
		"date": bson.M{
			"$gte": windowStart,
			"$lte": today,
		},
	}

	cursor, err := s.ringStates.Find(ctx, filter)
	if err != nil {
		return 0, fmt.Errorf("query ring states for score: %w", err)
	}
	defer cursor.Close(ctx)

	var states []RingState
	if err := cursor.All(ctx, &states); err != nil {
		return 0, fmt.Errorf("decode ring states: %w", err)
	}

	// Count total closed rings and active days across the window.
	closedRings := 0
	activeDays := 0
	for _, st := range states {
		dayActive := false
		if st.Plan.Closed {
			closedRings++
			dayActive = true
		}
		if st.Do.Closed {
			closedRings++
			dayActive = true
		}
		if st.Share.Closed {
			closedRings++
			dayActive = true
		}
		if dayActive {
			activeDays++
		}
	}

	// Fetch user streak.
	var user types.User
	err = s.users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return 0, fmt.Errorf("fetch user for score: %w", err)
	}

	// Formula: base(30) + ring_bonus(up to 55) + streak(up to 7) + consistency(up to 8) = 100 max
	ringBonus := float64(closedRings) / float64(ScoreMaxRings) * float64(ScoreRingBonus)
	streakBonus := math.Min(float64(user.Streak), float64(ScoreMaxStreak))
	consistencyBonus := float64(activeDays) / float64(ScoreConsistencyDays) * float64(ScoreConsistencyMax)
	score := float64(ScoreBase) + ringBonus + streakBonus + consistencyBonus
	if score > 100 {
		score = 100
	}

	return int(score), nil
}

// GetHistory returns the user's ring states for the last N days (capped at 30),
// sorted by date descending.
func (s *RingService) GetHistory(ctx context.Context, userID primitive.ObjectID, timezone string, days int) ([]RingState, error) {
	if days > 30 {
		days = 30
	}
	if days <= 0 {
		days = 7
	}

	today := todayInTimezone(timezone)
	startDate := today.AddDate(0, 0, -days+1)

	filter := bson.M{
		"user_id": userID,
		"date": bson.M{
			"$gte": startDate,
			"$lte": today,
		},
	}

	opts := options.Find().SetSort(bson.M{"date": -1})
	cursor, err := s.ringStates.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("query ring history: %w", err)
	}
	defer cursor.Close(ctx)

	var states []RingState
	if err := cursor.All(ctx, &states); err != nil {
		return nil, fmt.Errorf("decode ring history: %w", err)
	}

	return states, nil
}

// ClaimReward claims the daily ring reward if all rings are closed and the
// reward has not already been claimed. Returns the claim result.
func (s *RingService) ClaimReward(ctx context.Context, userID primitive.ObjectID, timezone string) (*ClaimResult, error) {
	state, err := s.GetOrCreateToday(ctx, userID, timezone)
	if err != nil {
		return nil, err
	}

	if !state.AllClosed {
		return &ClaimResult{Claimed: false}, nil
	}
	if state.RewardClaimed {
		return &ClaimResult{Claimed: false}, nil
	}

	reward := pickRandomReward()

	// Add credits to user document.
	creditType := types.CreditType(reward.CreditType)
	fieldName, err := types.GetCreditFieldName(creditType)
	if err != nil {
		return nil, fmt.Errorf("invalid reward credit type %q: %w", reward.CreditType, err)
	}

	now := time.Now()
	_, err = s.users.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$inc": bson.M{fieldName: reward.Amount},
		"$set": bson.M{"last_reward_date": now},
	})
	if err != nil {
		return nil, fmt.Errorf("add reward credits: %w", err)
	}

	// Mark reward on ring state.
	today := todayInTimezone(timezone)
	_, err = s.ringStates.UpdateOne(ctx, bson.M{
		"user_id": userID,
		"date":    today,
	}, bson.M{
		"$set": bson.M{
			"reward_claimed": true,
			"reward_type":    reward.CreditType,
			"reward_amount":  reward.Amount,
			"updated_at":     now,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("mark reward claimed: %w", err)
	}

	return &ClaimResult{
		Claimed:    true,
		CreditType: reward.CreditType,
		Amount:     reward.Amount,
	}, nil
}

// pickRandomReward performs weighted random selection from the RewardPool.
func pickRandomReward() RewardDrop {
	totalWeight := 0
	for _, r := range RewardPool {
		totalWeight += r.Weight
	}

	roll := rand.Intn(totalWeight) //nolint:gosec // reward rolling doesn't need crypto/rand
	cumulative := 0
	for _, r := range RewardPool {
		cumulative += r.Weight
		if roll < cumulative {
			return r
		}
	}

	// Fallback (should never reach here).
	return RewardPool[0]
}

// EnsureIndexes creates the required indexes on the ring_states collection.
func (s *RingService) EnsureIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "date", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{
				{Key: "created_at", Value: 1},
			},
			Options: options.Index().SetExpireAfterSeconds(30 * 24 * 60 * 60), // 30 days
		},
	}

	_, err := s.ringStates.Indexes().CreateMany(ctx, indexes)
	if err != nil {
		return fmt.Errorf("create ring state indexes: %w", err)
	}

	return nil
}

// recalculateScore calculates the productivity score and caches it on the user
// document.
func (s *RingService) recalculateScore(ctx context.Context, userID primitive.ObjectID, timezone string) error {
	score, err := s.CalculateScore(ctx, userID, timezone)
	if err != nil {
		return fmt.Errorf("recalculate score: %w", err)
	}

	_, err = s.users.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$set": bson.M{"productivity_score": score},
	})
	if err != nil {
		return fmt.Errorf("cache productivity score: %w", err)
	}

	return nil
}

// NotifyAllRingsClosed sends delayed notifications (2 minutes) to the user and
// their friends when all rings are closed for the day.
func (s *RingService) NotifyAllRingsClosed(userID primitive.ObjectID) {
	time.AfterFunc(2*time.Minute, func() {
		ctx := context.Background()

		var user types.User
		if err := s.users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
			slog.Error("rings closed notify: failed to fetch user", "error", err, "user_id", userID)
			return
		}

		// Notify the user
		if user.PushToken != "" {
			_ = xutils.SendNotification(xutils.Notification{
				Token:   user.PushToken,
				Title:   "All rings closed!",
				Message: "You closed all your rings today. Nice work.",
				Data:    map[string]string{"type": "rings_closed"},
			})
		}

		s.createRingNotification(ctx, userID, userID, user, "You closed all your rings today!")

		// Notify friends
		if len(user.Friends) == 0 {
			return
		}

		cursor, err := s.users.Find(ctx, bson.M{"_id": bson.M{"$in": user.Friends}})
		if err != nil {
			slog.Error("rings closed notify: failed to fetch friends", "error", err, "user_id", userID)
			return
		}
		defer cursor.Close(ctx)

		message := fmt.Sprintf("%s closed all their rings today!", user.DisplayName)

		var friends []types.User
		if err := cursor.All(ctx, &friends); err != nil {
			slog.Error("rings closed notify: failed to decode friends", "error", err)
			return
		}

		for _, friend := range friends {
			s.createRingNotification(ctx, userID, friend.ID, user, message)

			if friend.PushToken != "" {
				_ = xutils.SendNotification(xutils.Notification{
					Token:   friend.PushToken,
					Title:   "Rings closed",
					Message: message,
					Data: map[string]string{
						"type":    "rings_closed",
						"user_id": userID.Hex(),
					},
				})
			}
		}

		slog.Info("rings closed notifications sent", "user_id", userID, "friends_notified", len(friends))
	})
}

func (s *RingService) createRingNotification(ctx context.Context, senderID, receiverID primitive.ObjectID, sender types.User, content string) {
	if s.notifications == nil {
		return
	}

	type userRef struct {
		ID             primitive.ObjectID `bson:"_id"`
		DisplayName    string             `bson:"display_name"`
		Handle         string             `bson:"handle"`
		ProfilePicture string             `bson:"profile_picture"`
	}

	doc := bson.M{
		"_id":              primitive.NewObjectID(),
		"receiver":         receiverID,
		"content":          content,
		"user":             userRef{ID: senderID, DisplayName: sender.DisplayName, Handle: sender.Handle, ProfilePicture: sender.ProfilePicture},
		"time":             time.Now(),
		"notificationType": "RINGS_CLOSED",
		"reference_id":     senderID,
		"read":             false,
	}

	if _, err := s.notifications.InsertOne(ctx, doc); err != nil {
		slog.Error("rings closed notify: failed to create notification", "error", err, "receiver_id", receiverID)
	}
}
