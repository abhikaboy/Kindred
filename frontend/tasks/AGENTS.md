# tasks — Agent Guide

Background scheduling of local notifications that drive Live Activities when the app is backgrounded.

## Key files
- `backgroundTaskSync.ts` — exports `useBackgroundTaskSync()` (hook) and `registerBackgroundFetch()` (currently no-op). Schedules local notifications at each task `startTime` and 1hr before each `deadline`, over a rolling 24h window.

## Conventions
- Notification payloads use the **same** `type: 'live_activity'` shape as backend push, so the `(logged-in)/_layout.tsx` handler treats local and remote identically (one code path).
- Notification IDs are prefixed (`live-activity-start-`, `live-activity-deadline-`) so stale ones can be found and cancelled before rescheduling.
- Schedule calls are debounced via a ref; only active, non-completed tasks in the window are scheduled.

## Gotchas
- `useBackgroundTaskSync` must be called inside the component tree (it uses effects).
- Times are exact wall-clock — no fuzzy/repeat scheduling.
- `(task as any).timeCompleted` is a type escape hatch (schema/migration debt).
