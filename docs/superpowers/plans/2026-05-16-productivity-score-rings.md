# Productivity Score & Rings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace points and visible streaks with a Productivity Score (0-100) powered by three daily rings (Plan, Do, Share), with a variable AI credit reward when all rings close.

**Architecture:** New `rings` handler package with a RingService that tracks daily ring state in a `ring_states` MongoDB collection. Existing handlers (task, post, encouragement, congratulation) call RingService as a side effect. Frontend replaces the TodayStats 4-stat grid with a three-ring visualization and score display, reusing the DashboardStats expand/collapse pattern.

**Tech Stack:** Go/Fiber/Huma (backend), MongoDB (ring_states collection), React Native/Expo (frontend), Reanimated (ring animations)

**Spec:** `docs/superpowers/specs/2026-05-16-productivity-score-rings-design.md`

---

## File Map

### Backend — New Files
- `backend/internal/handlers/rings/types.go` — RingState document type, API input/output types
- `backend/internal/handlers/rings/service.go` — Core ring logic (increment, score calculation, reward claiming)
- `backend/internal/handlers/rings/routes.go` — HTTP handler registration
- `backend/internal/handlers/rings/service_test.go` — Tests for ring service

### Backend — Modified Files
- `backend/internal/handlers/types/types.go` — Add `ProductivityScore` and `LastRewardDate` to User struct, keep `Points` but stop exposing it
- `backend/internal/handlers/task/task_service.go` — Call RingService on task creation and completion
- `backend/internal/handlers/task/handler.go` — Pass RingService to task service
- `backend/internal/handlers/post/service.go` — Remove points logic, call RingService.IncrementShare
- `backend/internal/handlers/encouragement/service.go` — Call RingService.IncrementShare after sending
- `backend/internal/handlers/congratulation/service.go` — Call RingService.IncrementShare after sending
- `backend/internal/server/server.go` — Register rings routes, pass RingService to other handlers
- `backend/internal/handlers/category/handler.go` — Pass RingService for task creation ring tracking

### Frontend — New Files
- `frontend/api/rings.ts` — API client for ring endpoints
- `frontend/hooks/useRings.ts` — Hook for ring state and score
- `frontend/components/profile/ProductivityRings.tsx` — Three-ring visualization with score

### Frontend — Modified Files
- `frontend/api/types.ts` — Add RingState, RingRewardResponse types
- `frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx` — Replace TodayStats with ProductivityRings
- `frontend/components/dashboard/HomescrollContent.tsx` — Add compact ring widget to dashboard
- `frontend/components/profile/TodayStats.tsx` — Remove (or stop importing)

---

## Task 1: Backend — Ring State Types

**Files:**
- Create: `backend/internal/handlers/rings/types.go`

- [ ] **Step 1: Create the rings package directory**

```bash
mkdir -p backend/internal/handlers/rings
```

- [ ] **Step 2: Write the types file**

```go
// backend/internal/handlers/rings/types.go
package rings

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// RingState represents a user's daily ring progress.
type RingState struct {
	ID            bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	UserID        bson.ObjectID `bson:"user_id" json:"user_id"`
	Date          string        `bson:"date" json:"date"` // YYYY-MM-DD in user's timezone
	Plan          RingProgress  `bson:"plan" json:"plan"`
	Do            RingProgress  `bson:"do" json:"do"`
	Share         RingProgress  `bson:"share" json:"share"`
	AllClosed     bool          `bson:"all_closed" json:"all_closed"`
	RewardClaimed bool          `bson:"reward_claimed" json:"reward_claimed"`
	RewardType    string        `bson:"reward_type,omitempty" json:"reward_type,omitempty"`
	RewardAmount  int           `bson:"reward_amount,omitempty" json:"reward_amount,omitempty"`
	CreatedAt     time.Time     `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time     `bson:"updated_at" json:"updated_at"`
}

// RingProgress tracks current vs target for a single ring.
type RingProgress struct {
	Current int  `bson:"current" json:"current"`
	Target  int  `bson:"target" json:"target"`
	Closed  bool `bson:"closed" json:"closed"`
}

// RingType identifies which ring to increment.
type RingType string

const (
	RingPlan  RingType = "plan"
	RingDo    RingType = "do"
	RingShare RingType = "share"
)

// Default daily targets (v1 — fixed).
const (
	DefaultPlanTarget  = 2
	DefaultDoTarget    = 3
	DefaultShareTarget = 1
)

// Reward drop weights and amounts.
type RewardDrop struct {
	CreditType string
	Amount     int
	Weight     int // relative weight for random selection
}

var RewardPool = []RewardDrop{
	{CreditType: "voice", Amount: 1, Weight: 40},
	{CreditType: "naturalLanguage", Amount: 1, Weight: 40},
	{CreditType: "analytics", Amount: 1, Weight: 15},
	{CreditType: "voice", Amount: 2, Weight: 5},
}

// Score calculation constants.
const (
	ScoreBase        = 50
	ScoreRingWindow  = 7 // days
	ScoreMaxRings    = 3 * ScoreRingWindow // 21
	ScoreRingBonus   = 50
	ScoreMaxStreak   = 7
	ScoreDisplayMin  = 30
)

// --- API types ---

type GetTodayResponse struct {
	Rings RingState `json:"rings"`
	Score int       `json:"score"`
}

type GetHistoryInput struct {
	Days int `query:"days" default:"7" doc:"Number of days of history to return (max 30)"`
}

type GetHistoryResponse struct {
	History []RingState `json:"history"`
	Score   int         `json:"score"`
}

