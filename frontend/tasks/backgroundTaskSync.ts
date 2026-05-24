import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task } from '@/api/types';

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
 * No-op — background fetch removed due to expo-task-manager native crashes
 * during app startup (_restoreTasks throws NSException before JS is ready).
 * The foreground timer + push notifications provide sufficient coverage.
 */
export async function registerBackgroundFetch(): Promise<void> {
    // Intentionally empty — kept for API compatibility with _layout.tsx
}

/**
 * Hook that syncs relevant tasks to AsyncStorage whenever allTasks changes.
 * Only persists tasks with a startTime or deadline in the next 24 hours.
 * This data can be used by future background mechanisms if a safe native
 * approach becomes available.
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
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [allTasks]);
}
