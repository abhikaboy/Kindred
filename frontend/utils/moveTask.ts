import { Workspace, Task } from "@/api/types";

/**
 * Pure reducer: move a task from one category to the TOP of another, across the
 * workspace tree. Returns a new array (no mutation). No-op (returns the same
 * reference) when source === target or when the task cannot be located.
 */
export function moveTaskInWorkspaces(
    workspaces: Workspace[],
    sourceCategoryId: string,
    taskId: string,
    targetCategoryId: string
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

    return workspaces.map((ws) => ({
        ...ws,
        categories: ws.categories.map((category) => {
            if (category.id === sourceCategoryId) {
                return { ...category, tasks: category.tasks.filter((t) => t.id !== taskId) };
            }
            if (category.id === targetCategoryId) {
                const placed: Task = { ...movingTask, categoryName: category.name };
                return { ...category, tasks: [placed, ...category.tasks] };
            }
            return category;
        }),
    }));
}