type ClaimRewardResponse struct {
	Claimed    bool   `json:"claimed"`
	CreditType string `json:"credit_type,omitempty"`
	Amount     int    `json:"amount,omitempty"`
	Message    string `json:"message"`
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/rings/types.go
git commit -m "feat(rings): add ring state types and constants"
```

---

## Task 2: Backend — Ring Service Core Logic

**Files:**
- Create: `backend/internal/handlers/rings/service.go`

- [ ] **Step 1: Write the ring service**

```go
// backend/internal/handlers/rings/service.go
package rings

import (
	"context"
	"log/slog"
	"math"
	"math/rand/v2"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"kindred/internal/handlers/types"
)

type RingService struct {
	ringStates *mongo.Collection
	users      *mongo.Collection
}

func NewRingService(ringStates, users *mongo.Collection) *RingService {
	return &RingService{
		ringStates: ringStates,
		users:      users,
	}
}

// getDateForUser returns today's date string in the user's timezone.
func getDateForUser(timezone string) string {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	return time.Now().In(loc).Format("2006-01-02")
}

// GetOrCreateToday returns today's ring state for the user, creating it if needed.
func (s *RingService) GetOrCreateToday(ctx context.Context, userID bson.ObjectID, timezone string) (*RingState, error) {
	date := getDateForUser(timezone)

	filter := bson.M{"user_id": userID, "date": date}
	var state RingState
	err := s.ringStates.FindOne(ctx, filter).Decode(&state)
	if err == mongo.ErrNoDocuments {
		state = RingState{
			UserID: userID,
			Date:   date,
			Plan:   RingProgress{Current: 0, Target: DefaultPlanTarget},
			Do:     RingProgress{Current: 0, Target: DefaultDoTarget},
			Share:  RingProgress{Current: 0, Target: DefaultShareTarget},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		result, insertErr := s.ringStates.InsertOne(ctx, state)
		if insertErr != nil {
			return nil, insertErr
		}
		state.ID = result.InsertedID.(bson.ObjectID)
		return &state, nil
	}
	if err != nil {
		return nil, err
	}
	return &state, nil
}

// IncrementRing increments a ring's current count by 1 and checks for closure.
// Returns the updated state and whether all rings just closed (for reward trigger).
func (s *RingService) IncrementRing(ctx context.Context, userID bson.ObjectID, timezone string, ring RingType) (*RingState, bool, error) {
	state, err := s.GetOrCreateToday(ctx, userID, timezone)
	if err != nil {
		return nil, false, err
	}

	wasAllClosed := state.AllClosed

	// Build the field path for the ring
	fieldPrefix := string(ring)
	currentField := fieldPrefix + ".current"

	// Increment the ring's current count
	update := bson.M{
		"$inc": bson.M{currentField: 1},
		"$set": bson.M{"updated_at": time.Now()},
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated RingState
	err = s.ringStates.FindOneAndUpdate(ctx, bson.M{"_id": state.ID}, update, opts).Decode(&updated)
	if err != nil {
		return nil, false, err
	}

	// Check and update closure status
	updated.Plan.Closed = updated.Plan.Current >= updated.Plan.Target
	updated.Do.Closed = updated.Do.Current >= updated.Do.Target
	updated.Share.Closed = updated.Share.Current >= updated.Share.Target
	allClosed := updated.Plan.Closed && updated.Do.Closed && updated.Share.Closed
	updated.AllClosed = allClosed

	// Persist closure flags
	_, err = s.ringStates.UpdateOne(ctx, bson.M{"_id": state.ID}, bson.M{
		"$set": bson.M{
			"plan.closed":  updated.Plan.Closed,
			"do.closed":    updated.Do.Closed,
			"share.closed": updated.Share.Closed,
			"all_closed":   allClosed,
		},
	})
	if err != nil {
		return nil, false, err
	}

	justClosedAll := allClosed && !wasAllClosed

	// Recalculate and cache the productivity score
	if err := s.recalculateScore(ctx, userID, timezone); err != nil {
		slog.Error("failed to recalculate productivity score", "error", err, "userID", userID)
	}

	return &updated, justClosedAll, nil
}

// recalculateScore computes the productivity score and caches it on the user document.
func (s *RingService) recalculateScore(ctx context.Context, userID bson.ObjectID, timezone string) error {
	score, err := s.CalculateScore(ctx, userID, timezone)
	if err != nil {
		return err
	}
	_, err = s.users.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$set": bson.M{"productivity_score": score},
	})
	return err
}

// CalculateScore computes the productivity score for a user.
// Formula: base(50) + ringBonus(0-50) + streakBonus(0-7), capped at 100.
func (s *RingService) CalculateScore(ctx context.Context, userID bson.ObjectID, timezone string) (int, error) {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)

	// Get ring states for the last 7 days
	dates := make([]string, ScoreRingWindow)
	for i := range ScoreRingWindow {
		dates[i] = now.AddDate(0, 0, -i).Format("2006-01-02")
	}

	filter := bson.M{
		"user_id": userID,
		"date":    bson.M{"$in": dates},
	}
	cursor, err := s.ringStates.Find(ctx, filter)
	if err != nil {
		return ScoreBase, err
	}
	defer cursor.Close(ctx)

	var states []RingState
	if err := cursor.All(ctx, &states); err != nil {
		return ScoreBase, err
	}

	// Count total rings closed
	ringsClosedCount := 0
	for _, st := range states {
		if st.Plan.Closed {
			ringsClosedCount++
		}
		if st.Do.Closed {
			ringsClosedCount++
		}
		if st.Share.Closed {
			ringsClosedCount++
		}
	}

	// Get user's current streak
	var user types.User
	err = s.users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return ScoreBase, err
	}

	ringBonus := float64(ringsClosedCount) / float64(ScoreMaxRings) * float64(ScoreRingBonus)
	streakBonus := float64(min(user.Streak, ScoreMaxStreak))
	score := int(math.Min(float64(ScoreBase)+ringBonus+streakBonus, 100))

	return score, nil
}

// GetHistory returns ring states for the last N days.
func (s *RingService) GetHistory(ctx context.Context, userID bson.ObjectID, timezone string, days int) ([]RingState, error) {
	if days > 30 {
		days = 30
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)

	dates := make([]string, days)
	for i := range days {
		dates[i] = now.AddDate(0, 0, -i).Format("2006-01-02")
	}

	filter := bson.M{
		"user_id": userID,
		"date":    bson.M{"$in": dates},
	}
	opts := options.Find().SetSort(bson.M{"date": -1})
	cursor, err := s.ringStates.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var states []RingState
	if err := cursor.All(ctx, &states); err != nil {
		return nil, err
	}
	return states, nil
}

