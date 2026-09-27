import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ActiveTaskActivityFactory,
    DeadlineCountdownActivityFactory,
} from '@/widgets/widgetUpdaters';
import type { ActiveTaskActivityProps } from '@/widgets/ActiveTaskActivity';
import type { DeadlineCountdownProps } from '@/widgets/DeadlineCountdownActivity';
import { brandMarkUri } from '@/utils/liveActivityBrandMark';

const STORAGE_KEY = '@kindred/active-live-activities';
const DISMISSED_KEY = '@kindred/dismissed-live-activities';
const MAX_DISMISSED = 100;
const OVERDUE_GRACE_MS = 30 * 60 * 1000;

type ActivityType = 'active' | 'deadline';

type ActivityInstance = {
    update: (props: any) => Promise<void>;
    end: (policy?: string) => Promise<void>;
};

type ActivityEntry = {
    type: ActivityType;
    instance: ActivityInstance;
    intervalId?: ReturnType<typeof setInterval>;
    deadline?: string;
};

type StoredEntry = { taskId: string; type: ActivityType; deadline?: string };

export type StartOptions = { userInitiated?: boolean };

const factories = {
    active: ActiveTaskActivityFactory,
    deadline: DeadlineCountdownActivityFactory,
};

const activeActivities = new Map<string, ActivityEntry>();
// "type:taskId" keys the user dismissed, so the scheduler doesn't bring them back
let dismissed: string[] = [];
let initialized: Promise<void> | null = null;

export const DEADLINE_COLORS = {
    upcoming: '#854DFF',
    soon: '#FFB020',
    overdue: '#FF5C5F',
};

/** Accent and label for a deadline activity at a given moment. */
export function deadlineStatus(deadlineMs: number, now: number): Pick<DeadlineCountdownProps, 'accentColor' | 'statusLabel'> {
    const remaining = deadlineMs - now;
    if (remaining <= 0) return { accentColor: DEADLINE_COLORS.overdue, statusLabel: 'Overdue' };
    if (remaining <= 10 * 60 * 1000) return { accentColor: DEADLINE_COLORS.soon, statusLabel: 'Due soon' };
    return { accentColor: DEADLINE_COLORS.upcoming, statusLabel: 'Upcoming' };
}

// iOS keeps activities alive across app launches. Re-attach to the real native
// instance so a later endActivity() actually removes it from the lock screen.
// Each type allows one activity at a time, so type identifies the instance.
function ensureInitialized(): Promise<void> {
    if (!initialized) initialized = hydrate();
    return initialized;
}

async function hydrate(): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown[] = raw ? JSON.parse(raw) : [];
        const stored = parsed.filter(
            (e): e is StoredEntry => typeof e === 'object' && e !== null && 'taskId' in e && 'type' in e,
        );
        for (const { taskId, type, deadline } of stored) {
            const instance = factories[type]?.getInstances()[0];
            if (instance) activeActivities.set(taskId, { type, instance, deadline });
        }
        const rawDismissed = await AsyncStorage.getItem(DISMISSED_KEY);
        const parsedDismissed: unknown = rawDismissed ? JSON.parse(rawDismissed) : [];
        dismissed = Array.isArray(parsedDismissed) ? parsedDismissed.filter((k) => typeof k === 'string') : [];
    } catch (e) {
        console.warn('[LiveActivityManager] Failed to hydrate state:', e);
    }
    await persist();
}

async function persist(): Promise<void> {
    const entries: StoredEntry[] = Array.from(activeActivities, ([taskId, { type, deadline }]) =>
        deadline ? { taskId, type, deadline } : { taskId, type },
    );
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    } catch (e) {
        console.warn('[LiveActivityManager] Failed to persist activities:', e);
    }
}

function forget(taskId: string): void {
    const entry = activeActivities.get(taskId);
    if (entry?.intervalId) clearInterval(entry.intervalId);
    activeActivities.delete(taskId);
}

// Starting a new activity of a type replaces the old one natively, so drop
// our record of it too; otherwise it would block restarting that task later.
function forgetType(type: ActivityType): void {
    for (const [taskId, entry] of activeActivities) {
        if (entry.type === type) forget(taskId);
    }
}

const dismissKey = (type: ActivityType, taskId: string) => `${type}:${taskId}`;

function markDismissed(type: ActivityType, taskId: string): void {
    const key = dismissKey(type, taskId);
    dismissed = [...dismissed.filter((k) => k !== key), key].slice(-MAX_DISMISSED);
}

// Returns false when the scheduler should stay away; an explicit user start clears the dismissal.
function allowStart(type: ActivityType, taskId: string, opts?: StartOptions): boolean {
    const key = dismissKey(type, taskId);
    if (opts?.userInitiated) {
        dismissed = dismissed.filter((k) => k !== key);
        return true;
    }
    return !dismissed.includes(key);
}

