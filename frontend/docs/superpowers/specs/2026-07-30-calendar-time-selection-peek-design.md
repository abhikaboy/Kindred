# Calendar time-selection peek

Date: 2026-07-30

## Problem

Scheduling from the day calendar costs three confirm taps around the one action the
user wanted. Today: drag an empty slot to make a ghost block → tap the ✓ badge inside
the ghost → `ScheduleTaskSheet` opens as a full modal → tap "Create New Task" → tap a
workspace → `CreateModal` opens → type → tap Create. Assigning an existing task is
better (one tap in the sheet) but still gated behind the ✓ and a modal that covers the
calendar.

## Goal

While a time selection is live, a peek panel sits at the bottom of the screen. From it
you assign an existing task in one tap, or open the full create sheet with the times
already filled in. The ✓ confirm disappears. The calendar stays visible and its handles
stay draggable, and the peek's time label tracks the handles live.

## Interaction

```
tap/drag an empty slot
  → ghost block appears AND peek slides up, together
  → drag either handle: the peek's time label tracks live (15-min snaps)
  → tap a task card       = assigned to the selection, peek + ghost clear
  → tap "+ new task…"     = full CreateModal, start/end prefilled
  → swipe the peek down   = cancel, ghost clears
  → tap the calendar outside the ghost = cancel (unchanged)
```

The ✓ badge inside the ghost block is removed. Assigning or creating *is* the confirm.

The peek occupies the bottom slot that `UnscheduledTray` uses today, and replaces it
while a selection is live — they list the same tasks, so showing both would be
redundant and would fight for vertical space.

## Architecture

One owner for the selection: `CalendarView` keeps the ghost's shared values (they drive
a UI-thread animated style and must stay there). `daily.tsx` mirrors the range as
read-only React state and drives the peek from it.

### `CalendarView.tsx` (modified)

- New prop `onGhostRangeChange?: (range: ScheduleTimeRange | null) => void`. Fires with
  the range when the ghost appears, again on every handle snap, and with `null` on
  dismiss. Snapping already throttles this to 15-minute steps via the existing
  `runOnJS(onTimeLabelUpdate)` path, so it is not a per-frame callback.
- Wrap in `forwardRef` and expose `{ clearGhost(): void }` via `useImperativeHandle`, so
  `daily.tsx` can clear the selection after an assign or a create. `clearGhost` runs the
  same path as an internal dismiss, including firing `onGhostRangeChange(null)`.
- Delete the `onDragCreateComplete` prop and `handleGhostConfirm`.
- The tap handler keeps only its dismiss branch: a tap inside the ghost is now a no-op,
  a tap outside dismisses.

### `TimeRangeGhostBlock.tsx` (modified)

Remove the `confirmBadge` view and its `confirmBadge` style. Handles, label, and the
`textOpacity` behaviour are untouched.

### `TimeSelectionPeek.tsx` (new)

```ts
type Props = {
    range: ScheduleTimeRange;      // live, re-rendered on each snap
    selectedDate: Date;
    tasks: any[];                  // unscheduled tasks, same shape daily.tsx already passes UnscheduledTray
    assigningTaskId: string | null; // dims the row mid-request
    onAssign: (task: any) => void;
    onCreateNew: () => void;
    onCancel: () => void;
};
```

Renders, bottom-pinned:

- Live header: `9:30 – 10:30 · 1h` plus a caption, from `range`.
- Horizontally scrolling task cards: content, `categoryName · workspaceName`, and a
  category dot from `getCategoryDuotoneColors`. Tap calls `onAssign`. The card for
  `assigningTaskId` renders at reduced opacity and ignores taps.
- A `+ new task…` row calling `onCreateNew`.
- With no unscheduled tasks, only the header and the `+ new task…` row show.
- A `Gesture.Pan` on the container: a downward drag past ~40px calls `onCancel`.
- Slides in via a `translateY` timing animation on mount.

Not a `BottomSheetModal` and not a `DefaultModal`: both dim and block the calendar, and
the whole point is that the calendar stays visible and its handles stay live. A
bottom-pinned `Animated.View` in the existing layout is what the interaction needs.