// ClaimReward claims the daily reward for closing all rings.
// Returns the reward details or an error if not eligible.
func (s *RingService) ClaimReward(ctx context.Context, userID bson.ObjectID, timezone string) (*ClaimRewardResponse, error) {
	state, err := s.GetOrCreateToday(ctx, userID, timezone)
	if err != nil {
		return nil, err
	}

	if !state.AllClosed {
		return &ClaimRewardResponse{
			Claimed: false,
			Message: "Not all rings are closed today",
		}, nil
	}

	if state.RewardClaimed {
		return &ClaimRewardResponse{
			Claimed: false,
			Message: "Reward already claimed today",
		}, nil
	}

	// Pick a random reward
	drop := pickRandomReward()

	// Apply credit to user
	creditField, err := types.GetCreditFieldName(drop.CreditType)
	if err != nil {
		return nil, err
	}
	_, err = s.users.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$inc": bson.M{creditField: drop.Amount},
		"$set": bson.M{"last_reward_date": time.Now()},
	})
	if err != nil {
		return nil, err
	}

	// Mark reward as claimed
	_, err = s.ringStates.UpdateOne(ctx, bson.M{"_id": state.ID}, bson.M{
		"$set": bson.M{
			"reward_claimed": true,
			"reward_type":    drop.CreditType,
			"reward_amount":  drop.Amount,
		},
	})
	if err != nil {
		return nil, err
	}

	return &ClaimRewardResponse{
		Claimed:    true,
		CreditType: drop.CreditType,
		Amount:     drop.Amount,
		Message:    "Reward claimed!",
	}, nil
}

// pickRandomReward selects a reward from the pool using weighted random selection.
func pickRandomReward() RewardDrop {
	totalWeight := 0
	for _, r := range RewardPool {
		totalWeight += r.Weight
	}

	roll := rand.IntN(totalWeight)
	cumulative := 0
	for _, r := range RewardPool {
		cumulative += r.Weight
		if roll < cumulative {
			return r
		}
	}
	return RewardPool[0]
}

// EnsureIndexes creates required indexes on the ring_states collection.
func (s *RingService) EnsureIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user_id", Value: 1}, {Key: "date", Value: -1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "created_at", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(30 * 24 * 60 * 60), // 30 day TTL
		},
	}
	_, err := s.ringStates.Indexes().CreateMany(ctx, indexes)
	return err
}
```

Note: The `types.GetCreditFieldName` function needs to be exported. It currently exists as `getCreditFieldName` (unexported) in `backend/internal/handlers/types/credits.go` at line 143. This will be addressed in Task 4.

- [ ] **Step 2: Commit**

```bash
git add backend/internal/handlers/rings/service.go
git commit -m "feat(rings): add ring service with increment, score, and reward logic"
```

---

## Task 3: Backend — Ring API Routes

**Files:**
- Create: `backend/internal/handlers/rings/routes.go`

- [ ] **Step 1: Write the routes file**

```go
// backend/internal/handlers/rings/routes.go
package rings

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"kindred/internal/auth"
)

type RingHandler struct {
	service *RingService
}

func Routes(api huma.API, service *RingService) {
	h := &RingHandler{service: service}

	huma.Register(api, huma.Operation{
		OperationID: "get-rings-today",
		Method:      http.MethodGet,
		Path:        "/v1/user/rings/today",
		Summary:     "Get today's ring state",
		Tags:        []string{"Rings"},
	}, h.GetToday)

	huma.Register(api, huma.Operation{
		OperationID: "get-rings-history",
		Method:      http.MethodGet,
		Path:        "/v1/user/rings/history",
		Summary:     "Get ring history",
		Tags:        []string{"Rings"},
	}, h.GetHistory)

	huma.Register(api, huma.Operation{
		OperationID: "claim-ring-reward",
		Method:      http.MethodPost,
		Path:        "/v1/user/rings/reward",
		Summary:     "Claim daily ring reward",
		Tags:        []string{"Rings"},
	}, h.ClaimReward)
}

type GetTodayOutput struct {
	Body GetTodayResponse
}

func (h *RingHandler) GetToday(ctx context.Context, input *struct{}) (*GetTodayOutput, error) {
	userID := auth.GetUserID(ctx)
	timezone := auth.GetTimezone(ctx)

	state, err := h.service.GetOrCreateToday(ctx, userID, timezone)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to get ring state", err)
	}

	score, err := h.service.CalculateScore(ctx, userID, timezone)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to calculate score", err)
	}

	return &GetTodayOutput{
		Body: GetTodayResponse{
			Rings: *state,
			Score: score,
		},
	}, nil
}

type GetHistoryOutput struct {
	Body GetHistoryResponse
}

func (h *RingHandler) GetHistory(ctx context.Context, input *GetHistoryInput) (*GetHistoryOutput, error) {
	userID := auth.GetUserID(ctx)
	timezone := auth.GetTimezone(ctx)

	history, err := h.service.GetHistory(ctx, userID, timezone, input.Days)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to get ring history", err)
	}

	score, err := h.service.CalculateScore(ctx, userID, timezone)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to calculate score", err)
	}

	return &GetHistoryOutput{
		Body: GetHistoryResponse{
			History: history,
			Score:   score,
		},
	}, nil
}

type ClaimRewardOutput struct {
	Body ClaimRewardResponse
}

