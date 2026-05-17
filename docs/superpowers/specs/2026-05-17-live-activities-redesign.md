# Live Activities Redesign

## Summary

Replace the current encouragement-triggered live activity with two rich, purpose-built live activities:

1. **Active Task Activity** — Starts when a task begins (auto via push or manual "Start Working"). Shows elapsed timer, progress toward end time, and CTAs to complete or dismiss.
2. **Deadline Countdown Activity** — Auto-starts 1 hour before a task's deadline. Shows depleting countdown ring with gentle color escalation. CTAs to complete or open task.

The encouragement live activity is removed. Encouragements continue as push notifications only.

## Design Direction

**Visual style: Option B — Circular Progress (minimal, clean)**
- Left-aligned task info (name, workspace, status)
- Circular gauge on the right showing progress/countdown
- Green dot "Active" indicator (active task) or purple/amber dot (deadline)
- Thin progress bar below content (only when end time exists)
- Complete + Dismiss CTAs at the bottom of the banner

## Active Task Activity

### Props

```typescript
type ActiveTaskActivityProps = {
  taskName: string;
  workspaceName: string;
  startTime: string;       // ISO — when the task started
  endTime?: string;        // ISO — estimated end (deadline or startTime + duration)
  hasEndTime: boolean;     // Controls whether gauge/progress bar render
  categoryId: string;      // For deep link routing
  taskId: string;          // For deep link routing
};
```

### Layout Slots

**Banner (lock screen / notification center):**
- Top-left: green dot + "ACTIVE" label
- Below: task name (semibold, 17pt) + workspace name (caption, 13pt)
- Top-right: circular gauge with elapsed time center (only if `hasEndTime`), or plain elapsed timer text (if no end time)
- Middle: thin progress bar showing elapsed/total (only if `hasEndTime`)
- Bottom: "✓ Complete" button (filled purple) + "Dismiss" button (subtle)
- Deep link URL: `kindred://task/{categoryId}/{taskId}` on the whole banner

**Compact leading:** green dot + task name (truncated)
**Compact trailing:** elapsed time in purple (e.g., "1:24")
**Minimal:** small circular progress ring with lightning bolt icon center
**Expanded leading:** green dot + "Active" label
**Expanded trailing:** circular gauge with elapsed time
**Expanded bottom:** task name, workspace, "Xm remaining" (if end time), progress bar, Complete + Dismiss CTAs

### Timer Behavior

- The `Text` component with `dateStyle="timer"` auto-updates — no manual interval needed for the live display
- For the circular gauge progress, use `ProgressView` with `timerInterval` (auto-depleting)
- When no end time: show `Text date={startTime} dateStyle="timer"` counting up, no gauge or progress bar

### Triggering

**Auto-start (push notification):**
- Backend sends a push notification at the task's `startTime`
- The push payload includes task metadata needed for the activity props
- Frontend notification handler starts the live activity upon receiving the push
- Only triggers for tasks that have a `startTime` set for today

**Manual start:**
- "Start Working" button on the task detail screen (`task/[id].tsx`)
- Replaces the current timer start logic — starting the timer also starts the live activity
- The live activity instance is stored in component state (same pattern as current `deadlineLiveActivity`)

**Auto-end:**
- When `endTime` is reached, the activity updates to show "Time's up!" and auto-dismisses after 60 seconds
- Completing the task via the CTA deep link immediately ends the activity
- Dismissing via CTA ends it immediately

### Deep Link Handling

- Banner tap: opens `kindred://task/{categoryId}/{taskId}` (task detail page)
- "Complete" button: opens `kindred://task/{categoryId}/{taskId}/complete` (triggers completion flow)
- "Dismiss" button: ends the live activity without navigation

**Note:** expo-widgets only supports one `widgetURL` per view hierarchy — so the entire banner links to the task detail. The CTA buttons use `Button` with `target` identifiers that the app handles via `onWidgetEvent`.

## Deadline Countdown Activity

### Props

```typescript
type DeadlineCountdownProps = {
  taskName: string;
  workspaceName: string;
  deadline: string;        // ISO — the deadline time
  priority: number;        // 0-3 for display purposes
  categoryId: string;      // For deep link routing
  taskId: string;          // For deep link routing
};
```

### Layout Slots

