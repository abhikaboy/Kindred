# Background Live Activity Triggers

**Date:** 2026-05-23
**Status:** Approved

## Problem

Live activities only trigger when the user taps "Start Working" or "Track Deadline" in the task detail screen. The backend sends push notifications at task start times and deadline approach, but:

- `addNotificationReceivedListener` only fires when the app is **in the foreground**
- `addNotificationResponseReceivedListener` only fires when the user **taps** the notification
- If the app is backgrounded and the user doesn't tap, the live activity never starts

## Solution: Hybrid foreground timer + background fetch

Three trigger layers, all funneled through a single deduplication manager:

1. **Foreground timer** — 30-second interval checks tasks in memory
2. **Background fetch** — iOS-scheduled periodic wake reads tasks from AsyncStorage
3. **Push notifications** — existing backend cron (kept as-is, third layer)

### Deduplication

All three paths call the same `tryStartActiveTaskActivity()` / `tryStartDeadlineActivity()` functions from `liveActivityManager.ts`. The manager maintains a `Set<string>` of active task IDs and short-circuits if an activity is already running. On init, it hydrates the Set from `getInstances()` on both live activity factories to detect activities surviving app restarts.

## Architecture

### New files

```
frontend/
  utils/liveActivityManager.ts       — dedup layer, single entry point for starting/ending activities
  hooks/useLiveActivityScheduler.ts  — foreground timer hook
  tasks/backgroundTaskSync.ts        — AsyncStorage sync + background fetch task registration
```

### No changes to

- Backend (cron, push notifications)
- Widget definitions (ActiveTaskActivity.tsx, DeadlineCountdownActivity.tsx)
- widgetUpdaters.ts (factories remain unchanged)

## Module: `liveActivityManager.ts`

Owns all live activity lifecycle. Single source of truth for what's running.

### State

- `activeActivities: Map<string, { instance, intervalId }>` — tracks running activities by taskId
- Persisted to AsyncStorage key `@kindred/active-live-activities` as a `string[]` of taskIds on every start/end so the set survives app restarts
- On init, reads the persisted set and cross-checks against `getInstances().length > 0` from both factories — if factories report no running instances, the persisted set is cleared (activity expired or was dismissed by iOS)

### Exports

```typescript
tryStartActiveTaskActivity(taskId: string, props: ActiveTaskActivityProps): boolean
tryStartDeadlineActivity(taskId: string, props: DeadlineCountdownProps): boolean
endActivity(taskId: string): void
isActivityRunning(taskId: string): boolean
```

### `tryStartActiveTaskActivity(taskId, props)`

1. If `activeActivities.has(taskId)` → return `false`
2. Call `ActiveTaskActivityFactory.start(props)`
3. Set up 5-minute keep-alive interval (`activity.update(props)`)
4. Store `{ instance, intervalId }` in map
5. Return `true`

### `tryStartDeadlineActivity(taskId, props)`

1. If `activeActivities.has(taskId)` → return `false`
2. Call `DeadlineCountdownActivityFactory.start(props)`
3. Set up 1-minute color escalation interval (purple → orange at ≤10min → gray when overdue)
4. Auto-dismiss 30 min after overdue: call `endActivity(taskId)`
5. Store in map, return `true`

### `endActivity(taskId)`

1. Clear interval
2. Call `activity.end('default')`
3. Delete from map

## Module: `useLiveActivityScheduler.ts`

React hook used in `_layout.tsx`. Reads tasks from context and starts activities when times match.

### Logic

```
every 30 seconds:
  for each task in allTasks:
    if task.startTime exists
       AND startTime is in [now - 5min, now]
       AND task is active
       AND task has no timeCompleted:
      → tryStartActiveTaskActivity(task.id, buildActiveTaskProps(task))

    if task.deadline exists
       AND deadline is in [now + 30min, now + 65min]
       AND task is active
       AND task has no timeCompleted:
      → tryStartDeadlineActivity(task.id, buildDeadlineProps(task))
```

The 5-minute lookback for startTime ensures we catch it even if the tick lands slightly after. The 30-65 minute window for deadlines catches the ~1hr mark within one or two ticks. The dedup manager prevents re-triggering on subsequent ticks.