Icons come from `phosphor-react-native`. Text uses `ThemedText` semantic types, colors
`useThemeColor` — no hardcoded `fontFamily`/`fontWeight`. Borders use
`ThemedColor.tertiary`, never primary.

### `utils/timeUtils.ts` (modified)

`formatMinutesToTime(totalMinutes)` and `minutesToDate(baseDate, totalMinutes)` move
here from `ScheduleTaskSheet`, which is being deleted. Both are pure and get unit tests.

### `daily.tsx` (modified)

- `const [ghostRange, setGhostRange] = useState<ScheduleTimeRange | null>(null)` fed by
  `onGhostRangeChange`; `calendarViewRef` for `clearGhost()`.
- Bottom slot becomes `ghostRange ? <TimeSelectionPeek …/> : <UnscheduledTray …/>`.
- `handleAssignToRange(task)` absorbs `ScheduleTaskSheet.handleScheduleExisting`:
  optimistic `updateTask`, then `updateTaskStartAPI` + `updateTaskDeadlineAPI` in
  parallel, rolling back to the task's prior `startDate`/`startTime`/`deadline` on
  failure. On failure it also shows a `react-native-toastable` danger toast — today the
  error is only logged, so a failed assign looks like a successful one that silently
  reverted. Clears the selection on success.
- `handleCreateNewFromRange()` loses its `workspaceName` parameter: `resetTaskCreation()`,
  set start date/time and deadline from the range, then `openModal({ screen: Screen.STANDARD })`.
  The category is picked inside `CreateModal`'s existing dropdown, which is why the
  workspace-select step is not replaced by anything.
- Drop the `setTimeout(…, 300)` that wrapped `openModal` — React batches the preceding
  state writes, so the modal mounts with the values already applied.
- Delete `showScheduleSheet`, `scheduleTimeRange`, and `handleDragCreateComplete`.

### `ScheduleTaskSheet.tsx` (deleted)

418 lines. Its two jobs are gone: the confirm chain it existed to host, and the
workspace-select page that `CreateModal`'s category dropdown already covers.

## Data flow

```
handle drag (UI thread)
  └─ runOnJS → CalendarView.updateGhostLabel
       ├─ setGhostTimeLabel        (label inside the ghost, unchanged)
       └─ onGhostRangeChange(range) → daily.setGhostRange → TimeSelectionPeek re-renders

peek tap "assign"  → daily.handleAssignToRange → optimistic updateTask + 2 APIs
                                                → calendarViewRef.clearGhost()
peek tap "+ new"   → daily.handleCreateNewFromRange → taskCreation setters + openModal
                                                    → calendarViewRef.clearGhost()
peek swipe down    → calendarViewRef.clearGhost() → onGhostRangeChange(null)
```

## Error handling

- Assign failure: optimistic update rolls back to the task's previous
  `startDate`/`startTime`/`deadline`, plus a danger toast. The selection stays up so the
  user can retry.
- A task missing `id` or `categoryID` is skipped, as today.
- `clearGhost()` on an already-cleared ghost is a no-op.

## Testing

- `__tests__/TimeSelectionPeek.test.tsx` — renders the live label for a range; tapping a
  card calls `onAssign` with that task; tapping `+ new task…` calls `onCreateNew`; the
  card for `assigningTaskId` does not fire `onAssign`; an empty task list still renders
  `+ new task…`.
- `__tests__/timeRangeFormat.test.ts` — `formatMinutesToTime` across midnight, noon, and
  a padded-minutes case; `minutesToDate` sets h/m and zeroes s/ms without mutating the
  base date.

Existing suite must stay green. Baseline: 4 suites already fail on `main`
(`dragHitTest`, `AboutScreen`, `WorkspaceSwitcherList`, `TaskCardPostButton`) and are
unrelated.

## Out of scope

- Inline create inside the peek. Tapping `+ new task…` goes to the full `CreateModal`;
  no default-category rule is introduced.
- Drag-a-chip-onto-the-ghost. Tap assigns; `UnscheduledTray`'s existing long-press-drag
  onto a day is untouched.
- Multi-day or week-view selection. Day view only, as today.
