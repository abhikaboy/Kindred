# Background Live Activity Triggers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically start live activities when a task's start time arrives or deadline approaches, even when the user doesn't interact with a push notification.

**Architecture:** A shared `liveActivityManager` module owns all live activity lifecycle and deduplication. A foreground timer hook checks in-memory tasks every 30s. A background fetch task reads from AsyncStorage when the app is suspended. Both funnel through the manager, which prevents duplicates via a `Map<taskId>`.

**Tech Stack:** React Native, expo-widgets (existing), expo-task-manager (new), expo-background-fetch (new), AsyncStorage (existing)

---

### Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install expo-task-manager and expo-background-fetch**

```bash
cd frontend && bun add expo-task-manager expo-background-fetch
```

- [ ] **Step 2: Verify installation**

```bash
grep -E "expo-task-manager|expo-background-fetch" package.json
```

Expected: Both packages listed in dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add expo-task-manager and expo-background-fetch"
```

---

### Task 2: Create `liveActivityManager.ts`

**Files:**
- Create: `frontend/utils/liveActivityManager.ts`

This is the deduplication layer. All live activity start/end calls go through here.

- [ ] **Step 1: Create the manager module**

```typescript
// frontend/utils/liveActivityManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ActiveTaskActivityFactory,
    DeadlineCountdownActivityFactory,
} from '@/widgets/widgetUpdaters';
import type { ActiveTaskActivityProps } from '@/widgets/ActiveTaskActivity';
import type { DeadlineCountdownProps } from '@/widgets/DeadlineCountdownActivity';

const STORAGE_KEY = '@kindred/active-live-activities';

type ActivityEntry = {
    instance: { update: (props: any) => Promise<void>; end: (policy?: string) => Promise<void> };
    intervalId: ReturnType<typeof setInterval>;
};

const activeActivities = new Map<string, ActivityEntry>();
let initialized = false;

/**
 * Hydrate the active set from AsyncStorage + cross-check with native instances.
 * If no native instances are running, clear the persisted set.
 */
async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    initialized = true;

    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const storedIds: string[] = stored ? JSON.parse(stored) : [];

        // Check if any live activities are actually running natively
        const activeInstances = ActiveTaskActivityFactory.getInstances();
        const deadlineInstances = DeadlineCountdownActivityFactory.getInstances();
        const hasNativeInstances = activeInstances.length > 0 || deadlineInstances.length > 0;

        if (hasNativeInstances && storedIds.length > 0) {
            // Mark stored IDs as active (we can't map native instances back to taskIds,
            // but we know *something* is running, so respect the persisted set)
            for (const id of storedIds) {
                // Use a sentinel entry — we don't have the instance handle, but the
                // dedup check only needs the key to exist
                activeActivities.set(id, {
                    instance: { update: () => Promise.resolve(), end: () => Promise.resolve() },
                    intervalId: setTimeout(() => {}, 0), // no-op interval
                });
            }
        } else {
            // No native instances — clear stale persisted data
            await AsyncStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {
        console.warn('[LiveActivityManager] Failed to hydrate state:', e);
    }
}

async function persistActiveIds(): Promise<void> {
    const ids = Array.from(activeActivities.keys());
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
        console.warn('[LiveActivityManager] Failed to persist active IDs:', e);
    }
}

export function isActivityRunning(taskId: string): boolean {
    return activeActivities.has(taskId);
}

export async function tryStartActiveTaskActivity(
    taskId: string,
    props: ActiveTaskActivityProps,
): Promise<boolean> {
    await ensureInitialized();
    if (activeActivities.has(taskId)) return false;

    try {
        const instance = ActiveTaskActivityFactory.start(props);
        // Keep-alive: re-send props every 5 min so iOS doesn't mark it stale
        const intervalId = setInterval(() => {
            instance.update(props);
        }, 5 * 60 * 1000);

        activeActivities.set(taskId, { instance, intervalId });
        await persistActiveIds();
        return true;
    } catch (e) {
        console.error('[LiveActivityManager] Failed to start active task activity:', e);
        return false;
    }
}

