# Push Notification Audit

Tracks: [KIN-291](https://linear.app/kindredtdl/issue/KIN-291)

Goal: confirm every push notification the backend sends has a working frontend deep-link route.

## How routing works

**Backend** (`backend/xutils/notifications.go`) sends pushes via the Expo Push API. Every push carries a `data` map; convention is to include a `type` field, and optionally a `url` field for fully-qualified deep-links.

**Frontend** (`frontend/app/(logged-in)/_layout.tsx:82`) resolves a notification to a route via `getNotificationRoute(data)`:

1. If `data.url` is set, navigate to it directly (override path).
2. Else, switch on `data.type` and map to a route.
3. Default returns `null` — **silent navigation failure**.

Tap handler at line 320; foreground listener at 287. `live_activity` has special handling at 291–335 (skips the generic route resolver).

## Audit matrix

Legend:
- ✅ — handled, payload fully used
- ⚠️ — handled, but payload data ignored (suboptimal — lands on a list/tab instead of the specific entity)
- ❌ — not handled (would silently fail)

| # | Type | Trigger | Backend payload | Frontend route | Status |
|---|---|---|---|---|---|
| 1 | `friend_request` | Friend request sent | `requester_name`, `requester_id` | `/(activity)` | ⚠️ `requester_id` not used |
| 2 | `friend_request_accepted` | Friend request accepted | `accepter_name`, `accepter_id` | `/account/{accepter_id}` (fallback to activity) | ✅ |
| 3 | `encouragement` (profile) | Encouragement sent on profile | `sender_name`, `message_text`, `imageUrl?` | `/kudos?tab=encouragements` | ✅ |
| 4 | `encouragement` (task) | Encouragement sent on task | `sender_name`, `message_text`, `task_name`, `imageUrl?` | `/kudos?tab=encouragements` | ⚠️ no `task_id` sent — can't deep-link to task |
| 5 | `task_completion` | Task owner completed a task encourager backed | `task_owner_id`, `task_owner`, `task_name`, `task_id` | `/kudos?tab=congratulations` | ⚠️ `task_id` sent but ignored |
| 6 | `comment` | Comment on user's post | `commenter_name`, `comment_text` | `/(feed)/feed` | ⚠️ no `post_id` sent — can't deep-link to post |
| 7 | `new_post` | Friend created a post (~30% chance) | `post_id`, `poster_name`, `poster_id` | `/(feed)/feed` | ⚠️ `post_id` sent but ignored |
| 8 | `live_activity` (activeTask) | Task start time hit (2-min window) | `liveActivityType`, `taskId`, `categoryId`, `taskName`, `workspaceName`, `startTime`, `endTime` | `/(task)/task/{taskId}?categoryId=...&name=...` | ✅ |
| 9 | `live_activity` (deadlineCountdown) | Task deadline ≈1h away | `liveActivityType`, `taskId`, `categoryId`, `taskName`, `workspaceName`, `deadline`, `priority` | `/(task)/task/{taskId}?categoryId=...&name=...` | ✅ |
| 10 | `congratulation` | Congratulation sent on task | `sender_name`, `task_name`, `message_text`, `imageUrl?` | `/kudos?tab=congratulations` | ⚠️ no `task_id` / `post_id` sent |
| 11 | `congratulation` (onboarding beak) | Onboarding tutorial message | Same as 10 | `/kudos?tab=congratulations` | ✅ (intentional) |
| 12 | `checkin` | Daily check-in at user-local 17:01 | `time`, `timestamp`, `scheduled_today`, `deadline_today`, `open_tasks`, **`url`** = `/(task)/review` | Uses `data.url` override → `/(task)/review` | ✅ |
| 13 | `FOLLOW_UP` (reminder) | Task follow-up reminder | `taskId`, `type` | `/(task)` | ⚠️ `taskId` ignored — should open the task |
| 14 | `ABSOLUTE` (reminder) | Absolute-time task reminder | `taskId`, `type` | `/(task)` | ⚠️ `taskId` ignored |
| 15 | `RELATIVE` (reminder) | Relative-time task reminder | `taskId`, `type` | `/(task)` | ⚠️ `taskId` ignored |
| 16 | `TASK_MISSED` | Recurring task occurrence missed | `taskId`, `type`, **`url`** = `/(task)/undo-missed/{templateTaskId}` | Uses `data.url` override → specific undo screen | ✅ |
| 17 | `TASK_REGENERATED` | Recurring task rolled over | `taskId`, `type` | `/(task)` | ⚠️ `taskId` ignored — could open template task |
| 18 | `rings_closed` (user) | User closed all rings (delayed 2 min) | `type` only | `/profile` (fallback) | ✅ (no entity to link to) |
| 19 | `rings_closed` (friend) | Friend closed all rings | `type`, `user_id` | `/account/{user_id}` | ✅ |

## Summary

**No type is unhandled** — every push the backend sends results in *some* navigation. However:

- **8 of 19 pushes (~42%) under-use their payload** — they land on a tab or list when they could deep-link to the specific task/post/profile. Tapping a comment notification dumps you in the feed, not at your post; tapping a task reminder lands you on the task tab, not the task. This is the kind of "broken-feeling" UX the audit was designed to catch.
- **Silent failure mode**: `getNotificationRoute` returns `null` for unknown `type` values. Adding a new backend notification type without updating the frontend switch is invisible — no error, no log, no toast. **High risk for regressions.**
- **Two notification types use the `url` override** (`checkin`, `TASK_MISSED`). This pattern is the cleanest — backend owns the route, frontend just navigates. Worth considering as the default convention going forward, instead of relying on type→route switch staying in sync.

## Implementation (this PR)

Both audit-surfaced issues are now fixed for both push notifications **and** the in-app (DB) notification list.

### Backend — push payloads now carry the right IDs
- `comment` push — `post_id` added (`backend/internal/handlers/post/service.go` `sendCommentNotification`)
- `encouragement` push (task scope) — `task_id` added (`backend/internal/handlers/encouragement/service.go` `sendEncouragementNotification`)
- `congratulation` push — `post_id` added when the congratulation references a post (`backend/internal/handlers/congratulation/service.go` `sendCongratulationNotification`); Beak/onboarding congratulations correctly pass `nil` (no post)

### Backend — DB notifications now use entity IDs as `reference_id`
Previously the `reference_id` field for encouragement and congratulation DB notifications stored the encouragement/congratulation **document** ID, which had no working frontend route. Both now store the entity the user should land on when tapping:
- Encouragement DB notification (task scope) → `reference_id` = task ID; profile scope → zero (frontend falls back)
- Congratulation DB notification → `reference_id` = post ID when present; else zero

### Frontend — `getNotificationRoute` now uses payload IDs
`frontend/app/(logged-in)/_layout.tsx` `getNotificationRoute`:
- `encouragement` (task scope) → `/(task)/task/{task_id}`
- `congratulation` (post present) → `/posting/{post_id}`
- `task_completion` → `/(task)/task/{task_id}`
- `new_post` → `/posting/{post_id}`
- `comment` → `/posting/{post_id}`
- `FOLLOW_UP` / `ABSOLUTE` / `RELATIVE` / `TASK_REGENERATED` reminders → `/(task)/task/{taskId}`
- Each falls back to the previous list/tab destination when the ID is missing.

### Frontend — DB notification tap handlers deep-link too
- `frontend/app/(logged-in)/(tabs)/(feed)/Notifications.tsx` `handleNotificationPress` — encouragement now opens the task, congratulation now opens the post (matches push behavior).
- `frontend/components/UserInfo/UserInfoEncouragementNotification.tsx` — fixed a real bug: route was `/post/${id}` (a path that does not exist) — now correctly routes to `/posting/{id}` for congratulations and `/(task)/task/{id}` for encouragements.

### Frontend — unknown `data.type` no longer silently fails
`getNotificationRoute` returning `null` now `logger.warn`s with the type and full data payload. The user already saw the OS notification banner; this is an engineering signal so new backend notification types added without frontend wiring don't go invisible.

## Known gaps (out of scope for KIN-291)

- **POST and RINGS_CLOSED DB notifications don't render in the in-app notifications list.** `Notifications.tsx` `processNotification` casts type to a union missing those, and the render switch returns `null` for unhandled types. Backend creates these DB notifications but the user never sees them.
- **No analytics event** for unknown-type push notifications — only console warn. PostHog wiring is a small follow-up if we want production visibility.
