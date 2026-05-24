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

async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    initialized = true;

    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const storedIds: string[] = stored ? JSON.parse(stored) : [];

        const activeInstances = ActiveTaskActivityFactory.getInstances();
        const deadlineInstances = DeadlineCountdownActivityFactory.getInstances();
        const hasNativeInstances = activeInstances.length > 0 || deadlineInstances.length > 0;

        if (hasNativeInstances && storedIds.length > 0) {
            for (const id of storedIds) {
                activeActivities.set(id, {
                    instance: { update: () => Promise.resolve(), end: () => Promise.resolve() },
                    intervalId: setTimeout(() => {}, 0),
                });
            }
        } else {
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