export async function tryStartDeadlineActivity(
    taskId: string,
    props: DeadlineCountdownProps,
): Promise<boolean> {
    await ensureInitialized();
    if (activeActivities.has(taskId)) return false;

    try {
        const deadlineMs = new Date(props.deadline).getTime();
        const instance = DeadlineCountdownActivityFactory.start(props);

        // Color escalation every minute
        const intervalId = setInterval(() => {
            const remaining = deadlineMs - Date.now();
            let accentColor = '#8B5CF6';
            let statusLabel = 'Due Soon';
            if (remaining <= 0) {
                accentColor = '#6B7280';
                statusLabel = 'Overdue';
            } else if (remaining <= 10 * 60 * 1000) {
                accentColor = '#F59E0B';
                statusLabel = 'Due Soon';
            }
            instance.update({ ...props, accentColor, statusLabel });

            // Auto-dismiss 30 min after overdue
            if (remaining <= -30 * 60 * 1000) {
                endActivity(taskId);
            }
        }, 60 * 1000);

        activeActivities.set(taskId, { instance, intervalId });
        await persistActiveIds();
        return true;
    } catch (e) {
        console.error('[LiveActivityManager] Failed to start deadline activity:', e);
        return false;
    }
}

export async function endActivity(taskId: string): Promise<void> {
    const entry = activeActivities.get(taskId);
    if (!entry) return;

    clearInterval(entry.intervalId);
    try {
        await entry.instance.end('default');
    } catch (e) {
        console.warn('[LiveActivityManager] Failed to end activity:', e);
    }
    activeActivities.delete(taskId);
    await persistActiveIds();
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && bun tsc --noEmit utils/liveActivityManager.ts 2>&1 | grep -v "DatePager" | head -5
```

Expected: No errors from this file.

- [ ] **Step 3: Commit**

```bash
git add utils/liveActivityManager.ts
git commit -m "feat: add liveActivityManager with dedup for all activity triggers"
```

---

### Task 3: Create `useLiveActivityScheduler.ts`

**Files:**
- Create: `frontend/hooks/useLiveActivityScheduler.ts`

Foreground timer that checks tasks every 30 seconds and auto-starts live activities.

- [ ] **Step 1: Create the hook**

```typescript
// frontend/hooks/useLiveActivityScheduler.ts
import { useEffect, useRef } from 'react';
import { useTasks } from '@/contexts/tasksContext';
import { tryStartActiveTaskActivity, tryStartDeadlineActivity } from '@/utils/liveActivityManager';
import type { Task } from '@/api/types';
import type { ActiveTaskActivityProps } from '@/widgets/ActiveTaskActivity';
import type { DeadlineCountdownProps } from '@/widgets/DeadlineCountdownActivity';

function buildActiveTaskProps(task: Task): ActiveTaskActivityProps {
    return {
        taskName: task.content,
        workspaceName: task.workspaceName || 'Tasks',
        startTime: task.startTime || new Date().toISOString(),
        endTime: task.deadline || undefined,
        hasEndTime: !!task.deadline,
        categoryId: task.categoryID || '',
        taskId: task.id,
    };
}

function buildDeadlineProps(task: Task): DeadlineCountdownProps {
    return {
        taskName: task.content,
        workspaceName: task.workspaceName || 'Tasks',
        deadline: task.deadline!,
        priority: task.priority,
        categoryId: task.categoryID || '',
        taskId: task.id,
        accentColor: '#8B5CF6',
        statusLabel: 'Due Soon',
    };
}

/**
 * Foreground timer that scans tasks every 30s and auto-starts live activities
 * for tasks whose startTime just passed or deadline is ~1 hour away.
 */
export function useLiveActivityScheduler(): void {
    const { allTasks } = useTasks();
    const tasksRef = useRef(allTasks);
    tasksRef.current = allTasks;

    useEffect(() => {
        function checkTasks() {
            const now = Date.now();
            const fiveMinAgo = now - 5 * 60 * 1000;
            const thirtyMinFromNow = now + 30 * 60 * 1000;
            const sixtyFiveMinFromNow = now + 65 * 60 * 1000;

            for (const task of tasksRef.current) {
                if (!task.active) continue;

                // Skip completed tasks (timeCompleted is on the Task type from backend)
                if ((task as any).timeCompleted) continue;

                // Check startTime: fire if it's within [now-5min, now]
                if (task.startTime) {
                    const startMs = new Date(task.startTime).getTime();
                    if (startMs >= fiveMinAgo && startMs <= now) {
                        tryStartActiveTaskActivity(task.id, buildActiveTaskProps(task));
                    }
                }

                // Check deadline: fire if it's within [now+30min, now+65min]
                if (task.deadline) {
                    const deadlineMs = new Date(task.deadline).getTime();
                    if (deadlineMs >= thirtyMinFromNow && deadlineMs <= sixtyFiveMinFromNow) {
                        tryStartDeadlineActivity(task.id, buildDeadlineProps(task));
                    }
                }
            }
        }

        // Run immediately on mount, then every 30 seconds
        checkTasks();
        const intervalId = setInterval(checkTasks, 30 * 1000);
        return () => clearInterval(intervalId);
    }, []); // Stable ref pattern — no dependency on allTasks
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useLiveActivityScheduler.ts
git commit -m "feat: add useLiveActivityScheduler hook for foreground auto-trigger"
```

---

### Task 4: Create `backgroundTaskSync.ts`

**Files:**
- Create: `frontend/tasks/backgroundTaskSync.ts`

Handles AsyncStorage persistence for background fetch and defines the background task.

- [ ] **Step 1: Create the background task module**

```typescript
// frontend/tasks/backgroundTaskSync.ts
import { useEffect, useRef } from 'react';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tryStartActiveTaskActivity, tryStartDeadlineActivity } from '@/utils/liveActivityManager';
import type { Task } from '@/api/types';

const TASK_NAME = 'KINDRED_LIVE_ACTIVITY_CHECK';
const STORAGE_KEY = '@kindred/upcoming-task-times';

export type StoredTaskRecord = {
    taskId: string;
    categoryId: string;
    content: string;
    workspaceName: string;
    startTime?: string;
    deadline?: string;
    priority: number;
    active: boolean;
};

/**
 * Background fetch task definition. Must be called at module scope (top level)
 * before any component renders, per expo-task-manager requirements.
 */
TaskManager.defineTask(TASK_NAME, async () => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return BackgroundFetch.BackgroundFetchResult.NoData;

        const tasks: StoredTaskRecord[] = JSON.parse(raw);
        const now = Date.now();
        const fiveMinAgo = now - 5 * 60 * 1000;
        const thirtyMinFromNow = now + 30 * 60 * 1000;
        const sixtyFiveMinFromNow = now + 65 * 60 * 1000;
        let started = false;

        for (const task of tasks) {
            if (!task.active) continue;

            if (task.startTime) {
                const startMs = new Date(task.startTime).getTime();
                if (startMs >= fiveMinAgo && startMs <= now) {
                    const didStart = await tryStartActiveTaskActivity(task.taskId, {
                        taskName: task.content,
                        workspaceName: task.workspaceName || 'Tasks',
                        startTime: task.startTime,
                        endTime: task.deadline || undefined,
                        hasEndTime: !!task.deadline,
                        categoryId: task.categoryId,
                        taskId: task.taskId,
                    });
                    if (didStart) started = true;
                }
            }

            if (task.deadline) {
                const deadlineMs = new Date(task.deadline).getTime();
                if (deadlineMs >= thirtyMinFromNow && deadlineMs <= sixtyFiveMinFromNow) {
                    const didStart = await tryStartDeadlineActivity(task.taskId, {
                        taskName: task.content,
                        workspaceName: task.workspaceName || 'Tasks',
                        deadline: task.deadline,
                        priority: task.priority,
                        categoryId: task.categoryId,
                        taskId: task.taskId,
                        accentColor: '#8B5CF6',
                        statusLabel: 'Due Soon',
                    });
                    if (didStart) started = true;
                }
            }
        }

        return started
            ? BackgroundFetch.BackgroundFetchResult.NewData
            : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (e) {
        console.error('[BackgroundTask] Live activity check failed:', e);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

/**
 * Register the background fetch task. Call once on app startup.
 */
export async function registerBackgroundFetch(): Promise<void> {
    try {
        await BackgroundFetch.registerTaskAsync(TASK_NAME, {
            minimumInterval: 15 * 60, // 15 minutes
            stopOnTerminate: false,
            startOnBoot: false,
        });
    } catch (e) {
        console.warn('[BackgroundTask] Failed to register background fetch:', e);
    }
}

/**
 * Hook that syncs relevant tasks to AsyncStorage whenever allTasks changes.
 * Only persists tasks with a startTime or deadline in the next 24 hours.
 */
export function useBackgroundTaskSync(allTasks: Task[]): void {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            const now = Date.now();
            const twentyFourHoursFromNow = now + 24 * 60 * 60 * 1000;

            const records: StoredTaskRecord[] = allTasks
                .filter((task) => {
                    if (!task.active) return false;
                    const hasUpcomingStart = task.startTime &&
                        new Date(task.startTime).getTime() <= twentyFourHoursFromNow;
                    const hasUpcomingDeadline = task.deadline &&
                        new Date(task.deadline).getTime() <= twentyFourHoursFromNow;
                    return hasUpcomingStart || hasUpcomingDeadline;
                })
                .map((task) => ({
                    taskId: task.id,
                    categoryId: task.categoryID || '',
                    content: task.content,
                    workspaceName: task.workspaceName || 'Tasks',
                    startTime: task.startTime,
                    deadline: task.deadline,
                    priority: task.priority,
                    active: task.active,
                }));

            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records)).catch((e) => {
                console.warn('[BackgroundTaskSync] Failed to persist tasks:', e);
            });
        }, 500); // 500ms debounce

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [allTasks]);
}
```

- [ ] **Step 2: Commit**

```bash
git add tasks/backgroundTaskSync.ts
git commit -m "feat: add background fetch task and AsyncStorage sync for live activities"
```

---

### Task 5: Update `_layout.tsx` — replace inline activity code with manager calls

**Files:**
- Modify: `frontend/app/(logged-in)/_layout.tsx`

Replace the inline `ActiveTaskActivityFactory.start()` / `DeadlineCountdownActivityFactory.start()` calls and interval management with calls to the manager. Add the scheduler and background sync hooks.

- [ ] **Step 1: Add imports at the top of the file**

Add these imports near the existing widget imports (after line 36):

```typescript
import { tryStartActiveTaskActivity, tryStartDeadlineActivity } from '@/utils/liveActivityManager';
import { useLiveActivityScheduler } from '@/hooks/useLiveActivityScheduler';
import { useBackgroundTaskSync, registerBackgroundFetch } from '@/tasks/backgroundTaskSync';
import { useTasks } from '@/contexts/tasksContext';
```

Remove the now-unused direct factory imports — replace line 36:

```typescript
// REMOVE this line:
import { ActiveTaskActivityFactory, DeadlineCountdownActivityFactory } from "@/widgets/widgetUpdaters";
```

- [ ] **Step 2: Replace lines 255-326 (live activity interval ref + inline start functions)**

Remove the `liveActivityIntervalsRef` (line 255-256) and replace the `startActiveTaskActivity` and `startDeadlineActivity` inline functions (lines 261-326) inside the `useEffect` with:

```typescript
        const startActiveTaskActivityFromPush = (data: NotificationData) => {
            tryStartActiveTaskActivity(data.taskId || '', {
                taskName: data.taskName || '',
                workspaceName: data.workspaceName || 'Tasks',
                startTime: data.startTime || new Date().toISOString(),
                endTime: data.endTime || undefined,
                hasEndTime: !!data.endTime,
                categoryId: data.categoryId || '',
                taskId: data.taskId || '',
            });
        };

        const startDeadlineActivityFromPush = (data: NotificationData) => {
            tryStartDeadlineActivity(data.taskId || '', {
                taskName: data.taskName || '',
                workspaceName: data.workspaceName || 'Tasks',
                deadline: data.deadline || '',
                priority: parseInt(data.priority || '0', 10),
                categoryId: data.categoryId || '',
                taskId: data.taskId || '',
                accentColor: '#8B5CF6',
                statusLabel: 'Due Soon',
            });
        };
