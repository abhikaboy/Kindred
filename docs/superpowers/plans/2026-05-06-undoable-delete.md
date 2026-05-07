# Undoable Task Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-second undo window to task deletion across all swipeable surfaces, with rolling batch support for rapid consecutive deletes.

**Architecture:** A new `useUndoableDelete` hook manages a pending-deletes map and a single rolling timer. Components call `deleteWithUndo()` instead of the API directly. A new `UndoToast` component renders the "N task(s) deleted · Undo" toast. On timer expiry the hook fires the real API calls; on undo it restores all pending tasks to the context.

**Tech Stack:** React Native, Expo, react-native-toastable, react-native-reanimated, expo-haptics

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/components/ui/UndoToast.tsx` | Toast with "Undo" button |
| Create | `frontend/hooks/useUndoableDelete.tsx` | Delayed-delete lifecycle hook |
| Modify | `frontend/components/cards/SwipableTaskCard.tsx` | Replace inline delete with hook |
| Modify | `frontend/components/cards/SchedulableTaskCard.tsx` | Replace inline delete with hook |
| Modify | `frontend/components/daily/CalendarView.tsx` | Replace inline delete with hook |
| Modify | `frontend/app/(logged-in)/(tabs)/(task)/review.tsx` | Replace inline delete with hook |

---

### Task 1: Create UndoToast component

**Files:**
- Create: `frontend/components/ui/UndoToast.tsx`

- [ ] **Step 1: Create UndoToast.tsx**

This follows the same pattern as `DefaultToast.tsx` — pan-gesture dismiss, themed colors, animated opacity. The key addition is an "Undo" pressable on the right side.

```tsx
import React from "react";
import { View, Dimensions, StyleSheet, TouchableOpacity } from "react-native";
import { ToastableBodyParams, hideToastable } from "react-native-toastable";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
    withSpring,
    withTiming,
} from "react-native-reanimated";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface UndoToastProps extends ToastableBodyParams {
    onUndo: () => void;
    count: number;
}

