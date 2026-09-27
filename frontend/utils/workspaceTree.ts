import { Categories, Task, Workspace } from "@/api/types";

/**
 * Structural-sharing update over the workspace tree: only workspaces that
 * contain a matching category (and only the categories `fn` actually changes)
 * get new references. Returns the input array when nothing changed.
 */
export function updateCategories(
    workspaces: Workspace[],
    match: (category: Categories) => boolean,
    fn: (category: Categories, workspace: Workspace) => Categories
): Workspace[] {
    let next: Workspace[] | null = null;
    for (let i = 0; i < workspaces.length; i++) {
        const ws = workspaces[i];
        let cats: Categories[] | null = null;
        for (let j = 0; j < ws.categories.length; j++) {
            const category = ws.categories[j];
            if (!match(category)) continue;
            const updated = fn(category, ws);
            if (updated === category) continue;
            if (!cats) cats = ws.categories.slice();
            cats[j] = updated;
        }
        if (cats) {
            if (!next) next = workspaces.slice();
            next[i] = { ...ws, categories: cats };
        }
    }
    return next ?? workspaces;
}

export function updateCategoryById(
    workspaces: Workspace[],
    categoryId: string,
    fn: (category: Categories, workspace: Workspace) => Categories
): Workspace[] {
    return updateCategories(workspaces, (c) => c.id === categoryId, fn);
}

export function updateWorkspaceByName(
    workspaces: Workspace[],
    name: string,
    fn: (workspace: Workspace) => Workspace
): Workspace[] {
    let next: Workspace[] | null = null;
    for (let i = 0; i < workspaces.length; i++) {
        const ws = workspaces[i];
        if (ws.name !== name) continue;
        const updated = fn(ws);
        if (updated === ws) continue;
        if (!next) next = workspaces.slice();
        next[i] = updated;
    }
    return next ?? workspaces;
}

export type TreeIndexes = {
    workspaceByName: Map<string, Workspace>;
    categoryById: Map<string, { workspace: Workspace; category: Categories }>;
    taskById: Map<string, { workspace: Workspace; category: Categories; task: Task }>;
};

const indexCache = new WeakMap<Workspace[], TreeIndexes>();

/** Lookup maps for a workspace tree, built lazily once per tree reference. */
export function getTreeIndexes(workspaces: Workspace[]): TreeIndexes {
    const cached = indexCache.get(workspaces);
    if (cached) return cached;
    const workspaceByName = new Map<string, Workspace>();
    const categoryById = new Map<string, { workspace: Workspace; category: Categories }>();
    const taskById = new Map<string, { workspace: Workspace; category: Categories; task: Task }>();
    for (const workspace of workspaces) {
        // First match wins, mirroring the Array.find lookups this replaces.
        if (!workspaceByName.has(workspace.name)) workspaceByName.set(workspace.name, workspace);
        for (const category of workspace.categories) {
            if (!categoryById.has(category.id)) categoryById.set(category.id, { workspace, category });
            for (const task of category.tasks) {
                if (!taskById.has(task.id)) taskById.set(task.id, { workspace, category, task });
            }
        }
    }
    const indexes = { workspaceByName, categoryById, taskById };
    indexCache.set(workspaces, indexes);
    return indexes;
}

const decoratedCache = new WeakMap<Task, Task>();

/**
 * Task annotated with its category/workspace. Reuses the task itself when it
 * already carries the right fields, and otherwise a cached copy, so unchanged
 * tasks keep a stable reference across tree updates.
 */
export function decorateTask(task: Task, category: Categories, workspace: Workspace): Task {
    const matches = (t: Task) =>
        t.categoryID === category.id && t.categoryName === category.name && t.workspaceName === workspace.name;
    if (matches(task)) return task;
    const cached = decoratedCache.get(task);
    if (cached && matches(cached)) return cached;
    const decorated = {
        ...task,
        categoryID: category.id,
        categoryName: category.name,
        workspaceName: workspace.name,
    };
    decoratedCache.set(task, decorated);
    return decorated;
}
