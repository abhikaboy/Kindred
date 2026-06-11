# End-of-Day Review Card — Design

**Date:** 2026-06-10
**Status:** Approved (brainstormed with Abhik)

## Problem

Kindred's feedback loop (rings, streak) only rewards work that goes through the app. Users
do things all day that were never logged, so their rings under-represent the day and the
loop weakens exactly when it should reward them. There are two miss cases:

1. **Forgot to check off** — the task existed, the user did it, never tapped complete.
2. **Never logged** — the work was real but no task was ever created.

## Solution

An **End-of-Day Review card** pinned to the top of the home feed from **20:00 to 23:59
local time**. Tapping it opens a bottom sheet where the user can, in one pass:

- check off today's still-open tasks (bulk complete), and
- quick-log untracked things they did (each becomes a created-and-completed task).

Dismissing the card or finishing the review hides it for the rest of the day; it returns
the next evening.

### Product decisions (settled)

| Decision | Choice |
| --- | --- |
| Card scope | Day review: check-off existing + quick-log new |
| Ring credit for quick-logged tasks | Both rings (Plan on create, Do on complete) — same as normal tasks |
| Category for quick-logged tasks | Auto find-or-create a **"Logged"** category in the active workspace |
| Future categorization | Gemini auto-tagging replaces "Logged" later, inside the log endpoint only |
| Trigger | Fixed 20:00–23:59, no setting |
| Dismissal | Per-day AsyncStorage key; reset at local midnight |
| Backdating `timeCompleted` | Out of scope — completions stamp "now" |

## Backend

### New operation: `POST /v1/user/tasks/log`

Lives in `backend/internal/handlers/task/` alongside `BulkCompleteTask`.

**Input body** (`LogTasksInputBody` — name must not collide with types in other handler
packages; verify with `make generate-api`):

```json
{
  "workspaceId": "<id>",
  "tasks": [{ "content": "gym" }, { "content": "called mom" }]
}
```

- `workspaceId` required (categories are workspace-scoped; server must know where the
  Logged category lives).
- `tasks`: 1–50 entries; `content` non-empty after trim.

**Behavior:**

1. Find a category named `Logged` in the given workspace owned by the user; create it if
   absent.
2. For each entry: create a task (defaults matching the app's quick-create form: priority
   1, value 1, `public` false, `active` true), then immediately complete it the same way
   `CompleteTask` does — `timeCompleted = now`, moved to the `CompletedTasks` collection.
3. Ring increments fire per task (Plan on create, Do on complete) using the same
   fire-and-forget goroutine pattern as `BulkCompleteTask`. No special-casing — "both
   rings" falls out of reusing the normal paths.
4. Streak updates as in `CompleteTask`/`BulkCompleteTask`.

**Output body** (`LogTasksOutputBody`):

```json
{
  "message": "...",
  "tasksLogged": 4,
  "currentStreak": 7,
  "failedIndices": [2]
}
```

Partial failure: validate everything up front (count, non-empty content); per-entry
runtime failures are collected into `failedIndices` and do not abort the batch.

## Frontend

### Visibility: `useEndOfDayCard` hook

`frontend/hooks/useEndOfDayCard.ts`

- `visible === true` when local hour ≥ 20 **and** AsyncStorage key
  `eod-dismissed-<YYYY-MM-DD>` (local date) is unset.
- `dismiss()` writes the key; used by both the card's ✕ and successful review completion.
- Card shows even when there are zero open tasks (quick-log is still valid).
- Recheck on app foreground/focus so the card appears if the app was open across 20:00.

### Card: `EndOfDayCard`

`frontend/components/cards/EndOfDayCard.tsx`

- Prepended as a new typed feed item in `feed.tsx`'s `renderFeedItem` (same pattern as
  `RingsClosedFeedCard`), pinned at top while visible.
- Compact, left-aligned: Fraunces heading ("How did today go?"), Outfit subtitle with
  open-task count, CTA button, dismiss ✕. Phosphor icons, ThemedText semantic types, no
  hardcoded fontFamily. No "streak" wording in copy.

### Sheet: `EndOfDayReviewSheet`

`frontend/components/modals/EndOfDayReviewSheet.tsx` (bottom sheet — not inline feed
expansion; text inputs inside FlashList cells fight keyboard avoidance and recycling).

- **Section A — "Did you finish these?"** Today's open tasks (due today + start today +
  overdue, via existing `useDailyTasks` filters) as multi-select check rows. Tasks come
  from all workspaces' categories (`workspaces.flatMap(ws => ws.categories)`), not just
  the selected workspace.
- **Section B — "Anything else you got done?"** Text input; submit adds a row to a local
  pending list; rows are removable.
- **Footer — "Log my day"** (disabled when nothing selected and no entries):
  1. `bulkCompleteTasksAPI(items)` → existing `POST /v1/user/tasks/bulk/complete` for
     checked tasks.
  2. `logTasksAPI(workspaceId, entries)` → new `POST /v1/user/tasks/log` for typed
     entries.
  3. **Not optimistic**: await both, then `removeFromCategory` for each confirmed
     completion, invalidate `["rings", "today"]`, refetch workspaces (so the new Logged
     category appears), show the existing completion toast, `dismiss()` the card, close
     the sheet.

### API wrappers

`frontend/api/task.ts`: add `bulkCompleteTasksAPI` (if not already exposed) and
`logTasksAPI`, typed from regenerated OpenAPI types (`bun run generate-types` after
backend `make generate-api`).

## Errors & edge cases

- **Partial failure**: toast "N logged, M failed"; failed quick-log entries remain in the
  sheet for retry; only server-confirmed completions are removed from local state.
- **Both calls fail**: standard error toast; sheet stays open; card not dismissed.
- **Empty state**: zero open tasks → Section A hidden, sheet is quick-log only.
- **Time**: all checks use device-local time; dismissal key uses local date, so the card
  naturally returns the next evening. Window ends at midnight by construction (hour ≥ 20
  on the new date is false until that evening).

## Testing

- **Backend** (`task` handler tests): Logged category created once and reused on second
  call; tasks end up in `CompletedTasks` with `timeCompleted` set; validation rejects
  empty content / >50 entries; output shape. Run `make generate-api` to catch Huma
  duplicate-type-name panics.
- **Frontend** (jest): `useEndOfDayCard` — hidden before 20:00, visible after, dismissal
  persists for the day and resets on date change (mock Date + AsyncStorage). Sheet submit
  logic with mocked APIs: bulk-complete + log called with right payloads; failed entries
  retained. Mock `react-native-worklets` and `react-native-reanimated` if the sheet pulls
  them in.
- Pre-existing failing suites on main (AboutScreen, dragHitTest, KudosItem,
  UserInfoEncouragementNotification) are the baseline and out of scope.

## Out of scope (v1)

- Backdating completion times.
- Configurable trigger hour.
- Gemini auto-categorization (future change inside the log endpoint only).
- Recap-post sharing / day-review screen (possible v2 if the card earns usage).
