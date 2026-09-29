import type { Task, Workspace } from '@/api/types';

// Pure builders for widget payloads. The native SwiftUI views in
// ios/ExpoWidgetsTarget decode these shapes, so keep field names in sync.

export type WidgetTask = {
    id: string;
    title: string;
    workspace: string;
    categoryId: string;
    /** Epoch ms, or 0 when the task has no deadline. */
    dueAt: number;
    overdue: boolean;
    priority: number;
};

export type TodayWidgetProps = {
    completedCount: number;
    remainingCount: number;
    overdueCount: number;
    tasks: WidgetTask[];
};

// `task` is omitted rather than null: widget props land in UserDefaults, which can't hold null.
export type NextTaskWidgetProps = {
    task?: WidgetTask;
    remainingCount: number;
};

export type WorkspaceWidgetProps = {
    workspaceName: string;
    workspaceColor: string;
    pendingCount: number;
    overdueCount: number;
    tasks: WidgetTask[];
};

export type StreakDay = { label: string; level: number; isToday: boolean };

export type StreakWidgetProps = {
    streak: number;
    completedToday: number;
    days: StreakDay[];
};

export type TimelineEntry<T> = { date: Date; props: T };

const MAX_TASKS = 8;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const time = (value?: string): number => {
    if (!value) return NaN;
    return new Date(value).getTime();
};

export function startOfLocalDay(ms: number): number {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

export function nextLocalMidnight(ms: number): number {
    const d = new Date(ms);
    d.setHours(24, 0, 0, 0);
    return d.getTime();
}

function toWidgetTask(task: Task, now: number): WidgetTask {
    const due = time(task.deadline);
    return {
        id: task.id,
        title: task.content,
        workspace: task.workspaceName || 'Tasks',
        categoryId: task.categoryID || '',
        dueAt: Number.isFinite(due) ? due : 0,
        overdue: Number.isFinite(due) && due <= now,
        priority: task.priority ?? 0,
    };
}

/** Overdue first, then by deadline, then undated tasks by priority. */
function compareWidgetTasks(a: WidgetTask, b: WidgetTask): number {
    if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return b.priority - a.priority;
}

/** Tasks that belong on "today": due or starting today, or already overdue. */
export function selectTodayTasks(tasks: Task[], now: number): Task[] {
    const dayStart = startOfLocalDay(now);
    const dayEnd = nextLocalMidnight(now);
    return tasks.filter((task) => {
        // Someday tasks are undated by choice and stay off Today
        if (task.timeCompleted || task.somedayAt) return false;
        const due = time(task.deadline);
        const start = time(task.startDate);
        const dueTodayOrOverdue = Number.isFinite(due) && due < dayEnd;
        const startsToday = Number.isFinite(start) && start >= dayStart && start < dayEnd;
        return dueTodayOrOverdue || startsToday;
    });
}

export function buildTodayProps(tasks: Task[], completedCount: number, now: number): TodayWidgetProps {
    const today = selectTodayTasks(tasks, now)
        .map((t) => toWidgetTask(t, now))
        .sort(compareWidgetTasks);
    return {
        completedCount: Math.max(0, completedCount),
        remainingCount: today.length,
        overdueCount: today.filter((t) => t.overdue).length,
        tasks: today.slice(0, MAX_TASKS),
    };
}

/**
 * Today widget timeline: the current state, a refresh at each of today's
 * remaining deadlines (so tasks flip to overdue with the app closed), then a
 * fresh day at midnight instead of yesterday's list.
 */
export function buildTodayTimeline(
    tasks: Task[],
    completedCount: number,
    now: number,
    maxDeadlineEntries = 8,
): TimelineEntry<TodayWidgetProps>[] {
    const midnight = nextLocalMidnight(now);
    const deadlines = Array.from(
        new Set(
            selectTodayTasks(tasks, now)
                .map((t) => time(t.deadline))
                .filter((due) => due > now && due < midnight),
        ),
    )
        .sort((a, b) => a - b)
        .slice(0, maxDeadlineEntries);

    return [
        { date: new Date(now), props: buildTodayProps(tasks, completedCount, now) },
        ...deadlines.map((at) => ({ date: new Date(at), props: buildTodayProps(tasks, completedCount, at) })),
        { date: new Date(midnight), props: buildTodayProps(tasks, 0, midnight) },
    ];
}

/**
 * Next-task timeline: one entry per upcoming deadline so the lock screen
 * advances to the following task as each one comes due.
 */
export function buildNextTaskTimeline(tasks: Task[], now: number, maxEntries = 6): TimelineEntry<NextTaskWidgetProps>[] {
    const upcoming = tasks
        .filter((t) => !t.timeCompleted && Number.isFinite(time(t.deadline)) && time(t.deadline) > now)
        .map((t) => toWidgetTask(t, now))
        .sort((a, b) => a.dueAt - b.dueAt);
    const propsAt = (at: number, task?: WidgetTask): NextTaskWidgetProps => {
        const remainingCount = selectTodayTasks(tasks, at).length;
        return task ? { task, remainingCount } : { remainingCount };
    };

    const entries: TimelineEntry<NextTaskWidgetProps>[] = [{ date: new Date(now), props: propsAt(now, upcoming[0]) }];
    for (let i = 0; i < upcoming.length && entries.length < maxEntries; i++) {
        const at = upcoming[i].dueAt;
        if (at <= now) continue;
        if (entries.some((e) => e.date.getTime() === at)) continue;
        const next = upcoming.slice(i + 1).find((t) => t.dueAt > at);
        entries.push({ date: new Date(at), props: propsAt(at, next) });
    }
    return entries;
}

/** The workspace with the most open tasks, ignoring blueprints. */
export function buildWorkspaceProps(workspaces: Workspace[], now: number): WorkspaceWidgetProps | null {
    const candidates = workspaces.filter((w) => !w.isBlueprint);
    if (candidates.length === 0) return null;

    let best: { workspace: Workspace; tasks: WidgetTask[] } | null = null;
    for (const workspace of candidates) {
        const tasks = workspace.categories
            .flatMap((c) =>
                c.tasks
                    .filter((t) => !t.timeCompleted)
                    .map((t) => toWidgetTask({ ...t, workspaceName: workspace.name, categoryID: t.categoryID || c.id }, now)),
            )
            .sort(compareWidgetTasks);
        if (!best || tasks.length > best.tasks.length) best = { workspace, tasks };
    }
    if (!best) return null;

    return {
        workspaceName: best.workspace.name,
        workspaceColor: best.workspace.color || '',
        pendingCount: best.tasks.length,
        overdueCount: best.tasks.filter((t) => t.overdue).length,
        tasks: best.tasks.slice(0, MAX_TASKS),
    };
}

/** `levels` holds the last 7 days oldest-first, ending today. */
export function buildStreakProps(
    streak: number,
    completedToday: number,
    levels: number[],
    now: number,
): StreakWidgetProps {
    const padded = [...new Array(Math.max(0, 7 - levels.length)).fill(0), ...levels].slice(-7);
    const today = new Date(now).getDay();
    const days = padded.map((level, i) => {
        const offset = 6 - i;
        return {
            label: DAY_LABELS[(today - offset + 7) % 7],
            level: Math.max(0, Math.min(4, Math.round(level))),
            isToday: offset === 0,
        };
    });
    // Today's bar should reflect completions the server may not have tallied yet
    if (completedToday > 0 && days[6].level === 0) days[6].level = 1;
    return { streak: Math.max(0, streak), completedToday: Math.max(0, completedToday), days };
}
