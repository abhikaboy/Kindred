# Undoable Task Delete - Frontend-Delayed Delete with Rolling Batch Undo

## Summary

When a user swipes to delete a task, remove it from the UI immediately but delay the API call for 5 seconds. Show an undo toast that accumulates multiple deletes into a single batch. Tapping "Undo" restores all pending tasks; letting the timer expire fires all delete API calls.

## Motivation

Currently, task deletion is instant and irreversible from the frontend. Accidental swipes cause data loss with no recovery path. This is especially dangerous on the review screen where swipe-to-delete has no confirmation dialog (for non-recurring tasks).

## Architecture

### New Files

#### 1. `frontend/hooks/useUndoableDelete.tsx`

A hook that manages the entire delayed-delete lifecycle.

**Returns:**
- `deleteWithUndo(task: Task, categoryId: string)` - main function called by components
- `alertElement: JSX.Element | null` - CustomAlert for recurring task dialog, rendered by consuming component

**Internal state:**
- `pendingDeletesRef = useRef<Map<string, PendingDelete>>()` - map of taskId to snapshot
- `timerRef = useRef<ReturnType<typeof setTimeout>>()` - single rolling timer
- Alert state for recurring task dialog (`alertVisible`, `alertTitle`, `alertMessage`, `alertButtons`)

**PendingDelete type:**
```typescript
interface PendingDelete {
  task: Task;
  categoryId: string;
  deleteRecurring: boolean;
}
```

**Flow:**

```
deleteWithUndo(task, categoryId):
  1. If task.templateID exists:
     → Show CustomAlert: "Cancel" / "Only This Task" / "All Future Tasks"
     → On cancel: abort
     → On choice: set deleteRecurring flag, continue to step 2
  2. If no templateID: deleteRecurring = false, continue to step 2

  3. Snapshot task + categoryId + deleteRecurring into pendingDeletesRef Map
  4. removeFromCategory(categoryId, taskId)  // optimistic UI removal
  5. Haptic feedback (warning, iOS only)
  6. Clear existing timer (if any)
  7. Show UndoToast via showToastable:
     - message: "N task(s) deleted"
     - duration: 5000ms
     - renderContent: UndoToast with onUndo callback
  8. Start new 5-second setTimeout

  On Undo (user taps button):
    - clearTimeout
    - For each entry in pendingDeletesRef: addToCategory(categoryId, task)
    - Clear the Map
    - hideToastable()

  On timer expiry:
    - Partition pending deletes:
      - Non-recurring (deleteRecurring=false): use bulkDeleteTasksAPI if multiple, removeFromCategoryAPI if single
      - Recurring with deleteRecurring=true: individual removeFromCategoryAPI calls
    - On error for any task: addToCategory to restore that task + show error toast
    - Clear the Map
```

**Dependencies used from context/hooks:**
- `useTasks()` → `removeFromCategory`, `addToCategory`
- `removeFromCategoryAPI`, `bulkDeleteTasksAPI` from `@/api/task`
- `showToastable`, `hideToastable` from `react-native-toastable`
- `Haptics` from `expo-haptics`

#### 2. `frontend/components/ui/UndoToast.tsx`

Custom toast component following the same pattern as `DefaultToast`.

**Props:** Extends `ToastableBodyParams` with:
- `onUndo: () => void` - callback when undo button pressed
- `count: number` - number of tasks pending deletion

**Layout:**
- Left side: message text ("N task(s) deleted")
- Right side: "Undo" text button (themed primary color)
- Bottom border: warning color
- Same pan-gesture dismiss behavior as DefaultToast

**Styling:**
- Matches DefaultToast dimensions (80-90% screen width)
- Same shadow, border radius, background
- "Undo" button: bold text, primary color, tappable area with padding

### Changes to Existing Files

#### 3. `frontend/components/cards/SwipableTaskCard.tsx`

**Remove:**
- `deleteTask` function (lines 58-103)
- Alert state variables (lines 41-44)
- `CustomAlert` import and render (lines 19, 284-292)
- `removeFromCategoryAPI` import (line 12, partially - still used elsewhere? No, completion is separate)

**Add:**
- Import and call `useUndoableDelete`
- `const { deleteWithUndo, alertElement } = useUndoableDelete();`
- Trash button callback: `() => deleteWithUndo(task, categoryId)`
- Render `{alertElement}` where `<CustomAlert>` was

#### 4. `frontend/components/cards/SchedulableTaskCard.tsx`

**Same pattern as SwipableTaskCard:**
- Remove `deleteTask` function (lines 49-90), alert state (lines 40-43), `CustomAlert` render
- Add `useUndoableDelete` hook
- `handleRightSwipe` falls through to `deleteWithUndo` when no `onRightSwipe` prop

#### 5. `frontend/components/daily/CalendarView.tsx`

**Remove:**
- `handleDeleteTask` function (lines 429-459)
- The `Alert.alert` call for recurring tasks

**Add:**
- `useUndoableDelete` hook
- Replace delete handler: `() => deleteWithUndo(selectedTask, selectedTask.categoryID)`
- Context menu close still happens immediately (before the timer)

#### 6. `frontend/app/(logged-in)/(tabs)/(task)/review.tsx`

**Change in `handleDelete`:**
- Currently calls `removeFromCategoryAPI` directly (line 198)
- Replace with `deleteWithUndo(task, task.categoryID)`
- The review screen's `removeTaskFromUI` (local card removal from the swipe stack) still fires immediately - this is separate from the context-level `removeFromCategory` that the hook calls
- Note: review screen doesn't show recurring dialogs currently (always passes `false`). With the hook, recurring tasks swiped down will now show the dialog, which is an improvement.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Multiple rapid deletes | Each adds to pending Map, timer resets, toast updates count |
| Undo after multiple deletes | All pending tasks restored at once |
| Toast swiped away by user | Timer continues; API fires when it expires |
| App backgrounded during timer | setTimeout pauses on iOS/Android, resumes on foreground |
| API error on delayed call | Failed task restored via addToCategory, error toast shown |
| Recurring "All Future Tasks" | deleteRecurring=true captured in snapshot, passed to API on timer |
| Delete then undo then delete same task | Works - task re-enters Map on second delete |
| Component unmounts during timer | useEffect cleanup clears timer, fires all pending API calls immediately |

## Component Unmount Handling

The hook registers a cleanup in `useEffect` that, on unmount:
1. Clears the timer
2. Fires all pending API calls immediately (no undo possible after navigating away)

This prevents tasks from being removed from UI but never deleted on the backend.

## What Does NOT Change

- Task completion flow (useTaskCompletion hook)
- tasksContext.tsx (addToCategory and removeFromCategory already exist)
- Backend (no changes)
- bulkDeleteTasksAPI already exists in api/task.ts

## Testing Considerations

- Verify single delete → undo restores task
- Verify single delete → timer fires → API called
- Verify 3 rapid deletes → undo restores all 3
- Verify recurring task shows dialog before adding to pending
- Verify "All Future Tasks" flag is preserved through timer
- Verify component unmount fires pending deletes
- Verify API error restores task to UI
