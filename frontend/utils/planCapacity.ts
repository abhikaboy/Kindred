// Pure, so tests can load it without native modules.
import type { Task } from "@/api/types";

/** A day with this many timed or planned tasks is full. */
export const PLAN_DAY_CAPACITY = 3;

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** When a task is expected to happen: its plan time, else its start time. */
export function taskMoment(task: Task): Date | null {
    const raw = task.plan?.at ?? task.startTime;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

/** Open, timed or planned tasks on `day`, excluding parked, released, completed and `excludeId`. */
export function tasksOnDay(allTasks: Task[], day: Date, excludeId?: string): Task[] {
    const seen = new Set<string>();
    return allTasks.filter((t) => {
        if (!t || t.id === excludeId || seen.has(t.id)) return false;
        if (t.parkedAt || t.releasedAt || t.timeCompleted || t.isPhantom) return false;
        const m = taskMoment(t);
        if (!m || !sameDay(m, day)) return false;
        seen.add(t.id);
        return true;
    });
}

export function isDayFull(allTasks: Task[], day: Date, excludeId?: string): boolean {
    return tasksOnDay(allTasks, day, excludeId).length >= PLAN_DAY_CAPACITY;
}
