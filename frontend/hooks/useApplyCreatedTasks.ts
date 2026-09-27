import { useCallback, useRef } from "react";
import { useTaskActions, useTasksSelector } from "@/contexts/tasksContext";
import type { Task, Workspace } from "@/api/types";
import type { NaturalLanguageTaskCreationResponse } from "@/api/task";
import { logger } from "@/utils/logger";

// Joined so the selector returns a primitive: the host only re-renders when the
// set of categories changes, not on every task edit.
const categoryIdsKey = (workspaces: Workspace[]) =>
    workspaces.map((ws) => ws.categories.map((c) => c.id).join(",")).join(",");

/**
 * Applies server-created tasks to the local workspace tree instead of
 * refetching the whole thing. Falls back to a background refetch only when the
 * response references something the client can't build locally (a category
 * the server just created, or a recurring template).
 */
export function useApplyCreatedTasks() {
    const { addToCategory, addToWorkspace, addWorkspace, doesWorkspaceExist, fetchWorkspaces } = useTaskActions();
    const idsKey = useTasksSelector((s) => categoryIdsKey(s.workspaces));
    const knownRef = useRef<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
    if (knownRef.current.key !== idsKey) {
        knownRef.current = { key: idsKey, ids: new Set(idsKey ? idsKey.split(",") : []) };
    }

    const refreshInBackground = useCallback(() => {
        fetchWorkspaces(true).catch((error) => logger.error("Background workspace refresh failed", error));
    }, [fetchWorkspaces]);

    const applyCreatedTask = useCallback(
        (created: Task & { ringDelta?: unknown }) => {
            const { ringDelta, ...task } = created;
            const categoryId = task.categoryID;
            if (categoryId && knownRef.current.ids.has(categoryId)) {
                addToCategory(categoryId, task as Task);
            } else {
                // e.g. the Inbox was created server-side on first use
                refreshInBackground();
            }
        },
        [addToCategory, refreshInBackground]
    );

    const applyNaturalLanguageResult = useCallback(
        (result: NaturalLanguageTaskCreationResponse) => {
            const known = new Set(knownRef.current.ids);
            const createdWorkspaces = new Set<string>();
            for (const cat of result.newCategories ?? []) {
                if (known.has(cat.id)) continue;
                const category = { id: cat.id, name: cat.name, tasks: [], tags: [] };
                if (createdWorkspaces.has(cat.workspaceName) || doesWorkspaceExist(cat.workspaceName)) {
                    addToWorkspace(cat.workspaceName, category);
                } else {
                    addWorkspace(cat.workspaceName, category);
                    createdWorkspaces.add(cat.workspaceName);
                }
                known.add(cat.id);
            }

            let needsRefresh = false;
            for (const task of (result.tasks ?? []) as unknown as Task[]) {
                if (task.categoryID && known.has(task.categoryID)) {
                    addToCategory(task.categoryID, task);
                } else {
                    needsRefresh = true;
                }
                // Recurring tasks get a server-side template the phantom-task
                // projection needs.
                if (task.recurring) needsRefresh = true;
            }
            if (needsRefresh) refreshInBackground();
        },
        [addToCategory, addToWorkspace, addWorkspace, doesWorkspaceExist, refreshInBackground]
    );

    return { applyCreatedTask, applyNaturalLanguageResult };
}
