import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { Task } from '@/api/types';

const NOTIFICATION_PREFIX_START = 'live-activity-start-';
const NOTIFICATION_PREFIX_DEADLINE = 'live-activity-deadline-';

/**
 * Schedule local notifications at exact task times so live activities
 * can trigger even when the app is backgrounded. Uses the same
 * `type: 'live_activity'` data format as backend push notifications,
 * so the existing handler in _layout.tsx picks them up identically.
 */
async function scheduleTaskNotifications(allTasks: Task[]): Promise<void> {
    // Cancel all previously scheduled live activity notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const liveActivityIds = scheduled
        .filter((n) => n.identifier.startsWith(NOTIFICATION_PREFIX_START) ||
                       n.identifier.startsWith(NOTIFICATION_PREFIX_DEADLINE))
        .map((n) => n.identifier);

    if (liveActivityIds.length > 0) {
        await Promise.all(
            liveActivityIds.map((id) => Notifications.cancelScheduledNotificationAsync(id))
        );
    }

    const now = Date.now();
    const twentyFourHoursFromNow = now + 24 * 60 * 60 * 1000;

    for (const task of allTasks) {
        if (!task.active) continue;
        if ((task as any).timeCompleted) continue;

        // Schedule at startTime
        if (task.startTime) {
            const startMs = new Date(task.startTime).getTime();
            if (startMs > now && startMs <= twentyFourHoursFromNow) {
                try {
                    await Notifications.scheduleNotificationAsync({
                        identifier: `${NOTIFICATION_PREFIX_START}${task.id}`,
                        content: {
                            title: task.workspaceName || 'Tasks',
                            body: `Time to start: ${task.content}`,
                            data: {
                                type: 'live_activity',
                                liveActivityType: 'activeTask',
                                taskId: task.id,
                                categoryId: task.categoryID || '',
                                taskName: task.content,
                                workspaceName: task.workspaceName || 'Tasks',
                                startTime: task.startTime,
                                endTime: task.deadline || '',
                            },
                            sound: true,
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.DATE,
                            date: new Date(task.startTime),
                        },
                    });
                } catch (e) {
                    console.warn('[TaskSync] Failed to schedule start-time notification:', e);
                }
            }
        }

        // Schedule 1 hour before deadline
        if (task.deadline) {
            const deadlineMs = new Date(task.deadline).getTime();
            const oneHourBefore = deadlineMs - 60 * 60 * 1000;
            if (oneHourBefore > now && oneHourBefore <= twentyFourHoursFromNow) {
                try {
                    await Notifications.scheduleNotificationAsync({
                        identifier: `${NOTIFICATION_PREFIX_DEADLINE}${task.id}`,
                        content: {
                            title: task.workspaceName || 'Tasks',
                            body: `Deadline in 1 hour: ${task.content}`,
                            data: {
                                type: 'live_activity',
                                liveActivityType: 'deadlineCountdown',
                                taskId: task.id,
                                categoryId: task.categoryID || '',
                                taskName: task.content,
                                workspaceName: task.workspaceName || 'Tasks',
                                deadline: task.deadline,
                                priority: String(task.priority),
                            },
                            sound: true,
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.DATE,
                            date: new Date(oneHourBefore),
                        },
                    });
                } catch (e) {
                    console.warn('[TaskSync] Failed to schedule deadline notification:', e);
                }
            }
        }
    }
}

/**
 * Schedules local notifications for live activity triggers.
 * Called once on mount from _layout.tsx.
 */
export async function registerBackgroundFetch(): Promise<void> {
    // No-op on initial call — scheduling happens via the hook below
}

/**
 * Hook that schedules local notifications whenever allTasks changes.
 * Notifications use the same data format as backend push notifications,
 * so the existing handler starts live activities automatically.
 */
export function useBackgroundTaskSync(allTasks: Task[]): void {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            scheduleTaskNotifications(allTasks).catch((e) => {
                console.warn('[TaskSync] Failed to schedule notifications:', e);
            });
        }, 1000); // 1s debounce — scheduling is async and involves multiple API calls

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [allTasks]);
}
