package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"time"

	"github.com/abhikaboy/Kindred/internal/gemini"
	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/getsentry/sentry-go"
	"github.com/robfig/cron/v3"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// KudosSuggesterJob prompts one user to encourage or congratulate another, at a
// moment when it will actually matter.
//
// The division of labour with the productivity-agent worker is the reason this
// is a cron job rather than something the worker could do:
//
//   - The WORKER owns policy — slow-moving traits. Whose voice carries weight
//     (`kudos-affinity`), whether encouragement lands at all
//     (`encouragement-effect`), whether the sender tolerates prompts
//     (`nudge-receptivity`), what hours are safe (`peak-hours`).
//   - Kindred owns MOMENTS — fast-moving state. This streak breaks tonight, this
//     task has been stalled three days, these rings just closed. A nightly batch
//     cannot see any of it.
//
// This job joins them: a moment fires, `user_memory` says who to ask and when,
// the existing FCM path delivers.
type KudosSuggesterJob struct {
	users          *mongo.Collection
	categories     *mongo.Collection // live tasks are embedded here
	completedTasks *mongo.Collection
	templateTasks  *mongo.Collection
	ringStates     *mongo.Collection
	userMemory     *mongo.Collection
	dispatches     *mongo.Collection
	notifier       *notifications.Service
	policy         KudosPolicy
}

// KudosDispatchCollection is the ledger that makes this job idempotent. One row
// per prompt actually sent, claimed before the push rather than written after
// it — see claimDispatch.
const KudosDispatchCollection = "kudos_prompt_dispatches"

// streakMilestones are the streak lengths worth telling someone's friends
// about. Deliberately sparse: every-day-is-a-milestone is how a nice feature
// becomes noise.
var streakMilestones = []int{7, 14, 30, 50, 100, 200, 365}

// notableTaskValue is the difficulty at which finishing something counts as an
// achievement worth a friend's attention. Priority 3 (highest) qualifies too.
const notableTaskValue = 7.0

// maxSenderCandidates bounds how far down the affinity ranking we look before
// giving up on a moment. The policy caps how many prompts one moment may
// produce; this caps how much work it may cost to find them.
const maxSenderCandidates = 8

// NewKudosSuggesterJob wires the job from the collections map.
//
// It takes the map rather than a fixed argument list because it reads seven
// collections, two of which (`user_memory`, and the ledger below) are created
// on first write and so may be absent from a map built by listing what Atlas
// already has. Missing handles are derived from the database the same way
// settings.newService does for `user_memory`.
func NewKudosSuggesterJob(collections map[string]*mongo.Collection, policy KudosPolicy) *KudosSuggesterJob {
	return &KudosSuggesterJob{
		users:          collections["users"],
		categories:     collections["categories"],
		completedTasks: collections["completed-tasks"],
		templateTasks:  collections["template-tasks"],
		ringStates:     collectionOrDerive(collections, "ring_states"),
		userMemory:     collectionOrDerive(collections, gemini.UserMemoryCollection),
		dispatches:     collectionOrDerive(collections, KudosDispatchCollection),
		notifier:       notifications.NewNotificationService(collections),
		policy:         policy,
	}
}

// collectionOrDerive falls back to a handle on the same database when a
// collection has not been created yet.
func collectionOrDerive(collections map[string]*mongo.Collection, name string) *mongo.Collection {
	if c := collections[name]; c != nil {
		return c
	}
	if users := collections["users"]; users != nil {
		return users.Database().Collection(name)
	}
	return nil
}

// Ready reports whether the job has everything it needs. Server-side guard, in
// keeping with the other jobs here.
func (j *KudosSuggesterJob) Ready() bool {
	return j.users != nil && j.userMemory != nil && j.dispatches != nil
}