export default function UndoToast({ message, onUndo, count }: UndoToastProps) {
    const ThemedColor = useThemeColor();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);

    React.useEffect(() => {
        translateX.value = 0;
        translateY.value = 0;
        opacity.value = 1;
    }, []);

    const panGesture = Gesture.Pan()
        .onBegin(() => {
            startX.value = translateX.value;
            startY.value = translateY.value;
        })
        .onUpdate((event) => {
            translateX.value = startX.value + event.translationX;
            translateY.value = startY.value + event.translationY;
            const horizontalProgress = Math.abs(translateX.value) / (screenWidth * 0.3);
            const verticalProgress = Math.abs(translateY.value) / (screenHeight * 0.2);
            const maxProgress = Math.max(horizontalProgress, verticalProgress);
            opacity.value = Math.max(0.3, 1 - maxProgress);
        })
        .onEnd((event) => {
            const horizontalThreshold = screenWidth * 0.25;
            const verticalThreshold = screenHeight * 0.15;
            const shouldDismissHorizontal =
                Math.abs(translateX.value) > horizontalThreshold || Math.abs(event.velocityX) > 500;
            const shouldDismissVertical =
                translateY.value < -verticalThreshold || event.velocityY < -500;

            if (shouldDismissHorizontal || shouldDismissVertical) {
                if (shouldDismissVertical) {
                    translateY.value = withTiming(-screenHeight, { duration: 200 });
                } else {
                    const direction = translateX.value > 0 ? 1 : -1;
                    translateX.value = withTiming(direction * screenWidth, { duration: 200 });
                }
                opacity.value = withTiming(0, { duration: 200 });
                runOnJS(hideToastable)();
            } else {
                translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
                opacity.value = withSpring(1, { damping: 20, stiffness: 300 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
        ],
        opacity: opacity.value,
    }));

    const label = count === 1 ? "1 task deleted" : `${count} tasks deleted`;

    return (
        <GestureDetector gesture={panGesture}>
            <Reanimated.View style={animatedStyle as any}>
                <View style={styles.container}>
                    <View style={[styles.toastBody, {
                        borderColor: ThemedColor.warning,
                        backgroundColor: ThemedColor.lightened,
                    }]}>
                        <ThemedText type="defaultSemiBold" style={styles.messageText}>
                            {label}
                        </ThemedText>
                        <TouchableOpacity onPress={onUndo} hitSlop={8} style={styles.undoButton}>
                            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                                Undo
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Reanimated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    toastBody: {
        minWidth: screenWidth * 0.8,
        maxWidth: screenWidth * 0.9,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: 12,
        borderBottomWidth: 3,
        paddingVertical: 16,
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    messageText: {
        fontSize: 16,
        flexShrink: 1,
    },
    undoButton: {
        marginLeft: 16,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
});
```

- [ ] **Step 2: Verify it renders**

Open the app, temporarily show this toast from any screen to confirm layout. Or just verify no TypeScript errors:

```bash
cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors in UndoToast.tsx.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/UndoToast.tsx
git commit -m "feat: add UndoToast component for delayed-delete undo"
```

---

### Task 2: Create useUndoableDelete hook

**Files:**
- Create: `frontend/hooks/useUndoableDelete.tsx`

- [ ] **Step 1: Create the hook file**

```tsx
import React, { useRef, useEffect, useCallback, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { showToastable, hideToastable } from "react-native-toastable";
import { useTasks } from "@/contexts/tasksContext";
import { removeFromCategoryAPI, bulkDeleteTasksAPI } from "@/api/task";
import { Task } from "@/api/types";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";
import UndoToast from "@/components/ui/UndoToast";
import DefaultToast from "@/components/ui/DefaultToast";

const UNDO_DELAY_MS = 5000;

interface PendingDelete {
    task: Task;
    categoryId: string;
    deleteRecurring: boolean;
}

export function useUndoableDelete() {
    const { removeFromCategory, addToCategory } = useTasks();
    const pendingRef = useRef<Map<string, PendingDelete>>(new Map());
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    // Alert state for recurring task dialog
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    const flushPending = useCallback(async () => {
        const entries = Array.from(pendingRef.current.values());
        pendingRef.current.clear();
        if (entries.length === 0) return;

        // Partition: recurring-template deletes need individual calls
        const individual: PendingDelete[] = [];
        const bulkable: PendingDelete[] = [];

        for (const entry of entries) {
            if (entry.deleteRecurring) {
                individual.push(entry);
            } else {
                bulkable.push(entry);
            }
        }

        // Fire bulk delete for non-recurring
        if (bulkable.length > 0) {
            try {
                if (bulkable.length === 1) {
                    const { categoryId, task } = bulkable[0];
                    await removeFromCategoryAPI(categoryId, task.id, false);
                } else {
                    await bulkDeleteTasksAPI(
                        bulkable.map(({ categoryId, task }) => ({
                            categoryId,
                            taskId: task.id,
                            deleteRecurring: false,
                        }))
                    );
                }
            } catch (error) {
                // Restore failed tasks to UI
                for (const { categoryId, task } of bulkable) {
                    addToCategory(categoryId, task);
                }
                showToastable({
                    title: "Error",
                    status: "danger",
                    position: "top",
                    message: "Failed to delete task(s)",
                    swipeDirection: "up",
                    renderContent: (props) => <DefaultToast {...props} />,
                });
            }
        }

        // Fire individual calls for recurring-template deletes
        for (const entry of individual) {
            try {
                await removeFromCategoryAPI(entry.categoryId, entry.task.id, true);
            } catch (error) {
                addToCategory(entry.categoryId, entry.task);
                showToastable({
                    title: "Error",
                    status: "danger",
                    position: "top",
                    message: `Failed to delete "${entry.task.content}"`,
                    swipeDirection: "up",
                    renderContent: (props) => <DefaultToast {...props} />,
                });
            }
        }
    }, [addToCategory]);

    // On unmount: flush immediately (no more undo possible)
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = undefined;
            }
            flushPending();
        };
    }, [flushPending]);

    const undoAll = useCallback(() => {
        // Clear the timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = undefined;
        }

        // Restore all pending tasks
        for (const { categoryId, task } of pendingRef.current.values()) {
            addToCategory(categoryId, task);
        }
        pendingRef.current.clear();
        hideToastable();
    }, [addToCategory]);

    const scheduleFlush = useCallback(() => {
        // Clear existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        const count = pendingRef.current.size;

        // Show/update the undo toast
        showToastable({
            title: "Deleted",
            message: count === 1 ? "1 task deleted" : `${count} tasks deleted`,
            status: "warning",
            position: "top",
            duration: UNDO_DELAY_MS,
            swipeDirection: "up",
            renderContent: (props) => (
                <UndoToast {...props} onUndo={undoAll} count={count} />
            ),
        });

        // Start new timer
        timerRef.current = setTimeout(() => {
            timerRef.current = undefined;
            flushPending();
        }, UNDO_DELAY_MS);
    }, [undoAll, flushPending]);

    const enqueuePendingDelete = useCallback(
        (task: Task, categoryId: string, deleteRecurring: boolean) => {
            // Snapshot the task into the pending map
            pendingRef.current.set(task.id, {
                task: { ...task },
                categoryId,
                deleteRecurring,
            });

            // Optimistic UI removal
            removeFromCategory(categoryId, task.id);

            // Haptic feedback
            if (Platform.OS === "ios") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }

            // Schedule (or reschedule) the flush
            scheduleFlush();
        },
        [removeFromCategory, scheduleFlush]
    );

    const deleteWithUndo = useCallback(
        (task: Task, categoryId: string) => {
            if (task.templateID) {
                // Show recurring task dialog
                setAlertTitle("Delete Recurring Task");
                setAlertMessage(
                    "Do you want to delete only this task or all future tasks?"
                );
                setAlertButtons([
                    {
                        text: "Cancel",
                        style: "cancel",
                    },
                    {
                        text: "Only This Task",
                        onPress: () => enqueuePendingDelete(task, categoryId, false),
                    },
                    {
                        text: "All Future Tasks",
                        onPress: () => enqueuePendingDelete(task, categoryId, true),
                        style: "destructive",
                    },
                ]);
                setAlertVisible(true);
            } else {
                enqueuePendingDelete(task, categoryId, false);
            }
        },
        [enqueuePendingDelete]
    );

    const alertElement = alertVisible ? (
        <CustomAlert
            visible={alertVisible}
            setVisible={setAlertVisible}
            title={alertTitle}
            message={alertMessage}
            buttons={alertButtons}
        />
    ) : null;

    return { deleteWithUndo, alertElement };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors in useUndoableDelete.tsx.

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useUndoableDelete.tsx
git commit -m "feat: add useUndoableDelete hook with rolling batch undo"
```

---

### Task 3: Integrate into SwipableTaskCard

**Files:**
- Modify: `frontend/components/cards/SwipableTaskCard.tsx`

- [ ] **Step 1: Replace the inline delete with the hook**

In `SwipableTaskCard.tsx`, make these changes:

**a) Update imports** — remove `removeFromCategoryAPI` from the task import (line 12), remove `CustomAlert` and `AlertButton` imports (line 19). Add `useUndoableDelete`:

Replace:
```tsx
import { markAsCompletedAPI, activateTaskAPI, removeFromCategoryAPI } from "@/api/task";
```
With:
```tsx
import { markAsCompletedAPI, activateTaskAPI } from "@/api/task";
```

Replace:
```tsx
import CustomAlert, { AlertButton } from "../modals/CustomAlert";
```
With:
```tsx
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
```

**b) Inside the component**, remove alert state (lines 41-44) and the `deleteTask` function (lines 58-103). Add the hook call after the existing `useTasks()` line:

Remove these lines:
```tsx
    // Alert state
    const [alertVisible, setAlertVisible] = React.useState(false);
    const [alertTitle, setAlertTitle] = React.useState("");
    const [alertMessage, setAlertMessage] = React.useState("");
    const [alertButtons, setAlertButtons] = React.useState<AlertButton[]>([]);
