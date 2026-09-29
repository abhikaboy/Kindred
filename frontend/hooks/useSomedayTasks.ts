import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/api/types";
import { getSomedayTasksAPI } from "@/api/plan";
import { useTasks } from "@/contexts/tasksContext";

/** A Someday task has somedayAt set and no dates. */
export function isSomedayTask(task: Pick<Task, "somedayAt" | "deadline" | "startDate"> | null | undefined): boolean {
    return !!task?.somedayAt && !task.deadline && !task.startDate;
}

/** Stable sort that sinks Someday tasks below dated/regular tasks, keeping order otherwise. */
export function sinkSomeday<T extends Pick<Task, "somedayAt" | "deadline" | "startDate">>(tasks: T[]): T[] {
    if (!tasks.some(isSomedayTask)) return tasks;
    return [...tasks.filter((t) => !isSomedayTask(t)), ...tasks.filter(isSomedayTask)];
}

export type SomedayGroup = { workspace: string; tasks: Task[] };

/**
 * Groups Someday tasks by home workspace. Workspaces follow `workspaceOrder`
 * (unknown ones after, alphabetically); tasks within a group are oldest-saved first.
 */
export function groupSomedayByWorkspace(tasks: Task[], workspaceOrder: string[] = []): SomedayGroup[] {
    const groups = new Map<string, Task[]>();
    for (const task of tasks) {
        if (!isSomedayTask(task)) continue;
        const name = task.workspaceName || "Other";
        const list = groups.get(name) ?? [];
        list.push(task);
        groups.set(name, list);
    }
    const rank = (name: string) => {
        const i = workspaceOrder.indexOf(name);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const at = (t: Task) => (t.somedayAt ? new Date(t.somedayAt).getTime() || 0 : 0);
    return Array.from(groups.entries())
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
        .map(([workspace, list]) => ({ workspace, tasks: list.slice().sort((x, y) => at(x) - at(y)) }));
}

/**
 * Merges live context tasks with a server fallback. Live tasks win; fallback
 * tasks are only used when the context doesn't know the task at all, so local
 * changes (planned, dated, cleared) take effect immediately.
 */
export function mergeSomedayTasks(live: Task[], fallback: Task[]): Task[] {
    const known = new Set(live.map((t) => t.id));
    return [...live.filter(isSomedayTask), ...fallback.filter((t) => !known.has(t.id) && isSomedayTask(t))];
}

/** Someday tasks from every workspace, kept live against the tasks context. */
export function useSomedayTasks() {
    const { allTasks, workspaces, fetchingWorkspaces } = useTasks();
    const [fallback, setFallback] = useState<Task[]>([]);

    const liveHasAny = useMemo(() => allTasks.some(isSomedayTask), [allTasks]);

    // Only hit the server when the context has nothing (e.g. an older snapshot without somedayAt).
    useEffect(() => {
        if (liveHasAny || fetchingWorkspaces) return;
        let cancelled = false;
        getSomedayTasksAPI()
            .then((res) => {
                if (!cancelled) setFallback(res as unknown as Task[]);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [liveHasAny, fetchingWorkspaces]);

    const groups = useMemo(() => {
        const order = workspaces.filter((w) => !w.isBlueprint).map((w) => w.name);
        const byCategory = new Map<string, string>();
        workspaces.forEach((w) => w.categories.forEach((c) => byCategory.set(c.id, w.name)));
        const fill = fallback.map((t) =>
            t.workspaceName ? t : { ...t, workspaceName: byCategory.get(t.categoryID ?? "") }
        );
        return groupSomedayByWorkspace(mergeSomedayTasks(allTasks, fill), order);
    }, [allTasks, fallback, workspaces]);

    return { groups, loading: fetchingWorkspaces && groups.length === 0 };
}
