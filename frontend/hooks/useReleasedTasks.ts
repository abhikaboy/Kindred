import { useCallback, useEffect, useState } from "react";
import type { Task } from "@/api/types";
import { getReleasedTasksAPI, unreleaseTaskAPI } from "@/api/plan";
import { useTasks } from "@/contexts/tasksContext";
import { showToast } from "@/utils/showToast";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";

const DAY_MS = 86400_000;

/** Newest release first; tasks without a timestamp sink to the bottom. */
export function sortReleasedNewestFirst<T extends { releasedAt?: string | null }>(tasks: T[]): T[] {
    const at = (t: T) => (t.releasedAt ? new Date(t.releasedAt).getTime() || 0 : 0);
    return tasks.slice().sort((a, b) => at(b) - at(a));
}

/** Quiet caption for a released row, e.g. "Released 3 days ago". */
export function releasedAgoLabel(releasedAt: string | null | undefined, now: Date = new Date()): string {
    if (!releasedAt) return "Released";
    const then = new Date(releasedAt);
    if (isNaN(then.getTime())) return "Released";
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.max(0, Math.round((startOf(now) - startOf(then)) / DAY_MS));
    if (days === 0) return "Released today";
    if (days === 1) return "Released yesterday";
    if (days < 7) return `Released ${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (days < 30) return weeks === 1 ? "Released a week ago" : `Released ${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? "Released a month ago" : `Released ${months} months ago`;
    return "Released over a year ago";
}

/** Loads released tasks and brings them back optimistically. */
export function useReleasedTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { addToCategory, removeFromCategory } = useTasks();
    const { capture } = useAnalytics();

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await getReleasedTasksAPI();
            setTasks(sortReleasedNewestFirst(res as unknown as Task[]));
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const bringBack = useCallback(
        async (task: Task) => {
            const categoryId = task.categoryID ?? "";
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
            addToCategory(categoryId, { ...task, releasedAt: null });
            showToast("Back on your plate.", "success");
            capture(AnalyticsEvents.TASK_UNRELEASED);
            try {
                await unreleaseTaskAPI(categoryId, task.id);
            } catch {
                // Roll back quietly; the task stays safely released.
                removeFromCategory(categoryId, task.id);
                setTasks((prev) => sortReleasedNewestFirst([...prev, task]));
                showToast("Couldn't bring that back. Try again in a moment.", "warning");
            }
        },
        [addToCategory, removeFromCategory, capture]
    );

    return { tasks, loading, error, reload: load, bringBack };
}

/** Fog candidates the user left ticked, shaped for releaseTasksBulkAPI. */
export function fogReleaseItems(
    candidates: { id: string; categoryID?: string }[],
    keepIds: Set<string>
): { categoryId: string; taskId: string }[] {
    return candidates
        .filter((t) => !keepIds.has(t.id) && !!t.categoryID)
        .map((t) => ({ categoryId: t.categoryID as string, taskId: t.id }));
}