// StartCron registers the suggester. Runs every 15 minutes.
//
// The cadence follows from the two timing rules rather than from taste.
// Congratulation has to read as "right after", and an hourly tick can put 59
// minutes between a ring closing and the prompt about it. Encouragement is
// aimed at a window derived from `peak-hours`, which is hour-granular, so
// anything finer than a quarter hour buys nothing. Fifteen minutes is the
// coarsest tick that still lands inside both, at 96 passes a day.
//
// Unlike the calendar jobs there is no run on startup. Those reconcile state;
// this one sends push notifications to people, and a deploy loop should not be
// able to turn into a delivery loop. The ledger would stop the duplicates
// anyway — this is the second lock on the same door.
func (j *KudosSuggesterJob) StartCron(c *cron.Cron) {
	_, err := c.AddFunc("@every 15m", func() {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				slog.Error("Panic recovered in kudos suggester", "panic", r, "stack", stack)
				sentry.CurrentHub().Recover(r)
				sentry.Flush(2 * time.Second)
			}
		}()

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := j.Run(ctx); err != nil {
			slog.Error("Kudos suggester job failed", "error", err)
			sentry.CaptureException(fmt.Errorf("kudos suggester job failed: %w", err))
		}
	})
	if err != nil {
		slog.Error("Error adding kudos suggester cron job", "error", err)
	} else {
		slog.Info("Kudos suggester cron registered (every 15m)")
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := j.EnsureIndexes(ctx); err != nil {
			slog.Error("Failed to ensure kudos dispatch indexes", "error", err)
			sentry.CaptureException(fmt.Errorf("kudos suggester indexes: %w", err))
		}
	}()
}

// EnsureIndexes creates the ledger's indexes.
//
// The unique index on dedupeKey is not an optimisation — it is the thing that
// makes a repeated run safe. Without it two concurrent ticks both read "not
// sent yet" and both send.
func (j *KudosSuggesterJob) EnsureIndexes(ctx context.Context) error {
	if j.dispatches == nil {
		return nil
	}
	_, err := j.dispatches.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "dedupeKey", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("kudos_dispatch_dedupe"),
		},
		{
			// Backs the daily cap count.
			Keys: bson.D{{Key: "senderId", Value: 1}, {Key: "localDay", Value: 1}},
		},
		{
			// Backs the per-(sender, recipient, trigger) cooldown lookup.
			Keys: bson.D{
				{Key: "senderId", Value: 1},
				{Key: "recipientId", Value: 1},
				{Key: "trigger", Value: 1},
				{Key: "sentAt", Value: -1},
			},
		},
		{
			// Retention. Comfortably longer than the cooldown, so the TTL can
			// never expire a row the cooldown still needs.
			Keys:    bson.D{{Key: "expiresAt", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(0),
		},
	})
	if err != nil {
		return fmt.Errorf("create kudos dispatch indexes: %w", err)
	}
	return nil
}

// dispatchRecord is one prompt that was sent.
type dispatchRecord struct {
	ID          primitive.ObjectID `bson:"_id"`
	DedupeKey   string             `bson:"dedupeKey"`
	SenderID    primitive.ObjectID `bson:"senderId"`
	RecipientID primitive.ObjectID `bson:"recipientId"`
	Trigger     TriggerType        `bson:"trigger"`
	Subject     string             `bson:"subject"`
	SentAt      time.Time          `bson:"sentAt"`
	// LocalDay is the sender's own calendar day. The cap is "two a day" in the
	// day they are living in, not in UTC.
	LocalDay  string    `bson:"localDay"`
	ExpiresAt time.Time `bson:"expiresAt"`
}

// runStats is a per-tick tally, logged at the end. Skips are counted by reason
// because a suggester that goes quiet is otherwise impossible to debug — and
// because the count of no_struggle_consent is a number worth watching.
type runStats struct {
	moments    int
	dispatched int
	skips      map[SkipReason]int
}

func newRunStats() *runStats { return &runStats{skips: map[SkipReason]int{}} }

func (s *runStats) skip(r SkipReason) { s.skips[r]++ }

// runCache memoises per-sender ledger reads within a single tick. One sender
// can be a candidate for several moments in the same pass, and the daily count
// does not change underneath us except by our own writes — which we account for
// directly.
type runCache struct {
	promptsToday map[primitive.ObjectID]int
	users        map[primitive.ObjectID]*types.User
	facts        map[primitive.ObjectID][]gemini.UserFact
}