**Banner:**
- Top-left: colored dot + "DUE SOON" / "OVERDUE" label
- Below: task name + workspace + priority label
- Top-right: circular gauge showing time remaining, depleting as deadline approaches
- Middle: thin depleting progress bar
- Bottom: "✓ Complete" button (accent-colored) + "Open Task" button
- Deep link URL: `kindred://task/{categoryId}/{taskId}`

**Compact leading:** colored dot + task name (truncated)
**Compact trailing:** countdown (e.g., "47m") in accent color
**Minimal:** small depleting ring
**Expanded leading:** colored dot + "Due Soon" label
**Expanded trailing:** circular gauge with countdown
**Expanded bottom:** task name, workspace, progress bar, Complete + Open Task CTAs

### Color Escalation (gentle)

| Time Remaining | Accent Color | Status Label |
|---|---|---|
| 60 – 10 min | Purple `#8B5CF6` | "Due Soon" |
| < 10 min | Amber `#F59E0B` | "Due Soon" |
| Overdue | Gray `#6B7280` | "Overdue" |

No red. The depleting ring and countdown communicate urgency on their own.

### Timer Behavior

- Use `Text` with `timerInterval` counting down to the deadline — auto-updates natively
- Use `ProgressView` with `timerInterval` for the depleting bar
- The circular gauge depletes as time runs out (opposite direction from active task)
- Color transitions happen via prop updates from the frontend at the threshold boundaries (10 min mark, 0 mark)

### Triggering

**Auto-start (push notification):**
- Backend sends a push notification 1 hour before the task's `deadline`
- Frontend notification handler starts the deadline countdown activity
- Only for tasks with a `deadline` set

**Manual start:**
- Keep the existing "Track Deadline" button on task detail, now using the new redesigned activity

**Auto-end:**
- Activity persists past the deadline, switching to "Overdue" gray state
- Auto-dismisses 30 minutes after the deadline passes
- Completing the task ends it immediately

## What Gets Removed

- `EncouragementActivity.tsx` — deleted entirely
- `EncouragementActivityFactory` export from `widgetUpdaters.ts` — removed
- Encouragement live activity trigger in `kudosContext.tsx` — removed (encouragements remain as push notifications)

## What Gets Modified

- `DeadlineCountdownActivity.tsx` — rewritten with new design, new props (adds `categoryId`, `taskId`, removes `timeRemainingLabel`)
- `widgetUpdaters.ts` — add `ActiveTaskActivityFactory`, remove `EncouragementActivityFactory`
- `task/[id].tsx` — add "Start Working" button that starts active task live activity; update "Track Deadline" to use new deadline activity
- `kudosContext.tsx` — remove all live activity code (keep encouragement fetching/state)

## What Gets Created

- `ActiveTaskActivity.tsx` — new live activity widget component
- `hooks/useLiveActivityManager.ts` — shared hook to manage active task + deadline live activity lifecycle, listen for push triggers, handle deep link CTAs

### Backend Changes (separate work item)

The backend needs two new scheduled push notifications:
1. At a task's `startTime` — payload includes task metadata to start the Active Task activity
2. 1 hour before a task's `deadline` — payload includes task metadata to start the Deadline Countdown activity

These build on the existing reminder/notification infrastructure. The push payload should include: `taskId`, `categoryId`, `taskName`, `workspaceName`, `startTime` or `deadline`, and a `liveActivityType` field (`"activeTask"` or `"deadlineCountdown"`).

The frontend notification handler checks for `liveActivityType` in the push data and starts the appropriate live activity. This works even when the app is backgrounded (iOS processes notification payloads in the background).

## File Changes Summary

| File | Action |
|---|---|
| `widgets/ActiveTaskActivity.tsx` | **Create** — new active task live activity |
| `widgets/DeadlineCountdownActivity.tsx` | **Rewrite** — new design, new props |
| `widgets/EncouragementActivity.tsx` | **Delete** |
| `widgets/widgetUpdaters.ts` | **Modify** — add ActiveTask factory, remove Encouragement factory |
| `hooks/useLiveActivityManager.ts` | **Create** — manages lifecycle of both activities |
| `contexts/kudosContext.tsx` | **Modify** — remove live activity code |
| `app/(logged-in)/(tabs)/(task)/task/[id].tsx` | **Modify** — add Start Working button, update deadline tracking |
| Backend notification scheduling | **Modify** — add startTime and deadline-1h push triggers |
