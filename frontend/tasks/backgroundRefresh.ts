import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { persistQueryClientRestore, persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { queryClient, persistOptions } from "@/utils/queryClient";
import { fetchWorkspaceSnapshot, writeWorkspaceCache } from "@/utils/workspaceSnapshot";
import { getCachedUser } from "@/hooks/useAuth";
import { getRingsToday } from "@/api/rings";
import { FOR_YOU_KEY, fetchForYou } from "@/hooks/useForYou";
import { logger } from "@/utils/logger";

export const BACKGROUND_REFRESH_TASK = "kindred-background-refresh";

// iOS treats this as a floor and decides the real cadence from how often the app is used
const MINIMUM_INTERVAL_MINUTES = 60;

/**
 * Queries worth having warm on launch. Each needs its fetcher here because a
 * restored cache holds data only, not the functions that produced it.
 */
const PREFETCH: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }[] = [
    { queryKey: ["rings", "today"], queryFn: getRingsToday },
    { queryKey: FOR_YOU_KEY, queryFn: fetchForYou },
];

/** Refreshes the on-disk caches the app reads at launch. Safe to call with the app open. */
export async function refreshCachesInBackground(): Promise<void> {
    const user = await getCachedUser();
    if (!user?._id) return;

    // A headless launch starts with an empty client; load the disk copy first so saving doesn't wipe it
    if (queryClient.getQueryCache().getAll().length === 0) {
        await persistQueryClientRestore({ queryClient, ...persistOptions });
    }

    const results = await Promise.allSettled([
        fetchWorkspaceSnapshot(user._id).then(({ workspaces, templates }) =>
            writeWorkspaceCache(user._id, { data: workspaces, timestamp: Date.now(), templates })
        ),
        ...PREFETCH.map((q) => queryClient.fetchQuery({ ...q, staleTime: 0 })),
    ]);
    results.forEach((r) => r.status === "rejected" && logger.warn("Background refresh step failed", r.reason));

    await persistQueryClientSave({ queryClient, ...persistOptions });
}

// Must run at module scope so the task exists when iOS launches the app headless
TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
    try {
        await refreshCachesInBackground();
        return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
        logger.error("Background refresh failed", error);
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
});

export async function registerBackgroundRefresh(): Promise<void> {
    try {
        const status = await BackgroundTask.getStatusAsync();
        if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
        if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK)) return;
        await BackgroundTask.registerTaskAsync(BACKGROUND_REFRESH_TASK, { minimumInterval: MINIMUM_INTERVAL_MINUTES });
    } catch (error) {
        logger.warn("Could not register background refresh", error);
    }
}