func (h *RingHandler) ClaimReward(ctx context.Context, input *struct{}) (*ClaimRewardOutput, error) {
	userID := auth.GetUserID(ctx)
	timezone := auth.GetTimezone(ctx)

	result, err := h.service.ClaimReward(ctx, userID, timezone)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to claim reward", err)
	}

	return &ClaimRewardOutput{Body: *result}, nil
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/internal/handlers/rings/routes.go
git commit -m "feat(rings): add API routes for ring state, history, and rewards"
```

---

## Task 4: Backend — Export Credit Field Name Helper

**Files:**
- Modify: `backend/internal/handlers/types/credits.go` (line 143)

The ring service needs to map credit type strings to BSON field paths. The existing `getCreditFieldName` function is unexported. Export it.

- [ ] **Step 1: Read the current function**

```bash
cd /Users/abhik.ray/Kindred && sed -n '143,160p' backend/internal/handlers/types/credits.go
```

- [ ] **Step 2: Rename `getCreditFieldName` to `GetCreditFieldName`**

Change the function signature from:
```go
func getCreditFieldName(creditType string) (string, error) {
```
to:
```go
func GetCreditFieldName(creditType string) (string, error) {
```

Update all callers within the same file (there should be calls in `ConsumeCredit`, `AddCredits`, `CheckCredits`) to use `GetCreditFieldName`.

- [ ] **Step 3: Verify build**

```bash
cd /Users/abhik.ray/Kindred/backend && go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/types/credits.go
git commit -m "refactor(credits): export GetCreditFieldName for cross-package use"
```

---

## Task 5: Backend — Add User Fields for Productivity Score

**Files:**
- Modify: `backend/internal/handlers/types/types.go` (User struct, around line 251)

- [ ] **Step 1: Add new fields to User struct**

After the `Points` field (line 251), add:

```go
ProductivityScore int        `bson:"productivity_score" json:"productivity_score"`
LastRewardDate    *time.Time `bson:"last_reward_date,omitempty" json:"last_reward_date,omitempty"`
```

Do NOT remove the `Points` field yet — it stays in the DB for backward compatibility during migration. We just stop writing to it and stop including it in profile API responses (handled in Task 8).

- [ ] **Step 2: Verify build**

```bash
cd /Users/abhik.ray/Kindred/backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/types/types.go
git commit -m "feat(types): add ProductivityScore and LastRewardDate to User"
```

---

## Task 6: Backend — Wire Ring Increments Into Existing Handlers

**Files:**
- Modify: `backend/internal/server/server.go`
- Modify: `backend/internal/handlers/task/task_service.go`
- Modify: `backend/internal/handlers/post/service.go`
- Modify: `backend/internal/handlers/encouragement/service.go`
- Modify: `backend/internal/handlers/congratulation/service.go`

This task wires the RingService into existing handlers as a side effect. Ring increments are fire-and-forget — failures are logged but don't block the primary operation.

- [ ] **Step 1: Register ring routes and create RingService in server.go**

In `server.go`, after the existing handler registrations (around line 175):

1. Get or create the `ring_states` collection from the database
2. Create a `RingService` instance
3. Call `rings.Routes(api, ringService)`
4. Ensure indexes on startup
5. Pass the `ringService` to task, post, encouragement, and congratulation handlers

The exact wiring depends on how each handler package accepts dependencies. Follow the existing pattern — most handler packages have a `Routes(api, collections)` or `Routes(api, collections, service)` signature. Add `ringService *rings.RingService` as an additional parameter where needed.

- [ ] **Step 2: Wire into task completion (Do ring)**

In `task_service.go`, after the successful task completion (around line 445, after streak logic), add:

```go
// Increment Do ring (fire-and-forget)
go func() {
    bgCtx := context.Background()
    if _, _, err := ringService.IncrementRing(bgCtx, userId, userTimezone, rings.RingDo); err != nil {
        slog.Error("failed to increment Do ring", "error", err, "userID", userId)
    }
}()
```

The `ringService` needs to be accessible from the task service. Either pass it as a field on the task service struct, or pass it through the handler layer. Follow the existing pattern for how `geminiService` is passed to task handlers (see `server.go` line 146).

- [ ] **Step 3: Wire into task creation (Plan ring)**

In the task creation handler (the function that handles `POST /v1/user/tasks/{category}`), after successful task insertion, add:

```go
// Increment Plan ring (fire-and-forget)
go func() {
    bgCtx := context.Background()
    if _, _, err := ringService.IncrementRing(bgCtx, userId, userTimezone, rings.RingPlan); err != nil {
        slog.Error("failed to increment Plan ring", "error", err, "userID", userId)
    }
}()
```

- [ ] **Step 4: Wire into post creation (Share ring) and remove points logic**

In `post/service.go`, in the `updateUserPostStats` function (lines 242-269):

1. Remove the points calculation logic (the `$add` with streak)
2. Remove `points` from the update pipeline
3. After the post stats update, increment the Share ring:

```go
// Increment Share ring (fire-and-forget)
go func() {
    bgCtx := context.Background()
    if _, _, err := ringService.IncrementRing(bgCtx, userId, userTimezone, rings.RingShare); err != nil {
        slog.Error("failed to increment Share ring", "error", err, "userID", userId)
    }
}()
```

- [ ] **Step 5: Wire into encouragement creation (Share ring)**

In `encouragement/service.go`, after the successful `DecrementUserBalance` call (around line 169), add:

```go
// Increment Share ring (fire-and-forget)
go func() {
    bgCtx := context.Background()
    if _, _, err := ringService.IncrementRing(bgCtx, senderID, senderTimezone, rings.RingShare); err != nil {
        slog.Error("failed to increment Share ring on encouragement", "error", err, "userID", senderID)
    }
}()
```

The sender's timezone needs to be available. It should already be in the auth context (`auth.GetTimezone(ctx)`). Pass it through to the service function.

- [ ] **Step 6: Wire into congratulation creation (Share ring)**

Same pattern as Step 5, in `congratulation/service.go` after `DecrementUserBalance`:

```go
// Increment Share ring (fire-and-forget)
go func() {
    bgCtx := context.Background()
    if _, _, err := ringService.IncrementRing(bgCtx, senderID, senderTimezone, rings.RingShare); err != nil {
        slog.Error("failed to increment Share ring on congratulation", "error", err, "userID", senderID)
    }
}()
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/abhik.ray/Kindred/backend && go build ./...
```

- [ ] **Step 8: Commit**

```bash
git add backend/internal/server/server.go \
    backend/internal/handlers/task/ \
    backend/internal/handlers/post/ \
    backend/internal/handlers/encouragement/ \
    backend/internal/handlers/congratulation/
git commit -m "feat(rings): wire ring increments into task, post, and kudos handlers"
```

---

## Task 7: Backend — Ring Service Tests

**Files:**
- Create: `backend/internal/handlers/rings/service_test.go`

- [ ] **Step 1: Write tests for the ring service**

Follow the existing test pattern from `backend/internal/testing/`. Tests use ephemeral MongoDB databases with pre-seeded fixtures.

```go
// backend/internal/handlers/rings/service_test.go
package rings

import (
	"context"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"

	kindredtest "kindred/internal/testing"
)

func TestGetOrCreateToday(t *testing.T) {
	suite := kindredtest.NewSuite(t)
	defer suite.Teardown()

	ringStates := suite.DB.Collection("ring_states")
	users := suite.DB.Collection("users")
	service := NewRingService(ringStates, users)

	userID := suite.Fixtures.Users[0].ID

	// First call creates a new ring state
	state, err := service.GetOrCreateToday(context.Background(), userID, "UTC")
	if err != nil {
		t.Fatalf("GetOrCreateToday failed: %v", err)
	}
	if state.Plan.Target != DefaultPlanTarget {
		t.Errorf("expected Plan target %d, got %d", DefaultPlanTarget, state.Plan.Target)
	}
	if state.Do.Target != DefaultDoTarget {
		t.Errorf("expected Do target %d, got %d", DefaultDoTarget, state.Do.Target)
	}
	if state.Share.Target != DefaultShareTarget {
		t.Errorf("expected Share target %d, got %d", DefaultShareTarget, state.Share.Target)
	}

	// Second call returns the same state
	state2, err := service.GetOrCreateToday(context.Background(), userID, "UTC")
	if err != nil {
		t.Fatalf("second GetOrCreateToday failed: %v", err)
	}
	if state.ID != state2.ID {
		t.Error("expected same ring state document on second call")
	}
}

func TestIncrementRing(t *testing.T) {
	suite := kindredtest.NewSuite(t)
	defer suite.Teardown()

	ringStates := suite.DB.Collection("ring_states")
	users := suite.DB.Collection("users")
	service := NewRingService(ringStates, users)

	userID := suite.Fixtures.Users[0].ID

	// Increment Do ring once
	state, justClosed, err := service.IncrementRing(context.Background(), userID, "UTC", RingDo)
	if err != nil {
		t.Fatalf("IncrementRing failed: %v", err)
	}
	if state.Do.Current != 1 {
		t.Errorf("expected Do.Current = 1, got %d", state.Do.Current)
	}
	if state.Do.Closed {
		t.Error("Do ring should not be closed after 1 increment (target is 3)")
	}
	if justClosed {
		t.Error("all rings should not be closed yet")
	}
}

func TestAllRingsClose(t *testing.T) {
	suite := kindredtest.NewSuite(t)
	defer suite.Teardown()

	ringStates := suite.DB.Collection("ring_states")
	users := suite.DB.Collection("users")
	service := NewRingService(ringStates, users)

	userID := suite.Fixtures.Users[0].ID
	ctx := context.Background()

	// Close Plan ring (target: 2)
	service.IncrementRing(ctx, userID, "UTC", RingPlan)
	service.IncrementRing(ctx, userID, "UTC", RingPlan)

	// Close Do ring (target: 3)
	service.IncrementRing(ctx, userID, "UTC", RingDo)
	service.IncrementRing(ctx, userID, "UTC", RingDo)
	service.IncrementRing(ctx, userID, "UTC", RingDo)

	// Close Share ring (target: 1) — this should trigger justClosedAll
	state, justClosed, err := service.IncrementRing(ctx, userID, "UTC", RingShare)
	if err != nil {
		t.Fatalf("final IncrementRing failed: %v", err)
	}
	if !state.AllClosed {
		t.Error("expected AllClosed to be true")
	}
	if !justClosed {
		t.Error("expected justClosedAll to be true on the closing increment")
	}
}

func TestClaimReward(t *testing.T) {
	suite := kindredtest.NewSuite(t)
	defer suite.Teardown()

	ringStates := suite.DB.Collection("ring_states")
	users := suite.DB.Collection("users")
	service := NewRingService(ringStates, users)

	userID := suite.Fixtures.Users[0].ID
	ctx := context.Background()

	// Cannot claim without closing all rings
	result, err := service.ClaimReward(ctx, userID, "UTC")
	if err != nil {
		t.Fatalf("ClaimReward failed: %v", err)
	}
	if result.Claimed {
		t.Error("should not be able to claim without closing all rings")
	}

	// Close all rings
	service.IncrementRing(ctx, userID, "UTC", RingPlan)
	service.IncrementRing(ctx, userID, "UTC", RingPlan)
	service.IncrementRing(ctx, userID, "UTC", RingDo)
	service.IncrementRing(ctx, userID, "UTC", RingDo)
	service.IncrementRing(ctx, userID, "UTC", RingDo)
	service.IncrementRing(ctx, userID, "UTC", RingShare)

	// Claim reward
	result, err = service.ClaimReward(ctx, userID, "UTC")
	if err != nil {
		t.Fatalf("ClaimReward failed: %v", err)
	}
	if !result.Claimed {
		t.Error("expected reward to be claimed")
	}
	if result.CreditType == "" {
		t.Error("expected a credit type")
	}
	if result.Amount < 1 {
		t.Error("expected amount >= 1")
	}

	// Cannot claim twice
	result2, err := service.ClaimReward(ctx, userID, "UTC")
	if err != nil {
		t.Fatalf("second ClaimReward failed: %v", err)
	}
	if result2.Claimed {
		t.Error("should not be able to claim twice in one day")
	}
}

func TestCalculateScore(t *testing.T) {
	suite := kindredtest.NewSuite(t)
	defer suite.Teardown()

	ringStates := suite.DB.Collection("ring_states")
	users := suite.DB.Collection("users")
	service := NewRingService(ringStates, users)

	userID := suite.Fixtures.Users[0].ID
	ctx := context.Background()

	// Base score with no rings closed should be 50 + streak bonus
	score, err := service.CalculateScore(ctx, userID, "UTC")
	if err != nil {
		t.Fatalf("CalculateScore failed: %v", err)
	}
	// Score should be at least 50 (base) and at most 50 + streak
	if score < ScoreBase {
		t.Errorf("expected score >= %d, got %d", ScoreBase, score)
	}

	// Close some rings and check score increases
	service.IncrementRing(ctx, userID, "UTC", RingDo)
	service.IncrementRing(ctx, userID, "UTC", RingDo)
	service.IncrementRing(ctx, userID, "UTC", RingDo)

	scoreAfter, err := service.CalculateScore(ctx, userID, "UTC")
	if err != nil {
		t.Fatalf("CalculateScore after increments failed: %v", err)
	}
	if scoreAfter <= score {
		t.Errorf("expected score to increase after closing Do ring, was %d now %d", score, scoreAfter)
	}
}

func TestPickRandomReward(t *testing.T) {
	// Verify reward pool weights sum correctly and all rewards are reachable
	counts := make(map[string]int)
	for range 10000 {
		r := pickRandomReward()
		key := r.CreditType + "_" + bson.Raw([]byte{byte(r.Amount)}).String()
		counts[key] = counts[key] + 1
	}
	if len(counts) < 3 {
		t.Errorf("expected at least 3 distinct reward types, got %d", len(counts))
	}
}
```

- [ ] **Step 2: Run the tests**

```bash
cd /Users/abhik.ray/Kindred && make test-backend
```

Expected: All new ring tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/rings/service_test.go
git commit -m "test(rings): add tests for ring service core logic"
```

---

## Task 8: Backend — Hide Points and Streak From Profile Responses

**Files:**
- Modify: Profile handler (the handler serving `GET /v1/profiles/{id}`)

- [ ] **Step 1: Find the profile response type**

Look at the profile handler to find where the User struct is serialized to JSON. The goal is to:
1. Stop including `points` in profile API responses (set to 0 or omit)
2. Stop including `streak` in profile API responses for OTHER users (keep for own profile since it feeds the score internally)
3. Include `productivity_score` in profile responses

The approach depends on whether the profile handler returns the raw User struct or a separate profile response type. If it returns the raw User, add `json:"-"` to the Points field or create a profile-specific response type.

- [ ] **Step 2: Verify the API no longer returns points**

```bash
# After starting the dev server, test the profile endpoint
curl -H "Authorization: Bearer <token>" http://localhost:8080/v1/profiles/<id> | jq '.points, .productivity_score'
```

Expected: `points` should be absent or 0, `productivity_score` should be present.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/
git commit -m "feat(profile): expose productivity_score, hide points from profile responses"
```

---

## Task 9: Frontend — Ring API Client

**Files:**
- Create: `frontend/api/rings.ts`
- Modify: `frontend/api/types.ts`

- [ ] **Step 1: Add ring types to types.ts**

Add at the end of `frontend/api/types.ts`:

```typescript
// Ring system types
export interface RingProgress {
    current: number;
    target: number;
    closed: boolean;
}

export interface RingState {
    _id: string;
    user_id: string;
    date: string;
    plan: RingProgress;
    do: RingProgress;
    share: RingProgress;
    all_closed: boolean;
    reward_claimed: boolean;
    reward_type?: string;
    reward_amount?: number;
}

export interface RingTodayResponse {
    rings: RingState;
    score: number;
}

export interface RingHistoryResponse {
    history: RingState[];
    score: number;
}

export interface RingRewardResponse {
    claimed: boolean;
    credit_type?: string;
    amount?: number;
    message: string;
}
```

- [ ] **Step 2: Create the ring API client**

```typescript
// frontend/api/rings.ts
import { createLogger } from '@/utils/logger';
import { withAuthHeaders } from './client';
import type { RingTodayResponse, RingHistoryResponse, RingRewardResponse } from './types';

const logger = createLogger('api:rings');

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

export async function getRingsToday(): Promise<RingTodayResponse> {
    logger.debug('Fetching today ring state');
    const response = await fetch(`${API_BASE}/v1/user/rings/today`, {
        method: 'GET',
        headers: await withAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch rings: ${response.status}`);
    }
    return response.json();
}

export async function getRingsHistory(days: number = 7): Promise<RingHistoryResponse> {
    logger.debug('Fetching ring history', { days });
    const response = await fetch(`${API_BASE}/v1/user/rings/history?days=${days}`, {
        method: 'GET',
        headers: await withAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch ring history: ${response.status}`);
    }
    return response.json();
}

export async function claimRingReward(): Promise<RingRewardResponse> {
    logger.debug('Claiming ring reward');
    const response = await fetch(`${API_BASE}/v1/user/rings/reward`, {
        method: 'POST',
        headers: await withAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error(`Failed to claim reward: ${response.status}`);
    }
    return response.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/api/rings.ts frontend/api/types.ts
git commit -m "feat(frontend): add ring API client and types"
```

---

## Task 10: Frontend — useRings Hook

**Files:**
- Create: `frontend/hooks/useRings.ts`

- [ ] **Step 1: Create the hook**

```typescript
// frontend/hooks/useRings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRingsToday, getRingsHistory, claimRingReward } from '@/api/rings';
import { useAuth } from '@/hooks/useAuth';
import type { RingRewardResponse } from '@/api/types';

export function useRings() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const todayQuery = useQuery({
        queryKey: ['rings', 'today'],
        queryFn: getRingsToday,
        enabled: !!user,
        staleTime: 60 * 1000, // 1 minute — rings change frequently
        refetchInterval: 5 * 60 * 1000, // refresh every 5 min in background
    });

    const historyQuery = useQuery({
        queryKey: ['rings', 'history'],
        queryFn: () => getRingsHistory(7),
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    });

    const claimRewardMutation = useMutation({
        mutationFn: claimRingReward,
        onSuccess: (data: RingRewardResponse) => {
            // Refetch ring state to update reward_claimed
            queryClient.invalidateQueries({ queryKey: ['rings'] });
            // Refetch user to update credit balances
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
    });

    const rings = todayQuery.data?.rings;
    const score = todayQuery.data?.score ?? 50;
    const allClosed = rings?.all_closed ?? false;
    const canClaimReward = allClosed && !rings?.reward_claimed;

    return {
        // Ring state
        rings,
        score,
        allClosed,
        canClaimReward,
        isLoading: todayQuery.isLoading,

        // History
        history: historyQuery.data?.history ?? [],

        // Reward
        claimReward: claimRewardMutation.mutateAsync,
        isClaiming: claimRewardMutation.isPending,

        // Refresh
        refetch: todayQuery.refetch,
    };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/hooks/useRings.ts
git commit -m "feat(frontend): add useRings hook for ring state and rewards"
```

---

## Task 11: Frontend — ProductivityRings Component

**Files:**
- Create: `frontend/components/profile/ProductivityRings.tsx`

- [ ] **Step 1: Create the ring visualization component**

This component renders three separate rings in a row with the Productivity Score above them. Uses the expand/collapse pattern from DashboardStats (LayoutAnimation for smooth transitions, tap to expand ring detail).

```typescript
// frontend/components/profile/ProductivityRings.tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Check } from 'phosphor-react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRings } from '@/hooks/useRings';
import Colors from '@/constants/Colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RING_SIZE = 80;
const STROKE_WIDTH = 6;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type RingName = 'plan' | 'do' | 'share';

const RING_GUIDANCE: Record<RingName, string> = {
    plan: 'Create or schedule tasks to close this ring',
    do: 'Complete tasks to close this ring',
    share: 'Post an update or send kudos to close this ring',
};

const RING_LABELS: Record<RingName, string> = {
    plan: 'Plan',
    do: 'Do',
    share: 'Share',
};

interface ProductivityRingsProps {
    userId?: string;
    compact?: boolean;
}

export function ProductivityRings({ userId, compact = false }: ProductivityRingsProps) {
    const { rings, score, isLoading } = useRings();
    const [expandedRing, setExpandedRing] = useState<RingName | null>(null);
    const primaryColor = Colors.dark.primary;
    const trackColor = useThemeColor({}, 'inputBackground');
    const textColor = useThemeColor({}, 'text');
    const captionColor = useThemeColor({}, 'caption');

    const handlePress = useCallback((ring: RingName) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedRing(prev => prev === ring ? null : ring);
    }, []);

    if (isLoading || !rings) {
        return (
            <View style={styles.container}>
                <ThemedText type="caption">Loading...</ThemedText>
            </View>
        );
    }

    const ringData: { name: RingName; current: number; target: number; closed: boolean }[] = [
        { name: 'plan', ...rings.plan },
        { name: 'do', ...rings.do },
        { name: 'share', ...rings.share },
    ];

    const displayScore = score >= 30 ? score.toString() : '--';

    return (
        <View style={styles.container}>
            {/* Productivity Score */}
            <View style={styles.scoreContainer}>
                <ThemedText style={[styles.scoreNumber, { color: textColor }]}>
                    {displayScore}
                </ThemedText>
                <ThemedText style={[styles.scoreLabel, { color: captionColor }]}>
                    Productivity Score
                </ThemedText>
            </View>

            {/* Three Rings */}
            <View style={styles.ringsRow}>
                {ringData.map((ring) => {
                    const progress = Math.min(ring.current / ring.target, 1);
                    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

                    return (
                        <Pressable
                            key={ring.name}
                            onPress={() => handlePress(ring.name)}
                            style={styles.ringItem}
                        >
                            <View style={styles.ringCircle}>
                                <Svg width={RING_SIZE} height={RING_SIZE}>
                                    {/* Track */}
                                    <Circle
                                        cx={RING_SIZE / 2}
                                        cy={RING_SIZE / 2}
                                        r={RADIUS}
                                        stroke={trackColor}
                                        strokeWidth={STROKE_WIDTH}
                                        fill="none"
                                    />
                                    {/* Progress */}
                                    <Circle
                                        cx={RING_SIZE / 2}
                                        cy={RING_SIZE / 2}
                                        r={RADIUS}
                                        stroke={primaryColor}
                                        strokeWidth={STROKE_WIDTH}
                                        fill="none"
                                        strokeDasharray={`${CIRCUMFERENCE}`}
                                        strokeDashoffset={strokeDashoffset}
                                        strokeLinecap="round"
                                        rotation="-90"
                                        origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                                    />
                                </Svg>
                                {/* Center text */}
                                <View style={styles.ringCenter}>
                                    {ring.closed ? (
                                        <Check size={20} color={primaryColor} weight="bold" />
                                    ) : (
                                        <ThemedText style={[styles.ringCount, { color: textColor }]}>
                                            {ring.current}/{ring.target}
                                        </ThemedText>
                                    )}
                                </View>
                            </View>
                            <ThemedText style={[styles.ringLabel, { color: captionColor }]}>
                                {RING_LABELS[ring.name]}
                            </ThemedText>
                        </Pressable>
                    );
                })}
            </View>

            {/* Expanded Ring Detail */}
            {expandedRing && (
                <View style={[styles.expandedDetail, { borderColor: primaryColor + '30' }]}>
                    {(() => {
                        const ring = ringData.find(r => r.name === expandedRing)!;
                        if (ring.closed) {
                            return (
                                <ThemedText style={[styles.detailText, { color: primaryColor }]}>
                                    Closed!
                                </ThemedText>
                            );
                        }
                        const remaining = ring.target - ring.current;
                        return (
                            <>
                                <ThemedText style={[styles.detailProgress, { color: textColor }]}>
                                    {ring.current} of {ring.target}
                                </ThemedText>
                                <ThemedText style={[styles.detailText, { color: captionColor }]}>
                                    {RING_GUIDANCE[expandedRing]}
                                </ThemedText>
                            </>
                        );
                    })()}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    scoreContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    scoreNumber: {
        fontFamily: 'Fraunces',
        fontSize: 36,
        fontWeight: '600',
    },
    scoreLabel: {
        fontFamily: 'Outfit',
        fontSize: 12,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 2,
    },
    ringsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
    },
    ringItem: {
        alignItems: 'center',
        gap: 6,
    },
    ringCircle: {
        width: RING_SIZE,
        height: RING_SIZE,
        position: 'relative',
    },
    ringCenter: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ringCount: {
        fontFamily: 'Outfit',
        fontSize: 14,
        fontWeight: '600',
    },
    ringLabel: {
        fontFamily: 'Outfit',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    expandedDetail: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        gap: 4,
    },
    detailProgress: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
    },
    detailText: {
        fontFamily: 'Outfit',
        fontSize: 13,
        textAlign: 'center',
    },
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/profile/ProductivityRings.tsx
git commit -m "feat(frontend): add ProductivityRings component with three rings and score"
```

---

## Task 12: Frontend — Replace TodayStats With Rings on Profile

**Files:**
- Modify: `frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx` (line 112)

- [ ] **Step 1: Replace TodayStats import and usage**

In `profile.tsx`:

1. Remove the import of `TodayStats`:
```typescript
// Remove this line:
import { TodayStats } from '@/components/profile/TodayStats';
```

2. Add the import of `ProductivityRings`:
```typescript
import { ProductivityRings } from '@/components/profile/ProductivityRings';
```

3. Replace the usage at line 112:
```typescript
// Replace:
<TodayStats userId={user?._id} />

// With:
<ProductivityRings userId={user?._id} />
```

- [ ] **Step 2: Verify the profile renders correctly**

```bash
cd /Users/abhik.ray/Kindred && bun run dev-frontend
```

Navigate to the Profile tab and verify:
- Three rings display in a row (Plan, Do, Share)
- Score shows above the rings
- Tapping a ring expands detail with guidance text

- [ ] **Step 3: Commit**

```bash
git add frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx
git commit -m "feat(profile): replace TodayStats with ProductivityRings"
```

---

## Task 13: Frontend — Add Ring Widget to Dashboard

**Files:**
- Modify: `frontend/components/dashboard/HomescrollContent.tsx`

- [ ] **Step 1: Add compact rings to the dashboard**

In `HomescrollContent.tsx`, add the `ProductivityRings` component above or below the `DashboardStats` component (around line 317).

1. Add the import:
```typescript
import { ProductivityRings } from '@/components/profile/ProductivityRings';
```

2. Add the component near DashboardStats:
```typescript
{/* Productivity Rings */}
<View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 8 }}>
    <ProductivityRings compact />
</View>

{/* Existing DashboardStats */}
<View style={{ marginHorizontal: HORIZONTAL_PADDING }}>
    <DashboardStats onExpandChange={handleStatsExpandChange} />
</View>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/HomescrollContent.tsx
git commit -m "feat(dashboard): add productivity rings widget to home screen"
```

---

## Task 14: Frontend — Reward Celebration Toast

**Files:**
- Modify: `frontend/hooks/useRings.ts`

- [ ] **Step 1: Add reward auto-claim and toast**

Update the `useRings` hook to automatically detect when all rings just closed and show a celebration toast. Use the existing `showToast` utility.

In `useRings.ts`, add an effect that watches for `allClosed && canClaimReward`:

```typescript
import { useEffect, useRef } from 'react';
import { showToast } from '@/utils/toast';

// Inside useRings():
const hasAutoClaimedRef = useRef(false);

useEffect(() => {
    if (canClaimReward && !hasAutoClaimedRef.current && !claimRewardMutation.isPending) {
        hasAutoClaimedRef.current = true;
        claimRewardMutation.mutateAsync().then((result) => {
            if (result.claimed) {
                const creditName = result.credit_type === 'naturalLanguage'
                    ? 'Natural Language'
                    : result.credit_type!.charAt(0).toUpperCase() + result.credit_type!.slice(1);
                showToast(
                    `All rings closed! +${result.amount} ${creditName} Credit${result.amount! > 1 ? 's' : ''}`,
                    'success'
                );
            }
        });
    }
    // Reset when rings data refreshes for a new day
    if (!canClaimReward) {
        hasAutoClaimedRef.current = false;
    }
}, [canClaimReward]);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/hooks/useRings.ts
git commit -m "feat(frontend): auto-claim reward and show toast when all rings close"
```

---

## Task 15: Frontend — Clean Up Points References

**Files:**
- Modify: `frontend/api/types.ts` — Mark `points` as deprecated/optional
- Modify: `frontend/components/profile/TodayStats.tsx` — Can be deleted or left (no longer imported)

- [ ] **Step 1: Make `points` optional in frontend types**

In `frontend/api/types.ts`, wherever the User type references `points`, make it optional:
```typescript
points?: number; // deprecated — replaced by productivity_score
```

Add the new field:
```typescript
productivity_score?: number;
```

- [ ] **Step 2: Search for any other `points` references in the frontend**

```bash
cd /Users/abhik.ray/Kindred/frontend && grep -r "\.points" --include="*.ts" --include="*.tsx" -l
```

For each file found, evaluate whether the reference needs updating:
- Profile displays → already replaced by ProductivityRings
- API types → already updated
- Any analytics/tracking → can keep reading from API response if still present

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "chore(frontend): deprecate points field, add productivity_score to types"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run backend tests**

```bash
cd /Users/abhik.ray/Kindred && make test-backend
```

Expected: All tests pass, including new ring tests.

- [ ] **Step 2: Run frontend dev server**

```bash
cd /Users/abhik.ray/Kindred && bun run dev-frontend
```

Verify:
- Profile shows three rings + score (not the old 4-stat grid)
- Dashboard shows the ring widget
- Tapping rings expands detail with guidance
- Score shows a number (>= 50 for existing users)
- Points no longer visible anywhere

- [ ] **Step 3: Build check**

```bash
cd /Users/abhik.ray/Kindred/backend && go build ./...
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: productivity score and rings system complete"
```
