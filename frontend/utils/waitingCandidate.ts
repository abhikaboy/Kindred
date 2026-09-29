// Picks the single waiting task worth offering a gentle path forward.
// One at a time on purpose: a wall of late tasks freezes, one next step starts.

const DAY_MS = 86400_000;
export const SEVERE_WAIT_DAYS = 7;
export const SEVERE_RESCHEDULES = 3;
export const PARK_QUIET_DAYS = 7;
export const FOG_THRESHOLD = 5;
export const FOG_MIN_AGE_DAYS = 14;

export type WaitingTask = {
    id: string;
    deadline?: string;
    startDate?: string;
    priority?: number;
    rescheduleCount?: number;
    plan?: { at?: string } | null;
    parkedAt?: string | null;
    releasedAt?: string | null;
};

const startOfDay = (d: Date) => {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
};

/** When a task began waiting: its deadline day, or its start day when undated. */
export function waitingSince(task: WaitingTask): Date | null {
    const iso = task.deadline ?? task.startDate;
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : startOfDay(d);
}

export function daysWaiting(task: WaitingTask, now: Date = new Date()): number {
    const since = waitingSince(task);
    if (!since) return 0;
    return Math.max(0, Math.floor((startOfDay(now).getTime() - since.getTime()) / DAY_MS));
}

/** In plan means a soft commit that hasn't passed yet; a passed plan rolls back to waiting. */
export function isInPlan(task: WaitingTask, now: Date = new Date()): boolean {
    const at = task.plan?.at ? new Date(task.plan.at) : null;
    return !!at && startOfDay(at) >= startOfDay(now);
}

/** A plan whose day went by without a start: offer "Replan or release?", nothing louder. */
export function isPassedPlan(task: WaitingTask, now: Date = new Date()): boolean {
    const at = task.plan?.at ? new Date(task.plan.at) : null;
    return !!at && startOfDay(at) < startOfDay(now);
}

export function isSevere(task: WaitingTask, now: Date = new Date()): boolean {
    return daysWaiting(task, now) >= SEVERE_WAIT_DAYS || (task.rescheduleCount ?? 0) >= SEVERE_RESCHEDULES;
}

type Options = { now?: Date; snoozedIds?: Set<string> };

export function pickWaitingCandidate(tasks: WaitingTask[], { now = new Date(), snoozedIds }: Options = {}) {
    const eligible = tasks.filter((t) => {
        if (t.releasedAt || isInPlan(t, now) || snoozedIds?.has(t.id)) return false;
        if (t.parkedAt && now.getTime() - new Date(t.parkedAt).getTime() < PARK_QUIET_DAYS * DAY_MS) return false;
        return isSevere(t, now);
    });
    // Oldest first, then higher priority
    eligible.sort((a, b) => daysWaiting(b, now) - daysWaiting(a, now) || (b.priority ?? 0) - (a.priority ?? 0));
    return eligible[0] ?? null;
}

/** Tasks "Clear the fog" offers to release; empty unless the waiting pile is past the threshold. */
export function fogCandidates(tasks: WaitingTask[], now: Date = new Date()): WaitingTask[] {
    const waiting = tasks.filter((t) => !t.releasedAt && !isInPlan(t, now));
    if (waiting.length <= FOG_THRESHOLD) return [];
    return waiting.filter((t) => daysWaiting(t, now) >= FOG_MIN_AGE_DAYS);
}