### Helper: `buildActiveTaskProps(task)`

Maps a Task object to `ActiveTaskActivityProps`:

```typescript
{
  taskName: task.content,
  workspaceName: task.workspaceName || 'Tasks',
  startTime: task.startTime || new Date().toISOString(),
  endTime: task.deadline || undefined,
  hasEndTime: !!task.deadline,
  categoryId: task.categoryID || '',
  taskId: task.id,
}
```

### Helper: `buildDeadlineProps(task)`

Maps a Task object to `DeadlineCountdownProps`:

```typescript
{
  taskName: task.content,
  workspaceName: task.workspaceName || 'Tasks',
  deadline: task.deadline!,
  priority: task.priority,
  categoryId: task.categoryID || '',
  taskId: task.id,
  accentColor: '#8B5CF6',
  statusLabel: 'Due Soon',
}
```

## Module: `backgroundTaskSync.ts`

Handles AsyncStorage persistence and background fetch registration.

### New dependencies

- `expo-task-manager`
- `expo-background-fetch`

### AsyncStorage sync

Key: `@kindred/upcoming-task-times`

Value: JSON array of lightweight task records:

```typescript
{ taskId, categoryId, content, workspaceName, startTime?, deadline?, priority, active }
```

Only tasks with a `startTime` or `deadline` in the next 24 hours are included. Synced from `allTasks` in the tasks context via a debounced write (500ms) triggered by a `useEffect` on `allTasks` changes. Exposed as a `useBackgroundTaskSync(allTasks)` hook.

### Background fetch task

Registered at app startup via `TaskManager.defineTask()`. Runs when iOS wakes the app (typically every 15-30 min).

On each invocation:

1. Read task records from AsyncStorage
2. Run the same startTime / deadline window checks
3. Call `tryStartActiveTaskActivity` / `tryStartDeadlineActivity`
4. Return `BackgroundFetch.BackgroundFetchResult.NewData` if any activity was started, `.NoData` otherwise

### Registration

Called once in `_layout.tsx` on mount:

```typescript
BackgroundFetch.registerTaskAsync(TASK_NAME, {
  minimumInterval: 15 * 60, // 15 minutes
  stopOnTerminate: false,
  startOnBoot: false,
});
```

## Changes to `_layout.tsx`

### Push notification handler

Replace the inline activity start logic (lines 261-326) with calls to the manager:

```typescript
// Before:
const activity = ActiveTaskActivityFactory.start(activityProps);
const intervalId = setInterval(() => { activity.update(activityProps); }, 5 * 60 * 1000);
liveActivityIntervalsRef.current.push(intervalId);

// After:
tryStartActiveTaskActivity(data.taskId, activityProps);
```

Same for deadline activities. Remove `liveActivityIntervalsRef` entirely — the manager owns interval lifecycle.

### Add hooks

```typescript
useLiveActivityScheduler();           // foreground timer
useBackgroundTaskSync(allTasks);      // AsyncStorage sync
```

## Changes to `task/[id].tsx`

Replace the inline `ActiveTaskActivityFactory.start()` / `DeadlineCountdownActivityFactory.start()` calls in `handleStartWorking()` and `handleTrackDeadline()` with `tryStartActiveTaskActivity()` / `tryStartDeadlineActivity()` from the manager. Remove the local interval management.

## Deduplication guarantees

| Scenario | What prevents double activity |
|---|---|
| Foreground timer fires, then push arrives | Manager's `activeActivities` map — second call returns false |
| Background fetch fires, then push arrives | Same map check |
| User taps "Start Working" after auto-start | Same map check |
| App restart with existing live activity | Persisted taskId set + `getInstances()` cross-check on init |
| Multiple foreground timer ticks | Same map check on every tick |

## Testing

- Verify live activity starts automatically when a task's startTime passes while app is foregrounded
- Verify live activity starts when deadline is ~1hr away while app is foregrounded
- Verify no duplicate activities when push arrives after auto-start
- Verify "Start Working" button still works and doesn't create duplicates
- Verify background fetch triggers activity when app was suspended
- Verify intervals are cleaned up on activity end
- Verify AsyncStorage is written with correct data on task changes
