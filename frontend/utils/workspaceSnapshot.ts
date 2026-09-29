import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BlueprintWorkspace, Workspace } from "@/api/types";
import { getUserTemplatesAPI } from "@/api/task";
import { fetchUserWorkspaces } from "@/api/workspace";
import { getUserSubscribedBlueprints } from "@/api/blueprint";
import { logger } from "@/utils/logger";

export const workspacesCacheKey = (userId: string | undefined) => `workspaces_cache_${userId || "default"}`;

export type CachedWorkspaces = { data: Workspace[]; timestamp: number; templates?: any[] };

/** Everything the task tree needs from the server: workspaces, subscribed blueprints and templates. */
export async function fetchWorkspaceSnapshot(uid: string): Promise<{ workspaces: Workspace[]; templates: any[] }> {
    const [data, templates, subscribedBlueprints] = await Promise.all([
        fetchUserWorkspaces(uid),
        getUserTemplatesAPI().catch((err) => {
            logger.error("Failed to fetch templates", err);
            return [];
        }),
        getUserSubscribedBlueprints(),
    ]);

    const blueprintWorkspaces: BlueprintWorkspace[] = subscribedBlueprints.map((blueprint) => ({
        name: blueprint.name,
        categories: [],
        blueprintDetails: blueprint,
        isBlueprint: true,
    }));

    return { workspaces: [...data, ...blueprintWorkspaces], templates };
}

export function writeWorkspaceCache(uid: string, cache: CachedWorkspaces): Promise<void> {
    return AsyncStorage.setItem(workspacesCacheKey(uid), JSON.stringify(cache));
}
