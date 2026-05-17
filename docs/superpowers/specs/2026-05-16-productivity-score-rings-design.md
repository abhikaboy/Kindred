# Productivity Score & Rings

## Overview

Replace the current points/streak-based gamification with a **Productivity Score** (0-100) powered by three daily **rings** — Plan, Do, Share. Streaks become an invisible input to the score formula. Closing all three rings in a day triggers a variable reward (random AI credit drop).

## What Gets Removed

### Points
- Remove `points` field from User document and all API responses
- Remove points earning logic in post creation (`post/service.go` lines 243-268)
- Remove points display from `TodayStats.tsx` (lines 95-100)

### Visible Streak
- Keep `streak` and `streakEligible` fields in the database (they feed the score formula)
- Keep streak increment logic on task completion (`task_service.go` lines 439-445)
- Remove streak display from `TodayStats.tsx` (lines 77-82)
- Remove streak from profile API responses sent to other users

### 4-Stat Grid
- Replace the `TodayStats` component entirely with the new ring visualization
- The 4-stat grid (streak, tasks complete, posts made, points) is removed from profile

## Rings

### Three Rings

| Ring | Color | What it tracks | How it closes |
|------|-------|---------------|---------------|
| **Plan** | `#854DFF` (purple) | Tasks created or scheduled | Create a new task (any date) or set/update a future start date or deadline on an existing task. Each distinct task counts once per day toward the Plan ring regardless of how many times it's edited. |
| **Do** | `#854DFF` (purple) | Tasks completed | Complete N tasks in a day |
| **Share** | `#854DFF` (purple) | Social actions | Post or send a kudos (encouragement or congratulation) |

### Daily Targets (v1 — fixed)

Start with fixed targets. Adaptive targets are a future iteration.

| Ring | Target to close |
|------|----------------|
| Plan | 2 tasks created or scheduled |
| Do | 3 tasks completed |
| Share | 1 social action (post or kudos) |

These are configurable server-side so they can be tuned without a client release.

### Ring State

Each ring has a `current` count and a `target`. The ring fills proportionally: `current / target`. At `current >= target`, the ring is closed.

Ring state resets daily at midnight in the user's local timezone.

### Ring Detail (tap interaction)

Tapping a ring expands it inline — reusing the same expand/collapse pattern from `DashboardStats.tsx` (the Open/Due Today/Done This Week stats that expand to show task lists).

Each expanded ring shows:
- Current progress: "2 of 3 completed"
- A sentence explaining how to close it:
  - **Plan**: "Create or schedule 2 tasks to close this ring"
  - **Do**: "Complete 3 tasks to close this ring"
  - **Share**: "Post an update or send kudos to close this ring"
- If closed: a checkmark and "Closed!" with the ring's accent color

## Productivity Score

### Formula

The score starts at 50 and builds over a **rolling 7-day window**:

```
base = 50
ring_bonus = (rings_closed_last_7_days / 21) * 50    // 0 to +50
streak_bonus = min(current_streak, 7)                  // 0 to +7

productivity_score = min(base + ring_bonus + streak_bonus, 100)
```

Example progression:

| Day | Rings closed (total last 7d) | Score |
|-----|------------------------------|-------|
| New user | 0 | 50 |
| Day 1 (close all 3) | 3 | 58 |
| Day 2 (close all 3) | 6 | 66 |
| Day 3 (close all 3) | 9 | 74 |
| Day 5 (close all 3) | 15 | 88 |
| Day 7 (close all 3) | 21 | 100 |
| Miss a day after 7 | 18 | 90 |

The floor is always 50 — a new or inactive user sits at 50, never 0.

### Display Rules

- Score **>= 30**: show the number
- Score **< 30**: show `--` (practically unreachable since floor is 50, but handles edge cases)
- The score updates in real-time as rings close throughout the day
- Visible from day 1 — a new user sees "50" immediately

### Where it appears

- **Profile**: centered inside the three concentric rings
- **Home dashboard**: compact ring widget (replaces or supplements DashboardStats)

## Profile Ring Visualization

Three separate rings displayed in a row on the user's profile, replacing the 4-stat grid. The Productivity Score sits above or below the rings as a standalone number.

```
              85
       Productivity Score

    ╭───╮     ╭───╮     ╭───╮
    │   │     │   │     │   │
    │ 2 │     │ 1 │     │ 0 │
    │/2 │     │/3 │     │/1 │
    ╰───╯     ╰───╯     ╰───╯
    Plan       Do       Share
```

- Each ring is its own circle, filled proportionally (current/target)
- All three rings use the primary purple (`#854DFF`); unfilled portion is a faint purple track
- The current/target count is displayed inside each ring
- Ring label sits below each circle
- Tapping a ring expands it inline (same pattern as DashboardStats) showing progress and a guidance sentence
- Rings animate as they fill
- For other users' profiles: shows their score and ring state (read-only, no tap detail)

