import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

export type WorkspaceResult = components["schemas"]["WorkspaceResult"];
export type CategoryDocument = components["schemas"]["CategoryDocument"];
export type TaskDocument = components["schemas"]["TaskDocument"];

// "!-proxy-!" is a sentinel placeholder category (every workspace needs ≥1);
// "upcoming-" ids are client-side phantoms. Neither is ever rendered.
const PROXY_CATEGORY_NAME = "!-proxy-!";
const isRealCategory = (c: CategoryDocument) =>
  c.name !== PROXY_CATEGORY_NAME && !(c.id ?? "").startsWith("upcoming-");

const taskCount = (ws: WorkspaceResult) =>
  (ws.categories ?? []).reduce((sum, c) => sum + (c.tasks?.length ?? 0), 0);

// Backend $group has no $sort, so order isn't stable across refetches — sort by
// task count (most tasks first) here, falling back to name to keep ties stable.
const stripProxyCategories = (workspaces: WorkspaceResult[]): WorkspaceResult[] =>
  workspaces
    .map((ws) => ({
      ...ws,
      categories: (ws.categories ?? []).filter(isRealCategory),
    }))
    .sort((a, b) => taskCount(b) - taskCount(a) || a.name.localeCompare(b.name));

// One fetch returns the whole workspace → category → task tree.
// react-query is the store; Authorization is injected by the client middleware.
export function useWorkspaces(): UseQueryResult<WorkspaceResult[]> {
  return $api.useQuery(
    "get",
    "/v1/user/workspaces",
    { params: { header: { Authorization: "" } } },
    { select: stripProxyCategories }
  ) as UseQueryResult<WorkspaceResult[]>;
}

// Derive a single workspace by name from the cached list.
export function useWorkspace(name: string | undefined): {
  workspace: WorkspaceResult | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useWorkspaces();
  const workspace = useMemo(
    () => data?.find((ws) => ws.name === name),
    [data, name]
  );
  return { workspace, isLoading, error };
}