```

- [ ] **Step 3: Update notification listener references**

In the `notificationListener` callback (around lines 333-336), replace:
```typescript
                    startActiveTaskActivity(data);
```
with:
```typescript
                    startActiveTaskActivityFromPush(data);
```

And replace:
```typescript
                    startDeadlineActivity(data);
```
with:
```typescript
                    startDeadlineActivityFromPush(data);
```

Do the same in the `responseListener` callback (around lines 366-369).

- [ ] **Step 4: Simplify the cleanup in the useEffect return**

Replace lines 386-389:
```typescript
            // Clean up all live activity intervals
            liveActivityIntervalsRef.current.forEach(id => clearInterval(id));
            liveActivityIntervalsRef.current = [];
```

With nothing — remove those lines entirely. The manager owns interval lifecycle now.

- [ ] **Step 5: Add the scheduler and sync hooks inside the component body**

Inside the component function (e.g. after the existing `useEffect` blocks), add:

```typescript
    // Auto-start live activities when task times arrive (foreground)
    useLiveActivityScheduler();

    // Sync task times to AsyncStorage for background fetch
    const { allTasks } = useTasks();
    useBackgroundTaskSync(allTasks);
```

- [ ] **Step 6: Register background fetch on mount**

Inside the existing `useEffect` that calls `initNotificationHandler()` (line 258), add at the top:

```typescript
        registerBackgroundFetch();