```

And remove the entire `deleteTask` function (lines 58-103).

Add after the `useThemeColor()` call:
```tsx
    const { deleteWithUndo, alertElement } = useUndoableDelete();
```

**c) Update the trash button callback** (line 268) — replace `() => deleteTask(categoryId, task.id)` with:
```tsx
() => deleteWithUndo(task, categoryId)
```

**d) Replace CustomAlert render blocks** — in both the phantom card return (lines 220-228) and the main return (lines 284-292), replace:
```tsx
                {alertVisible && (
                    <CustomAlert
                        visible={alertVisible}
                        setVisible={setAlertVisible}
                        title={alertTitle}
                        message={alertMessage}
                        buttons={alertButtons}
                    />
                )}
```
With:
```tsx
                {alertElement}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/cards/SwipableTaskCard.tsx
git commit -m "refactor: use useUndoableDelete in SwipableTaskCard"
```

---

### Task 4: Integrate into SchedulableTaskCard

**Files:**
- Modify: `frontend/components/cards/SchedulableTaskCard.tsx`

- [ ] **Step 1: Replace the inline delete with the hook**

**a) Update imports** — remove `removeFromCategoryAPI` (line 13), remove `CustomAlert` and `AlertButton` (line 19). Add hook:

Replace:
```tsx
import { markAsCompletedAPI, activateTaskAPI, removeFromCategoryAPI } from "@/api/task";
```
With:
```tsx
import { markAsCompletedAPI, activateTaskAPI } from "@/api/task";
```

Replace:
```tsx
import CustomAlert, { AlertButton } from "../modals/CustomAlert";
```
With:
```tsx
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
```

**b) Inside the component**, remove alert state (lines 40-43) and `deleteTask` function (lines 49-90). Add the hook:

Remove:
```tsx
    // Alert state
    const [alertVisible, setAlertVisible] = React.useState(false);
    const [alertTitle, setAlertTitle] = React.useState("");
    const [alertMessage, setAlertMessage] = React.useState("");
    const [alertButtons, setAlertButtons] = React.useState<AlertButton[]>([]);