## Variable Reward: AI Credit Drops

### Trigger

All three rings close in a single day.

### Reward

A random AI credit drop from the following pool:

| Drop | Weight | Amount |
|------|--------|--------|
| Voice credit | 40% | +1 |
| Natural Language credit | 40% | +1 |
| Analytics credit | 15% | +1 |
| Voice credits (bonus) | 5% | +2 |

### UX

- When the third ring closes, a brief celebration animation plays
- Toast notification: "All rings closed! You earned +1 Voice Credit"
- The reward is applied immediately to the user's credit balance
- One reward per day maximum (closing rings multiple times in a day — e.g., exceeding targets — does not grant additional rewards)

### Backend

- Track `lastRewardDate` on user document to prevent duplicate daily rewards
- Reward selection is server-side (client sends "all rings closed" event, server picks the reward and returns it)
- This prevents client-side manipulation of reward odds

## Notifications

### Ring Reminder Notifications

Add ring-specific push notifications to encourage ring closure.

**Generic reminders** (sent based on check-in frequency setting):
- "You're 1 task away from closing your Do ring today"
- "Your Plan and Share rings are still open — there's still time!"
- "You haven't closed any rings today. Start with one task to get going."

**Ring-specific targeted notifications:**
- **Plan ring open** (afternoon): "Got anything on your mind for tomorrow? Plan 2 tasks to close your Plan ring."
- **Do ring open** (afternoon/evening): "You have {N} tasks due today. Complete 3 to close your Do ring."
- **Share ring open**: "Someone in your circle could use a boost. Send kudos to close your Share ring."

**All rings closed notification:**
- Sent immediately when all three rings close
- "You closed all your rings today! +1 {credit_type} Credit"
- This is the reward notification — combines the celebration with the credit drop

### Notification Settings

Reuse the existing check-in frequency setting (`None / Occasionally / Regularly / Frequently`) to control ring reminder frequency:
- **None**: no ring reminders
- **Occasionally**: max 1 ring reminder per day (evening only, if rings still open)
- **Regularly**: up to 2 reminders (afternoon + evening)
- **Frequently**: up to 3 reminders (morning check-in + afternoon + evening)

The "all rings closed" notification always fires regardless of frequency setting (it's a reward, not a nag).

## Data Model Changes

### New: Ring State (daily, ephemeral)

Could be stored in the existing `activity` collection or a new `ring_state` collection:

```
RingState {
  user_id: ObjectID
  date: string (YYYY-MM-DD)
  plan: { current: int, target: int, closed: bool }
  do: { current: int, target: int, closed: bool }
  share: { current: int, target: int, closed: bool }
  all_closed: bool
  reward_claimed: bool
  reward_type: string (nullable)
  reward_amount: int (nullable)
}
```

### Modified: User Document

```
// Remove:
points: int

// Add:
productivity_score: int (cached, recalculated on ring state changes)
last_reward_date: date (nullable, for daily reward cap)
```

### Unchanged
- `streak`, `streakEligible` — kept, still incremented, now hidden
- `credits` — unchanged, receives reward drops
- `kudosRewards` — unchanged
- `activity` — unchanged (still tracks daily completion counts)

## API Changes

### New Endpoints

```
GET  /v1/user/rings/today     — Get today's ring state
GET  /v1/user/rings/history   — Get ring states for date range (for score calculation on client, or score trend display)
POST /v1/user/rings/reward    — Claim daily reward (called when all rings close)
```

### Modified Endpoints

Ring state is updated as a side effect of existing actions — no explicit "update ring" endpoint needed:

- **Task creation** (`POST /v1/user/tasks/{category}`) → increments Plan ring
- **Task scheduling** (deadline/start date updates) → increments Plan ring (if scheduling for future)
- **Task completion** (`POST /v1/user/tasks/complete/{category}/{id}`) → increments Do ring
- **Post creation** (`POST /v1/user/posts/`) → increments Share ring
- **Kudos sent** (`POST /v1/encouragements/`, `POST /v1/congratulations/`) → increments Share ring

### Profile Response

- Remove `points` from profile API response
- Add `productivity_score` (int, or null if < 70)
- Add `rings` object with today's state (for own profile) or just the score (for other users)

## Migration

1. Stop writing to `points` field
2. Add `productivity_score` and `last_reward_date` fields to user documents
3. Create `ring_state` collection with TTL index (auto-delete after 30 days — only need 14 for score calculation, 30 for buffer)
4. Deploy backend changes (ring state tracking as side effects)
5. Deploy frontend changes (new ring visualization, remove stats grid)
6. `points` field can be dropped from the schema in a later cleanup

## Out of Scope (Future)

- Adaptive daily targets based on user's rolling average
- Weekly/monthly ring summaries
- Social ring comparisons (see friends' ring states)
- Collectible stamps/badges layer on top of rings
- Ring-specific analytics ("you close your Plan ring 80% of days but Share only 30%")
