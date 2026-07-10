type CountableCategory = { name: string; tasks?: { isPhantom?: boolean }[] };

// Pending = what the workspace actually shows: real (non-phantom) tasks, proxy category excluded.
// No `active` filter: the create modal makes tasks with active:false, and completed
// tasks are removed from the category entirely — so filtering on active hides real tasks.
export const pendingWorkspaceTaskCount = (categories?: CountableCategory[]) =>
    (categories ?? [])
        .filter((c) => c.name !== "!-proxy-!")
        .reduce((sum, c) => sum + (c.tasks?.filter((t) => !t.isPhantom).length ?? 0), 0);
