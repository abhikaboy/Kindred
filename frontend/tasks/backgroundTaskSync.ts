import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tryStartActiveTaskActivity, tryStartDeadlineActivity } from '@/utils/liveActivityManager';
import type { Task } from '@/api/types';

const TASK_NAME = 'KINDRED_LIVE_ACTIVITY_CHECK';
const STORAGE_KEY = '@kindred/upcoming-task-times';

// Lazy-load native modules — they crash at import time if not linked in the binary
let TaskManagerModule: typeof import('expo-task-manager') | null = null;
let BackgroundFetchModule: typeof import('expo-background-fetch') | null = null;

try {
    TaskManagerModule = require('expo-task-manager');
    BackgroundFetchModule = require('expo-background-fetch');
} catch (e) {
    console.warn('[BackgroundTask] expo-task-manager/expo-background-fetch not available — background fetch disabled. Rebuild the native app to enable.');
}

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

// Only define the task if the native module is available
TaskManagerModule?.defineTask(TASK_NAME, async () => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return BackgroundFetchModule!.BackgroundFetchResult.NoData;

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
            ? BackgroundFetchModule!.BackgroundFetchResult.NewData
            : BackgroundFetchModule!.BackgroundFetchResult.NoData;
    } catch (e) {
        console.error('[BackgroundTask] Live activity check failed:', e);
        return BackgroundFetchModule!.BackgroundFetchResult.Failed;
    }
});

export async function registerBackgroundFetch(): Promise<void> {
    if (!BackgroundFetchModule) return;
    try {
        await BackgroundFetchModule.registerTaskAsync(TASK_NAME, {
            minimumInterval: 15 * 60,
            stopOnTerminate: false,
            startOnBoot: false,
        });
    } catch (e) {
        console.warn('[BackgroundTask] Failed to register background fetch:', e);
    }
}

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
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [allTasks]);
}