func newRunCache() *runCache {
	return &runCache{
		promptsToday: map[primitive.ObjectID]int{},
		users:        map[primitive.ObjectID]*types.User{},
		facts:        map[primitive.ObjectID][]gemini.UserFact{},
	}
}

// Run detects moments and dispatches prompts for them.
func (j *KudosSuggesterJob) Run(ctx context.Context) error {
	if !j.Ready() {
		return fmt.Errorf("kudos suggester: required collections unavailable")
	}

	start := time.Now()
	now := time.Now().UTC()

	moments, err := j.detectMoments(ctx, now)
	if err != nil {
		return err
	}

	stats := newRunStats()
	stats.moments = len(moments)
	cache := newRunCache()

	for _, m := range moments {
		if err := ctx.Err(); err != nil {
			return err
		}
		j.processMoment(ctx, m, now, stats, cache)
	}

	slog.Info("Kudos suggester tick complete",
		"moments", stats.moments,
		"dispatched", stats.dispatched,
		"skipped_no_struggle_consent", stats.skips[SkipNoStruggleConsent],
		"skipped_cooldown", stats.skips[SkipCooldown],
		"skipped_daily_cap", stats.skips[SkipDailyCap],
		"skipped_quiet_hours", stats.skips[SkipQuietHours],
		"skipped_timing", stats.skips[SkipWrongTimeOfDay]+stats.skips[SkipStale],
		"skipped_affinity", stats.skips[SkipLowAffinity],
		"duration_ms", time.Since(start).Milliseconds())

	return nil
}

// ============================================================================
// Moment detection — the fast state a nightly batch cannot see
// ============================================================================

func (j *KudosSuggesterJob) detectMoments(ctx context.Context, now time.Time) ([]KudosMoment, error) {
	var moments []KudosMoment

	// Each detector's failure is logged and swallowed rather than returned. One
	// broken query must not stop the other four from finding anything.
	for _, d := range []struct {
		name string
		fn   func(context.Context, time.Time) ([]KudosMoment, error)
	}{
		{"rings_closed", j.detectRingsClosed},
		{"streak_milestone", j.detectStreakMilestones},
		{"notable_completion", j.detectNotableCompletions},
		{"task_stalled", j.detectStalledTasks},
		{"streak_at_risk", j.detectStreaksAtRisk},
	} {
		found, err := d.fn(ctx, now)
		if err != nil {
			slog.Error("Kudos suggester: detector failed", "detector", d.name, "error", err)
			sentry.CaptureException(fmt.Errorf("kudos suggester detector %s: %w", d.name, err))
			continue
		}
		moments = append(moments, found...)
	}

	return moments, nil
}