```

Remove the entire `deleteTask` function (lines 49-90).

Add after the `useThemeColor()` call:
```tsx
    const { deleteWithUndo, alertElement } = useUndoableDelete();
```

**c) Update `handleRightSwipe`** (lines 93-99) — replace the fallback:

Replace:
```tsx
    const handleRightSwipe = () => {
        if (onRightSwipe) {
            onRightSwipe();
        } else {
            deleteTask(categoryId, task.id);
        }
    };
```
With:
```tsx
    const handleRightSwipe = () => {
        if (onRightSwipe) {
            onRightSwipe();
        } else {
            deleteWithUndo(task, categoryId);
        }
    };
```

**d) Replace the CustomAlert render** (lines 131-139):

Replace:
```tsx
            {alertVisible && (
                <CustomAlert
                    visible={alertVisible}
                    setVisible={setAlertVisible}
                    title={alertTitle}
                    message={alertMessage}
                    buttons={alertButtons}
                />
            )}
```
With:
```tsx
            {alertElement}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/cards/SchedulableTaskCard.tsx
git commit -m "refactor: use useUndoableDelete in SchedulableTaskCard"
```

---

### Task 5: Integrate into CalendarView

**Files:**
- Modify: `frontend/components/daily/CalendarView.tsx`

- [ ] **Step 1: Replace the inline delete with the hook**

**a) Update imports** (line 24) — remove `removeFromCategoryAPI` from the import:

Replace:
```tsx
import { updateTaskAPI, removeFromCategoryAPI, markAsCompletedAPI } from "@/api/task";
```
With:
```tsx
import { updateTaskAPI, markAsCompletedAPI } from "@/api/task";
```

Remove the `Alert` import from react-native (line 2) if no other uses of `Alert` remain in the file. Check first — if `Alert` is used elsewhere in CalendarView, keep it.

Add:
```tsx
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
```

**b) Inside the component**, add the hook near the other hooks (after line 62):

```tsx
    const { deleteWithUndo, alertElement } = useUndoableDelete();
```

**c) Replace `handleDeleteTask`** (lines 429-459) with:

```tsx
    const handleDeleteTask = () => {
        if (!selectedTask?.id || !selectedTask?.categoryID) return;
        setContextMenuVisible(false);
        deleteWithUndo(selectedTask as Task, selectedTask.categoryID);
    };
