import { dayKey } from "@/utils/taskCountsByDay";

const MAX_STEPS = 500;
const DATE_FIELDS = ["startDate", "startTime", "deadline"] as const;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lastDayOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

// The date the backend recurs from, per recurType (see calculateNextRecurrence in task/util.go)
const anchorOf = (task: any): Date | null => {
    const raw =
        task.recurType === "DEADLINE"
            ? task.deadline
            : task.startDate ?? task.startTime ?? task.deadline;
    return raw ? startOfDay(new Date(raw)) : null;
};

/** Next occurrence day after `day`, mirroring the backend's rules. */
const nextDay = (task: any, day: Date): Date | null => {
    const details = task.recurDetails ?? {};
    const every = Math.max(1, details.every ?? 1);
    switch (task.recurFrequency) {
        case "daily":
            return addDays(day, every);
        case "weekly": {
            const dow: number[] | undefined = details.daysOfWeek;
            for (let i = 1; i <= 7; i++) {
                const d = addDays(day, i);
                if (dow?.[d.getDay()] === 1) return d;
            }
            return addDays(day, 7 * every);
        }
        case "monthly": {
            const days: number[] = [...(details.daysOfMonth ?? [day.getDate()])].sort((a, b) => a - b);
            const inMonth = (y: number, m: number) =>
                days.map((n) => new Date(y, m, Math.min(n, lastDayOfMonth(y, m))));
            const later = inMonth(day.getFullYear(), day.getMonth()).find((d) => d > day);
            if (later) return later;
            const target = new Date(day.getFullYear(), day.getMonth() + every, 1);
            return inMonth(target.getFullYear(), target.getMonth())[0] ?? null;
        }
        case "yearly":
            return new Date(day.getFullYear() + every, day.getMonth(), day.getDate());
        default:
            return null;
    }
};

const shift = (iso: string | undefined, days: number) => {
    if (!iso) return iso;
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString();
};

/**
 * Display-only copies of upcoming recurrences that fall in [start, end]. Each copy has
 * `projected: true` and `sourceId` pointing at the real task; nothing is persisted.
 */
export function projectRecurringTasks(tasks: any[], start: Date, end: Date): any[] {
    const rangeStart = startOfDay(start);
    const rangeEnd = startOfDay(end);

    // Recur from the latest live instance of each template; skip days one already covers
    const latest = new Map<string, { task: any; anchor: Date }>();
    const taken = new Set<string>();
    for (const task of tasks) {
        if (!task.recurring || task.recurType === "FLEX" || !task.recurFrequency) continue;
        const anchor = anchorOf(task);
        if (!anchor) continue;
        const key = task.templateID ?? task.id;
        taken.add(`${key}|${dayKey(anchor)}`);
        const prev = latest.get(key);
        if (!prev || anchor > prev.anchor) latest.set(key, { task, anchor });
    }

    const out: any[] = [];
    for (const [key, { task, anchor }] of latest) {
        let day: Date | null = anchor;
        for (let i = 0; i < MAX_STEPS && day; i++) {
            day = nextDay(task, day);
            if (!day || day > rangeEnd) break;
            if (day < rangeStart || taken.has(`${key}|${dayKey(day)}`)) continue;
            const offset = Math.round((day.getTime() - anchor.getTime()) / 86400000);
            const copy: any = { ...task, id: `${task.id}@${dayKey(day)}`, sourceId: task.id, projected: true };
            for (const field of DATE_FIELDS) copy[field] = shift(task[field], offset);
            out.push(copy);
        }
    }
    return out;
}
