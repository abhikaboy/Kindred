import type { RingKey } from "./rings";

// Structural shapes so mobile and desktop can pass their generated API types straight in.
export type ActivityTask = {
    id: string;
    content: string;
    categoryID?: string;
    active?: boolean;
    workingOnSince?: string;
    startedAt?: string;
    timeCompleted?: string;
};

type RingFlag = { closed: boolean };
export type ActivityRings = { all_closed: boolean; plan: RingFlag; do: RingFlag; share: RingFlag };

export type ActivityProfile<T extends ActivityTask = ActivityTask> = {
    tasks?: T[];
    completed_tasks?: T[];
    ring_state?: ActivityRings;
};

export type Activity<T extends ActivityTask = ActivityTask> =
    | { kind: "working"; task: T; since?: string }
    | { kind: "finished"; task: T; since?: string }
    | { kind: "idle" };

export type ActivityKind = Activity["kind"];

export const RING_KEYS: RingKey[] = ["plan", "do", "share"];
export const RING_NAMES: Record<RingKey, string> = { plan: "Plan", do: "Do", share: "Share" };
export const RING_NUDGE_LABELS: Record<RingKey, string> = {
    plan: "Plan their day",
    do: "Get their tasks done",
    share: "Share something",
};
export const RING_ENCOURAGE_MESSAGES: Record<RingKey, string> = {
    plan: "Plan out your day and close that ring!",
    do: "Finish up those tasks, you're almost there!",
    share: "Post something or send some kudos to close the ring!",
};

export function isToday(iso: string | undefined, now: Date = new Date()): boolean {
    return !!iso && new Date(iso).toDateString() === now.toDateString();
}

export function shortElapsed(iso: string | undefined, now: Date = new Date()): string {
    if (!iso) return "";
    const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
}

export function getActivity<T extends ActivityTask>(profile: ActivityProfile<T> | undefined, now: Date = new Date()): Activity<T> {
    const working = (profile?.tasks ?? []).find((t) => t.workingOnSince || t.active);
    if (working) return { kind: "working", task: working, since: working.workingOnSince ?? working.startedAt };
    const finished = (profile?.completed_tasks ?? [])
        .filter((t) => isToday(t.timeCompleted, now))
        .sort((a, b) => (b.timeCompleted ?? "").localeCompare(a.timeCompleted ?? ""))[0];
    if (finished) return { kind: "finished", task: finished, since: finished.timeCompleted };
    return { kind: "idle" };
}

/** One-line status, e.g. "Working on Essay · for 12m". */
export function activityStatus(activity: Activity, rings: ActivityRings | undefined, now: Date = new Date()): string {
    if (activity.kind === "working") {
        return `Working on ${activity.task.content}` + (activity.since ? ` · for ${shortElapsed(activity.since, now)}` : "");
    }
    if (activity.kind === "finished") {
        return `Finished ${activity.task.content}` + (activity.since ? ` · ${shortElapsed(activity.since, now)} ago` : "");
    }
    return rings?.all_closed ? "Closed every ring today" : "Quiet so far today";
}

const ACTIVITY_RANK: Record<ActivityKind, number> = { working: 0, finished: 1, idle: 2 };
// Idle friends get no heading; they simply follow the active ones.
export const SECTION_TITLES: Record<ActivityKind, string | null> = { working: "Active now", finished: "Earlier today", idle: null };

const sinceOf = (a: Activity) => (a.kind === "idle" ? "" : a.since ?? "");

/** Working, then finished, then idle; newest first within each. Stable for ties. */
export function sortByActivity<R extends { activity: Activity }>(rows: R[]): R[] {
    return [...rows].sort((a, b) => {
        const rank = ACTIVITY_RANK[a.activity.kind] - ACTIVITY_RANK[b.activity.kind];
        return rank || sinceOf(b.activity).localeCompare(sinceOf(a.activity));
    });
}

export type ActivitySection<R> = { kind: ActivityKind; title: string | null; data: R[] };

export function groupByActivity<R extends { activity: Activity }>(rows: R[]): ActivitySection<R>[] {
    const sorted = sortByActivity(rows);
    return (["working", "finished", "idle"] as const)
        .map((kind) => ({ kind, title: SECTION_TITLES[kind], data: sorted.filter((r) => r.activity.kind === kind) }))
        .filter((section) => section.data.length > 0);
}

export type SupportKind = "nudge" | "congratulate";
// `variant` lets each platform pick its own icon; `ring` picks the ring color.
export type SupportOption<T extends ActivityTask = ActivityTask> = {
    id: string;
    label: string;
    message: string;
    variant: "working" | "pending" | "ring" | "completed" | "all";
    ring?: RingKey;
    task?: T;
    taskName?: string;
};

export function buildOptions<T extends ActivityTask>(
    kind: SupportKind,
    profile: ActivityProfile<T> | undefined,
    now: Date = new Date()
): SupportOption<T>[] {
    const rings = profile?.ring_state;
    const options: SupportOption<T>[] = [];
    if (kind === "nudge") {
        const tasks = (profile?.tasks ?? []).filter((t) => !t.timeCompleted);
        const working = tasks.filter((t) => t.workingOnSince || t.active);
        const pending = tasks.filter((t) => !(t.workingOnSince || t.active));
        working.slice(0, 2).forEach((task) =>
            options.push({ id: `task-${task.id}`, label: `Keep going on ${task.content}`, message: "You've got this, keep going!", variant: "working", task })
        );
        pending.slice(0, 2).forEach((task) =>
            options.push({ id: `task-${task.id}`, label: `Finish ${task.content}`, message: "Go knock this one out!", variant: "pending", task })
        );
        if (rings)
            RING_KEYS.filter((k) => !rings[k].closed).forEach((k) =>
                options.push({ id: `ring-${k}`, label: RING_NUDGE_LABELS[k], message: RING_ENCOURAGE_MESSAGES[k], variant: "ring", ring: k })
            );
    } else {
        (profile?.completed_tasks ?? [])
            .filter((t) => isToday(t.timeCompleted, now))
            .slice(0, 3)
            .forEach((task) =>
                options.push({ id: `task-${task.id}`, label: `Finishing ${task.content}`, message: "Nice work getting that done!", variant: "completed", task, taskName: task.content })
            );
        if (rings?.all_closed)
            options.push({ id: "ring-all", label: "Closing every ring", message: "Every ring closed today. Incredible!", variant: "all", taskName: "Closing every ring" });
        else if (rings)
            RING_KEYS.filter((k) => rings[k].closed).forEach((k) =>
                options.push({
                    id: `ring-${k}`,
                    label: `Closing their ${RING_NAMES[k]} ring`,
                    message: `Way to close your ${RING_NAMES[k]} ring!`,
                    variant: "ring",
                    ring: k,
                    taskName: `${RING_NAMES[k]} ring`,
                })
            );
    }
    return options;
}
