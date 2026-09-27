import { Workspace, Task } from "@/api/types";
import { updateCategories } from "@/utils/workspaceTree";

/**
 * Pure reducer: move a task from one category to another (at `targetIndex`,
 * default the TOP), across the workspace tree. Returns a new array (no
 * mutation) that shares every untouched workspace/category. No-op (returns the
 * same reference) when source === target or when the task cannot be located.
 */
export function moveTaskInWorkspaces(
    workspaces: Workspace[],
    sourceCategoryId: string,
    taskId: string,
    targetCategoryId: string,
    targetIndex: number = 0
): Workspace[] {
    if (sourceCategoryId === targetCategoryId) return workspaces;

    let moving: Task | undefined;
    for (const ws of workspaces) {
        for (const category of ws.categories) {
            if (category.id === sourceCategoryId) {
                moving = category.tasks.find((t) => t.id === taskId);
            }
        }
    }
    if (!moving) return workspaces;
    const movingTask = moving;

    return updateCategories(
        workspaces,
        (category) => category.id === sourceCategoryId || category.id === targetCategoryId,
        (category) => {
            if (category.id === sourceCategoryId) {
                return { ...category, tasks: category.tasks.filter((t) => t.id !== taskId) };
            }
            const placed: Task = { ...movingTask, categoryName: category.name };
            const tasks = category.tasks.slice();
            tasks.splice(Math.max(0, Math.min(targetIndex, tasks.length)), 0, placed);
            return { ...category, tasks };
        }
    );
}

/** Index of a task within its category, or -1. */
export function findTaskIndex(workspaces: Workspace[], categoryId: string, taskId: string): number {
    for (const ws of workspaces) {
        for (const category of ws.categories) {
            if (category.id === categoryId) {
                const index = category.tasks.findIndex((t) => t.id === taskId);
                if (index !== -1) return index;
            }
        }
    }
    return -1;
}