// detectRingsClosed finds users who closed every ring recently. The freshness
// cutoff is the same one the policy uses to decide a congratulation is still a
// congratulation, so the query never produces rows the evaluator will reject as
// stale.
func (j *KudosSuggesterJob) detectRingsClosed(ctx context.Context, now time.Time) ([]KudosMoment, error) {
	if j.ringStates == nil {
		return nil, nil
	}
	cutoff := now.Add(-j.policy.CongratulationFreshness)

	cur, err := j.ringStates.Find(ctx,
		bson.M{"all_closed": true, "updated_at": bson.M{"$gte": cutoff}},
		options.Find().SetLimit(j.policy.MaxMomentsPerTrigger),
	)
	if err != nil {
		return nil, fmt.Errorf("find closed rings: %w", err)
	}
	defer cur.Close(ctx)

	var rows []struct {
		UserID    primitive.ObjectID `bson:"user_id"`
		Date      time.Time          `bson:"date"`
		UpdatedAt time.Time          `bson:"updated_at"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("decode closed rings: %w", err)
	}

	moments := make([]KudosMoment, 0, len(rows))
	for _, r := range rows {
		moments = append(moments, KudosMoment{
			RecipientID: r.UserID,
			Trigger:     TriggerRingsClosed,
			Subject:     r.Date.UTC().Format("2006-01-02"),
			Detail:      "closed every ring",
			OccurredAt:  r.UpdatedAt,
		})
	}
	return moments, nil
}

// detectStreakMilestones finds recurring tasks that just reached a round
// number. The `completionDates` filter is what makes "just": a streak sitting at
// 7 with no recent completion is a stalled habit, not a milestone.
func (j *KudosSuggesterJob) detectStreakMilestones(ctx context.Context, now time.Time) ([]KudosMoment, error) {
	if j.templateTasks == nil {
		return nil, nil
	}
	cutoff := now.Add(-j.policy.CongratulationFreshness)

	cur, err := j.templateTasks.Find(ctx, bson.M{
		"streak":          bson.M{"$in": streakMilestones},
		"completionDates": bson.M{"$elemMatch": bson.M{"$gte": cutoff}},
	}, options.Find().SetLimit(j.policy.MaxMomentsPerTrigger))
	if err != nil {
		return nil, fmt.Errorf("find streak milestones: %w", err)
	}
	defer cur.Close(ctx)

	var rows []struct {
		ID              primitive.ObjectID `bson:"_id"`
		UserID          primitive.ObjectID `bson:"userID"`
		Streak          int                `bson:"streak"`
		CompletionDates []time.Time        `bson:"completionDates"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("decode streak milestones: %w", err)
	}

	moments := make([]KudosMoment, 0, len(rows))
	for _, r := range rows {
		occurred := latestBefore(r.CompletionDates, now)
		if occurred.IsZero() {
			occurred = now
		}
		moments = append(moments, KudosMoment{
			RecipientID: r.UserID,
			Trigger:     TriggerStreakMilestone,
			// The streak length is part of the subject so each milestone is its
			// own moment: 7 and 30 are two things worth saying, not one.
			Subject:    fmt.Sprintf("%s:%d", r.ID.Hex(), r.Streak),
			Detail:     fmt.Sprintf("hit a %d-day streak", r.Streak),
			OccurredAt: occurred,
		})
	}
	return moments, nil
}

// detectNotableCompletions finds finished work substantial enough to be worth a
// friend's attention — highest priority, or high difficulty.
func (j *KudosSuggesterJob) detectNotableCompletions(ctx context.Context, now time.Time) ([]KudosMoment, error) {
	if j.completedTasks == nil {
		return nil, nil
	}
	cutoff := now.Add(-j.policy.CongratulationFreshness)

	cur, err := j.completedTasks.Find(ctx, bson.M{
		"timeCompleted": bson.M{"$gte": cutoff},
		"$or": []bson.M{
			{"priority": 3},
			{"value": bson.M{"$gte": notableTaskValue}},
		},
	}, options.Find().SetLimit(j.policy.MaxMomentsPerTrigger))
	if err != nil {
		return nil, fmt.Errorf("find notable completions: %w", err)
	}
	defer cur.Close(ctx)

	var rows []struct {
		ID            primitive.ObjectID `bson:"_id"`
		User          primitive.ObjectID `bson:"user"`
		TimeCompleted *time.Time         `bson:"timeCompleted"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("decode notable completions: %w", err)
	}

	moments := make([]KudosMoment, 0, len(rows))
	for _, r := range rows {
		occurred := now
		if r.TimeCompleted != nil {
			occurred = *r.TimeCompleted
		}
		moments = append(moments, KudosMoment{
			RecipientID: r.User,
			Trigger:     TriggerNotableCompletion,
			Subject:     r.ID.Hex(),
			Detail:      "finished something big",
			OccurredAt:  occurred,
		})
	}
	return moments, nil
}

// detectStalledTasks finds work that has sat untouched. STRUGGLE TRIGGER — every
// moment it produces is dropped unless the person it is about has explicitly
// opted in.
//
// A task is stalled when it was due to start at least StalledAfter ago and has
// not been edited since. Live tasks are embedded in `categories.tasks`, and
// completing one removes it from that array, so anything still here is open by
// definition.
func (j *KudosSuggesterJob) detectStalledTasks(ctx context.Context, now time.Time) ([]KudosMoment, error) {
	if j.categories == nil {
		return nil, nil
	}
	cutoff := now.Add(-j.policy.StalledAfter)

	cur, err := j.categories.Aggregate(ctx, []bson.M{
		{"$match": bson.M{
			"tasks":       bson.M{"$exists": true, "$ne": bson.A{}},
			"isBlueprint": bson.M{"$ne": true},
		}},
		{"$unwind": "$tasks"},
		{"$match": bson.M{
			"tasks.startDate":  bson.M{"$ne": nil, "$lte": cutoff},
			"tasks.lastEdited": bson.M{"$lte": cutoff},
		}},
		{"$project": bson.M{
			"user":       1,
			"taskId":     "$tasks._id",
			"lastEdited": "$tasks.lastEdited",
		}},
		{"$limit": j.policy.MaxMomentsPerTrigger},
	})
	if err != nil {
		return nil, fmt.Errorf("aggregate stalled tasks: %w", err)
	}
	defer cur.Close(ctx)

	var rows []struct {
		User       primitive.ObjectID `bson:"user"`
		TaskID     primitive.ObjectID `bson:"taskId"`
		LastEdited time.Time          `bson:"lastEdited"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("decode stalled tasks: %w", err)
	}

	moments := make([]KudosMoment, 0, len(rows))
	for _, r := range rows {
		moments = append(moments, KudosMoment{
			RecipientID: r.User,
			Trigger:     TriggerTaskStalled,
			Subject:     r.TaskID.Hex(),
			// No task content, ever. Consent to "let friends see when I am stuck"
			// is not consent to publish what I am stuck on.
			Detail:     "has been stuck on something",
			OccurredAt: now,
		})
	}
	return moments, nil
}