```

Note: The `isDeleting` state (line 72) and its usage on the delete button can be removed since the delete is now deferred. Remove `const [isDeleting, setIsDeleting] = useState(false);` and any references to `isDeleting` in the delete button's disabled prop or label.

**d) Render `{alertElement}`** — add it right before the closing tag of the component's return, next to the other modals.

- [ ] **Step 2: Verify no TypeScript errors and check `Alert` usage**

```bash
cd /Users/abhik.ray/Kindred/frontend && grep -n "Alert\." frontend/components/daily/CalendarView.tsx
```

If `Alert.alert` is only used in the deleted `handleDeleteTask`, remove the `Alert` import. If used elsewhere, keep it.

```bash
cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/daily/CalendarView.tsx
git commit -m "refactor: use useUndoableDelete in CalendarView"
```

---

### Task 6: Integrate into Review screen

**Files:**
- Modify: `frontend/app/(logged-in)/(tabs)/(task)/review.tsx`

- [ ] **Step 1: Replace the inline delete with the hook**

**a) Update imports** (line 14) — remove `removeFromCategoryAPI`:

Replace:
```tsx
import { markAsCompletedAPI, removeFromCategoryAPI } from "@/api/task";
```
With:
```tsx
import { markAsCompletedAPI } from "@/api/task";
```

Add:
```tsx
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
```

**b) Inside the `Review` component**, add the hook after the existing hooks (around line 23):

```tsx
    const { deleteWithUndo, alertElement } = useUndoableDelete();
```

**c) Replace `handleDelete`** (lines 193-202) with:

```tsx
    const handleDelete = async (task: Task): Promise<void> => {
        if (!task.categoryID) {
            throw new Error("Task category ID is missing");
        }
        deleteWithUndo(task, task.categoryID);
    };
```

Note: Remove `debouncedFetchWorkspaces()` from the delete path — the hook's `flushPending` handles the API call. The debounced fetch for completion (`handleComplete`) stays as-is.

**d) Render `{alertElement}`** — add it inside the component's return JSX, near the bottom (before the closing `</ThemedView>` or equivalent wrapper).

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(logged-in\)/\(tabs\)/\(task\)/review.tsx
git commit -m "refactor: use useUndoableDelete in review screen"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Test single delete + undo on home screen**

1. Open the app, navigate to a workspace with tasks
2. Swipe right on a task card → tap trash icon
3. Verify: task disappears immediately, "1 task deleted · Undo" toast appears
4. Tap "Undo" within 5 seconds
5. Verify: task reappears in its original position

- [ ] **Step 2: Test single delete + timer expiry**

1. Swipe to delete a non-recurring task
2. Wait 5 seconds without tapping undo
3. Verify: toast disappears, task stays gone
4. Pull to refresh or navigate away and back
5. Verify: task is still gone (API was called)

- [ ] **Step 3: Test batch delete + undo**

1. Delete task A
2. Within 5 seconds, delete task B
3. Verify: toast updates to "2 tasks deleted · Undo"
4. Tap Undo
5. Verify: both tasks A and B reappear

- [ ] **Step 4: Test recurring task delete**

1. Find a recurring task (has template)
2. Swipe to delete → verify "Delete Recurring Task" dialog appears
3. Choose "Only This Task"
4. Verify: undo toast appears, task is removed
5. Tap Undo → verify task reappears

- [ ] **Step 5: Test CalendarView delete**

1. Navigate to Daily view
2. Long-press a task → tap "Delete Task" in context menu
3. Verify: context menu closes, undo toast appears
4. Let timer expire
5. Verify: task is deleted

- [ ] **Step 6: Test Review screen delete**

1. Navigate to Review screen
2. Swipe a task down (delete direction)
3. Verify: undo toast appears
4. For a recurring task, verify dialog appears first

- [ ] **Step 7: Commit final state**

If any TypeScript issues were found and fixed during smoke testing:

```bash
git add -A
git commit -m "fix: address issues found during undoable delete smoke test"
```