```

- [ ] **Step 7: Verify the app compiles**

```bash
cd frontend && bun tsc --noEmit 2>&1 | grep -v "DatePager" | head -10
```

Expected: No new errors.

- [ ] **Step 8: Commit**

```bash
git add app/\(logged-in\)/_layout.tsx
git commit -m "refactor: route all live activity triggers through liveActivityManager"
```

---

### Task 6: Update `task/[id].tsx` — replace inline activity code with manager calls

**Files:**
- Modify: `frontend/app/(logged-in)/(tabs)/(task)/task/[id].tsx`

Replace the direct factory calls in `handleStartWorking()` and `handleTrackDeadline()` with the manager.

- [ ] **Step 1: Add import**

Add near the top of the file:

```typescript
import { tryStartActiveTaskActivity, tryStartDeadlineActivity, endActivity, isActivityRunning } from '@/utils/liveActivityManager';
```

- [ ] **Step 2: Replace `handleTrackDeadline` (lines 132-162)**

Replace with:

```typescript
    const handleTrackDeadline = async () => {
        if (!task?.deadline) return;
        if (isActivityRunning(id as string)) {
            await endActivity(id as string);
            setDeadlineLiveActivity(null);
            return;
        }

        const started = await tryStartDeadlineActivity(id as string, {
            taskName: task.content,
            workspaceName: (task as any).workspaceName || 'Tasks',
            deadline: task.deadline,
            priority: task.priority || 0,
            categoryId: categoryId as string,
            taskId: id as string,
            accentColor: '#8B5CF6',
            statusLabel: 'Due Soon',
        });

        if (!started) {
            showToastable({
                title: "Live Activity",
                message: "Could not start deadline tracking. Check that Live Activities are enabled in Settings.",
                status: "warning",
                duration: 4000,
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }
    };
```

- [ ] **Step 3: Replace `handleStartWorking` (lines 164-209)**

Replace with:

```typescript
    const handleStartWorking = async () => {
        if (!task) return;

        if (isActivityRunning(id as string)) {
            await endActivity(id as string);
            setActiveTaskLiveActivity(null);
            pauseTimer(id);
            return;
        }

        const now = new Date().toISOString();
        const endTime = task.deadline || undefined;

        const started = await tryStartActiveTaskActivity(id as string, {
            taskName: task.content,
            workspaceName: (task as any).workspaceName || 'Tasks',
            startTime: now,
            endTime,
            hasEndTime: !!endTime,
            categoryId: categoryId as string,
            taskId: id as string,
        });

        if (!started) {
            showToastable({
                title: "Live Activity",
                message: "Could not start live activity. Check that Live Activities are enabled in Settings.",
                status: "warning",
                duration: 4000,
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }

        startTimer(id);
    };
```

- [ ] **Step 4: Simplify the cleanup useEffect (lines 212-224)**

Replace with:

```typescript
    useEffect(() => {
        return () => {
            // Don't end activities on unmount — they should persist on lock screen
            // The manager handles lifecycle. Only clean up local state refs.
        };
    }, []);
```

- [ ] **Step 5: Remove unused imports and refs**

Remove the direct factory imports if no longer used elsewhere in the file:
```typescript
// Remove if unused:
import { ActiveTaskActivityFactory, DeadlineCountdownActivityFactory } from "@/widgets/widgetUpdaters";
```

Also remove `activeTaskIntervalRef` if it's no longer referenced.

- [ ] **Step 6: Commit**

```bash
git add app/\(logged-in\)/\(tabs\)/\(task\)/task/\[id\].tsx
git commit -m "refactor: use liveActivityManager in task detail for start working / track deadline"
```

---

### Task 7: Manual testing

**Files:** None (testing only)

- [ ] **Step 1: Test foreground auto-start for startTime**

1. Create a task with `startTime` set to 1-2 minutes from now
2. Keep the app in the foreground
3. Wait for the time to pass

Expected: Live activity appears automatically on the lock screen / dynamic island within 30 seconds of the start time.

- [ ] **Step 2: Test foreground auto-start for deadline**

1. Create a task with `deadline` set to ~61 minutes from now
2. Keep the app in the foreground

Expected: Deadline countdown live activity appears within ~1 minute.

- [ ] **Step 3: Test deduplication — push after auto-start**

1. Have a task with `startTime` about to fire
2. Let the foreground timer start the activity
3. When the backend push notification arrives, verify no second activity appears

Expected: Only one live activity. Console should show the manager returning `false` for the second attempt.

- [ ] **Step 4: Test manual "Start Working" after auto-start**

1. Let the foreground timer auto-start an activity for a task
2. Navigate to that task's detail screen
3. Tap "Start Working"

Expected: `isActivityRunning()` returns true, so tapping the button ends the activity (toggle behavior). No duplicate.

- [ ] **Step 5: Test background fetch (approximate)**

1. Start the app, ensure tasks with upcoming times exist
2. Background the app
3. Wait 15-30 minutes

Expected: Check device logs — background fetch task should run and start activities if times match.

- [ ] **Step 6: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: background live activity triggers with foreground timer and background fetch"
```