// detectStreaksAtRisk finds streaks worth protecting with no completion today.
// STRUGGLE TRIGGER — gated on the subject's consent.
//
// The "is it late enough in their day" half of the question is not asked here:
// it depends on the user's timezone, which costs a lookup per row. The policy's
// delivery window asks it once, after the user is loaded anyway.
func (j *KudosSuggesterJob) detectStreaksAtRisk(ctx context.Context, now time.Time) ([]KudosMoment, error) {
	if j.templateTasks == nil {
		return nil, nil
	}
	// 20 hours rather than 24: a completion "today" in any timezone is within
	// that, and the delivery window narrows it further.
	cutoff := now.Add(-20 * time.Hour)

	cur, err := j.templateTasks.Find(ctx, bson.M{
		"streak":          bson.M{"$gte": j.policy.MinStreakAtRisk},
		"completionDates": bson.M{"$not": bson.M{"$elemMatch": bson.M{"$gte": cutoff}}},
	}, options.Find().SetLimit(j.policy.MaxMomentsPerTrigger))
	if err != nil {
		return nil, fmt.Errorf("find streaks at risk: %w", err)
	}
	defer cur.Close(ctx)

	var rows []struct {
		ID     primitive.ObjectID `bson:"_id"`
		UserID primitive.ObjectID `bson:"userID"`
		Streak int                `bson:"streak"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("decode streaks at risk: %w", err)
	}

	moments := make([]KudosMoment, 0, len(rows))
	for _, r := range rows {
		moments = append(moments, KudosMoment{
			RecipientID: r.UserID,
			Trigger:     TriggerStreakAtRisk,
			// Scoped to the day, so a streak that survives tonight and is at risk
			// again next week is a new moment rather than a suppressed one.
			Subject:    fmt.Sprintf("%s:%s", r.ID.Hex(), now.Format("2006-01-02")),
			Detail:     fmt.Sprintf("has a %d-day streak on the line", r.Streak),
			OccurredAt: now,
		})
	}
	return moments, nil
}

// latestBefore returns the newest timestamp at or before now, or the zero time.
func latestBefore(times []time.Time, now time.Time) time.Time {
	var best time.Time
	for _, t := range times {
		if t.After(now) {
			continue
		}
		if t.After(best) {
			best = t
		}
	}
	return best
}

// ============================================================================
// Turning a moment into prompts
// ============================================================================

func (j *KudosSuggesterJob) processMoment(ctx context.Context, m KudosMoment, now time.Time, stats *runStats, cache *runCache) {
	recipientUser, err := j.loadUser(ctx, m.RecipientID, cache)
	if err != nil || recipientUser == nil {
		if err != nil {
			slog.Error("Kudos suggester: failed to load recipient", "user_id", m.RecipientID, "error", err)
		}
		return
	}

	// The consent gate, checked here as well as inside EvaluateKudosPrompt.
	// Redundant on purpose: this is the branch that stops us from even reading
	// who this person's closest friends are on the strength of a struggle we are
	// not allowed to talk about.
	if m.Trigger.IsStruggle() && !recipientUser.Settings.MayShareStruggles(now) {
		stats.skip(SkipNoStruggleConsent)
		return
	}

	facts, err := j.loadFacts(ctx, m.RecipientID, cache)
	if err != nil {
		slog.Error("Kudos suggester: failed to load recipient facts", "user_id", m.RecipientID, "error", err)
		return
	}

	affinity, err := gemini.DecodeKudosAffinity(factPtr(facts, gemini.FactKeyKudosAffinity))
	if err != nil {
		slog.Warn("Kudos suggester: could not decode kudos-affinity", "user_id", m.RecipientID, "error", err)
		return
	}
	if affinity == nil {
		// No ranking means no basis for choosing whom to ask. The worker owns
		// that judgement, and guessing here — picking a friend at random — is
		// precisely the noise this feature exists to avoid.
		return
	}

	recipient := KudosRecipient{
		ID:          recipientUser.ID,
		DisplayName: recipientUser.DisplayName,
		Settings:    recipientUser.Settings,
		Location:    loadLocation(recipientUser.Timezone),
		EncouragementWorthwhile: gemini.DecodeEncouragementEffect(
			factPtr(facts, gemini.FactKeyEncouragementEffect),
		).Worthwhile(),
	}
	if peak := gemini.DecodePeakHours(factPtr(facts, gemini.FactKeyPeakHours)); peak != nil {
		hour := peak.StartHour
		recipient.PeakStartHour = &hour
	}

	friends := friendSet(recipientUser.Friends)

	sent := 0
	for _, candidate := range affinity.TopFriends(maxSenderCandidates) {
		if sent >= j.policy.MaxSendersPerMoment {
			return
		}

		// The affinity list is the worker's view of the world and can outlive an
		// unfriending by up to its TTL. Kindred's `friends` array is the current
		// truth, and it wins.
		if !friends[candidate.FriendID] {
			continue
		}

		if j.promptOne(ctx, m, recipient, candidate, now, stats, cache) {
			sent++
		}
	}
}

// promptOne evaluates and, if allowed, dispatches a single prompt. Returns
// whether a push actually went out.
func (j *KudosSuggesterJob) promptOne(
	ctx context.Context,
	m KudosMoment,
	recipient KudosRecipient,
	candidate gemini.KudosFriend,
	now time.Time,
	stats *runStats,
	cache *runCache,
) bool {
	senderUser, err := j.loadUser(ctx, candidate.FriendID, cache)
	if err != nil || senderUser == nil {
		if err != nil {
			slog.Error("Kudos suggester: failed to load sender", "user_id", candidate.FriendID, "error", err)
		}
		return false
	}

	senderFacts, err := j.loadFacts(ctx, senderUser.ID, cache)
	if err != nil {
		slog.Error("Kudos suggester: failed to load sender facts", "user_id", senderUser.ID, "error", err)
		return false
	}
	reduce := false
	if r := gemini.DecodeNudgeReceptivity(factPtr(senderFacts, gemini.FactKeyNudgeReceptivity)); r != nil {
		reduce = r.ShouldReduceFrequency
	}

	loc := loadLocation(senderUser.Timezone)
	localDay := LocalDay(now, loc)

	promptsToday, err := j.promptsToday(ctx, senderUser.ID, localDay, cache)
	if err != nil {
		slog.Error("Kudos suggester: failed to count today's prompts", "user_id", senderUser.ID, "error", err)
		return false
	}

	lastForTrigger, err := j.lastPromptAt(ctx, senderUser.ID, recipient.ID, m.Trigger)
	if err != nil {
		slog.Error("Kudos suggester: failed to read cooldown", "user_id", senderUser.ID, "error", err)
		return false
	}

	sender := KudosSender{
		ID:                    senderUser.ID,
		PushToken:             senderUser.PushToken,
		Settings:              senderUser.Settings,
		Location:              loc,
		Affinity:              candidate.Affinity,
		ShouldReduceFrequency: reduce,
		PromptsSentToday:      promptsToday,
		LastPromptForTrigger:  lastForTrigger,
	}

	verdict := EvaluateKudosPrompt(m, recipient, sender, j.policy, now)
	if !verdict.Send {
		stats.skip(verdict.Skip)
		return false
	}

	claimed, recordID, err := j.claimDispatch(ctx, m, sender.ID, localDay, now)
	if err != nil {
		slog.Error("Kudos suggester: failed to claim dispatch", "sender_id", sender.ID, "error", err)
		return false
	}
	if !claimed {
		// Somebody already sent this exact prompt — an earlier tick, or a
		// concurrent one. Not an error, and not a skip worth counting.
		return false
	}

	if err := j.dispatch(m, recipient, sender); err != nil {
		// Nothing was delivered, so the claim is a lie. Releasing it lets a later
		// tick try again; leaving it would silently retire the moment.
		if _, delErr := j.dispatches.DeleteOne(ctx, bson.M{"_id": recordID}); delErr != nil {
			slog.Error("Kudos suggester: failed to release claim after send failure", "record_id", recordID, "error", delErr)
		}
		slog.Error("Kudos suggester: dispatch failed", "sender_id", sender.ID, "recipient_id", recipient.ID, "error", err)
		return false
	}

	cache.promptsToday[sender.ID] = promptsToday + 1
	stats.dispatched++
	return true
}

// claimDispatch writes the ledger row BEFORE the push goes out.
//
// The order is the whole idempotency story. Writing after would leave a window
// in which the job restarts between sending and recording, and the next tick
// sends again. The unique index on dedupeKey turns the second attempt into a
// duplicate-key error, which is the signal that someone else got there first.
func (j *KudosSuggesterJob) claimDispatch(ctx context.Context, m KudosMoment, senderID primitive.ObjectID, localDay string, now time.Time) (bool, primitive.ObjectID, error) {
	record := dispatchRecord{
		ID:          primitive.NewObjectID(),
		DedupeKey:   DedupeKey(senderID, m.RecipientID, m.Trigger, m.Subject),
		SenderID:    senderID,
		RecipientID: m.RecipientID,
		Trigger:     m.Trigger,
		Subject:     m.Subject,
		SentAt:      now,
		LocalDay:    localDay,
		ExpiresAt:   now.Add(j.policy.LedgerRetention),
	}

	if _, err := j.dispatches.InsertOne(ctx, record); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return false, primitive.NilObjectID, nil
		}
		return false, primitive.NilObjectID, err
	}
	return true, record.ID, nil
}

// dispatch delivers the prompt through Kindred's existing notification path:
// the FCM sender in xutils and a row in the `notifications` collection. No
// second sender, no second document shape.
func (j *KudosSuggesterJob) dispatch(m KudosMoment, recipient KudosRecipient, sender KudosSender) error {
	title, body := kudosPromptCopy(m, recipient.DisplayName)

	if err := xutils.SendNotification(xutils.Notification{
		Token:   sender.PushToken,
		Title:   title,
		Message: body,
		Data: map[string]string{
			"type":    "kudos_suggestion",
			"trigger": string(m.Trigger),
			"user_id": recipient.ID.Hex(),
			"url":     "/feed?page=notifications",
		},
	}); err != nil {
		return fmt.Errorf("send kudos prompt push: %w", err)
	}

	// The actor on the notification is the friend the kudos would be FOR, so the
	// card renders their name and avatar; the receiver is the person being
	// prompted. Best-effort, like every other caller of CreateNotification: the
	// push already landed, and failing here should not undo it.
	if err := j.notifier.CreateNotification(
		recipient.ID,
		sender.ID,
		body,
		notifications.NotificationTypeKudosSuggestion,
		recipient.ID,
	); err != nil {
		slog.Error("Kudos suggester: failed to write notification row",
			"sender_id", sender.ID, "recipient_id", recipient.ID, "error", err)
	}

	slog.Info("Kudos prompt dispatched",
		"sender_id", sender.ID,
		"recipient_id", recipient.ID,
		"trigger", m.Trigger)
	return nil
}

// kudosPromptCopy builds the push text.
//
// Nothing here interpolates a task title, a category, or a number from the
// struggle side. The subject's name plus the shape of the moment is the whole
// payload — a friend needs to know that someone could use a word from them, not
// what they are behind on.
func kudosPromptCopy(m KudosMoment, name string) (title, body string) {
	if name == "" {
		name = "A friend"
	}
	switch m.Trigger {
	case TriggerRingsClosed:
		return "Say nice work", fmt.Sprintf("%s closed every ring today. A congratulation would land well right now.", name)
	case TriggerStreakMilestone:
		return "Say nice work", fmt.Sprintf("%s just %s. Worth a word from you.", name, m.Detail)
	case TriggerNotableCompletion:
		return "Say nice work", fmt.Sprintf("%s just finished something big. Now is a good time to tell them.", name)
	case TriggerStreakAtRisk:
		return "A nudge would help", fmt.Sprintf("%s %s today. A word from you goes further than one from us.", name, m.Detail)
	case TriggerTaskStalled:
		return "A nudge would help", fmt.Sprintf("%s could use some encouragement today.", name)
	default:
		return "A nudge would help", fmt.Sprintf("%s could use some encouragement today.", name)
	}
}

// ============================================================================
// Ledger and lookup helpers
// ============================================================================

func (j *KudosSuggesterJob) promptsToday(ctx context.Context, senderID primitive.ObjectID, localDay string, cache *runCache) (int, error) {
	if n, ok := cache.promptsToday[senderID]; ok {
		return n, nil
	}
	count, err := j.dispatches.CountDocuments(ctx, bson.M{"senderId": senderID, "localDay": localDay})
	if err != nil {
		return 0, err
	}
	cache.promptsToday[senderID] = int(count)
	return int(count), nil
}

// lastPromptAt reads the cooldown clock for one (sender, recipient, trigger)
// triple. Deliberately not cached: a dispatch inside this same tick has to be
// visible to the next candidate for the same triple.
func (j *KudosSuggesterJob) lastPromptAt(ctx context.Context, senderID, recipientID primitive.ObjectID, trigger TriggerType) (*time.Time, error) {
	var row struct {
		SentAt time.Time `bson:"sentAt"`
	}
	err := j.dispatches.FindOne(ctx,
		bson.M{"senderId": senderID, "recipientId": recipientID, "trigger": trigger},
		options.FindOne().SetSort(bson.D{{Key: "sentAt", Value: -1}}),
	).Decode(&row)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row.SentAt, nil
}

func (j *KudosSuggesterJob) loadUser(ctx context.Context, id primitive.ObjectID, cache *runCache) (*types.User, error) {
	if u, ok := cache.users[id]; ok {
		return u, nil
	}
	var user types.User
	err := j.users.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		cache.users[id] = nil
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	cache.users[id] = &user
	return &user, nil
}

func (j *KudosSuggesterJob) loadFacts(ctx context.Context, id primitive.ObjectID, cache *runCache) ([]gemini.UserFact, error) {
	if f, ok := cache.facts[id]; ok {
		return f, nil
	}
	facts, err := gemini.LoadUserFacts(ctx, j.userMemory, id, 40)
	if err != nil {
		return nil, err
	}
	cache.facts[id] = facts
	return facts, nil
}

// factPtr returns a pointer to one fact of a loaded profile, or nil. Every
// decoder in the gemini package treats nil as "we do not know", so a missing
// fact needs no special case at any call site.
func factPtr(facts []gemini.UserFact, key string) *gemini.UserFact {
	if f, ok := gemini.FindUserFact(facts, key); ok {
		return &f
	}
	return nil
}

func friendSet(ids []primitive.ObjectID) map[primitive.ObjectID]bool {
	set := make(map[primitive.ObjectID]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set
}

// loadLocation resolves a user's timezone, falling back to UTC exactly as
// checkin.go does for an unset or unparseable value.
func loadLocation(timezone string) *time.Location {
	if timezone == "" {
		return time.UTC
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return time.UTC
	}
	return loc
}
