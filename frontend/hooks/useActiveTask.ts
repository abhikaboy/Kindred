import { useMemo } from "react";
import { useTasksSelector } from "@/contexts/tasksContext";
import type { Task } from "@/api/types";

export type ActiveEntry = { task: Task; categoryId: string; categoryName: string; workspaceName: string; workspaceIcon?: string | null };

// Most recently started in-progress task, or null.
export function useActiveTask(): ActiveEntry | null {
    const workspaces = useTasksSelector((s) => s.workspaces);
    return useMemo(() => {
        let best: ActiveEntry | null = null;
        const startOf = (t: Task) => (t.workingOnSince ? new Date(t.workingOnSince).getTime() : 0);
        for (const ws of workspaces) {
            for (const category of ws.categories) {
                for (const task of category.tasks ?? []) {
                    if (!task.active) continue;
                    if (!best || startOf(task) > startOf(best.task)) {
                        best = { task, categoryId: category.id, categoryName: category.name, workspaceName: ws.name, workspaceIcon: ws.icon };
                    }
                }
            }
        }
        return best;
    }, [workspaces]);
}