export function isActivityRunning(taskId: string): boolean {
    return activeActivities.has(taskId);
}

export async function tryStartActiveTaskActivity(
    taskId: string,
    props: ActiveTaskActivityProps,
    opts?: StartOptions,
): Promise<boolean> {
    await ensureInitialized();
    if (activeActivities.has(taskId)) return false;
    if (!allowStart('active', taskId, opts)) return false;

    try {
        const mark = await brandMarkUri();
        forgetType('active');
        const instance = ActiveTaskActivityFactory.start(mark ? { ...props, brandMarkUri: mark } : props);
        activeActivities.set(taskId, { type: 'active', instance });
        await persist();
        return true;
    } catch (e) {
        console.error('[LiveActivityManager] Failed to start active task activity:', e);
        return false;
    }
}

export type DeadlineActivityInput = Omit<DeadlineCountdownProps, 'accentColor' | 'statusLabel' | 'brandMarkUri'>;

export async function tryStartDeadlineActivity(
    taskId: string,
    props: DeadlineActivityInput,
    opts?: StartOptions,
): Promise<boolean> {
    await ensureInitialized();
    if (activeActivities.has(taskId)) return false;
    if (!allowStart('deadline', taskId, opts)) return false;

    try {
        const deadlineMs = new Date(props.deadline).getTime();
        const mark = await brandMarkUri();
        forgetType('deadline');
        let current: DeadlineCountdownProps = { ...props, ...deadlineStatus(deadlineMs, Date.now()), ...(mark ? { brandMarkUri: mark } : {}) };
        const instance = DeadlineCountdownActivityFactory.start(current);

        // Only runs while the app is foregrounded; the countdown itself is a
        // native timer, so a stale status label is the worst case.
        const intervalId = setInterval(() => {
            const now = Date.now();
            const status = deadlineStatus(deadlineMs, now);
            if (status.statusLabel !== current.statusLabel) {
                current = { ...current, ...status };
                instance.update(current).catch(() => {});
            }
            if (now - deadlineMs >= OVERDUE_GRACE_MS) endActivity(taskId);
        }, 30 * 1000);

        activeActivities.set(taskId, { type: 'deadline', instance, intervalId, deadline: props.deadline });
        await persist();
        return true;
    } catch (e) {
        console.error('[LiveActivityManager] Failed to start deadline activity:', e);
        return false;
    }
}

export async function endActivity(taskId: string, policy: 'default' | 'immediate' = 'default'): Promise<void> {
    await ensureInitialized();
    const entry = activeActivities.get(taskId);
    if (!entry) return;

    forget(taskId);
    try {
        await entry.instance.end(policy);
    } catch (e) {
        console.warn('[LiveActivityManager] Failed to end activity:', e);
    }
    await persist();
}

/** User asked to hide it: remove now and keep the scheduler from restarting it. */
export async function dismissActivity(taskId: string): Promise<void> {
    await ensureInitialized();
    const entry = activeActivities.get(taskId);
    if (!entry) return;
    markDismissed(entry.type, taskId);
    await endActivity(taskId, 'immediate');
}

export type ReconcileTask = { id: string; deadline?: string | null; timeCompleted?: string | null };

/**
 * Ends activities whose task was completed, deleted, lost its deadline, or is long overdue.
 * Activities the user swiped off the lock screen are forgotten and treated as dismissed.
 */
export async function reconcileActivities(tasks: ReconcileTask[], now = Date.now()): Promise<void> {
    await ensureInitialized();
    // An empty list usually means tasks haven't loaded yet, not that everything was deleted
    if (tasks.length === 0 || activeActivities.size === 0) return;

    const byId = new Map(tasks.map((t) => [t.id, t]));
    let changed = false;

    for (const [taskId, entry] of Array.from(activeActivities)) {
        // Samples from the dev Live Activity lab have no backing task
        if (__DEV__ && taskId === 'dev-sample') continue;
        if (factories[entry.type].getInstances().length === 0) {
            forget(taskId);
            markDismissed(entry.type, taskId);
            changed = true;
            continue;
        }

        const task = byId.get(taskId);
        const deadlineMs = task?.deadline ? new Date(task.deadline).getTime() : NaN;
        const stale =
            !task ||
            !!task.timeCompleted ||
            (entry.type === 'deadline' &&
                (!task.deadline ||
                    (entry.deadline !== undefined && entry.deadline !== task.deadline) ||
                    now - deadlineMs >= OVERDUE_GRACE_MS));

        if (stale) await endActivity(taskId, 'immediate');
    }

    if (changed) await persist();
}
