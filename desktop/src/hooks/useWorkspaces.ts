import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";
import { computePhantomTasks } from "@/lib/phantomTasks";

// isPhantom marks a client-side placeholder for a recurring template with no
// active instance yet (see computePhantomTasks) — not a real task document.
export type TaskDocument = components["schemas"]["TaskDocument"] & { isPhantom?: boolean };
export type CategoryDocument = Omit<components["schemas"]["CategoryDocument"], "tasks"> & {
  tasks: TaskDocument[];
};
export type WorkspaceResult = Omit<components["schemas"]["WorkspaceResult"], "categories"> & {
  categories: CategoryDocument[];
};

// "!-proxy-!" is a sentinel placeholder category (every workspace needs ≥1) and
// is never rendered. "upcoming-" ids are re-added below after stripping, to
// hold phantom (template-with-no-active-instance) tasks.
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

// Recurring templates with no active instance yet get a synthetic dimmed task
// in an "Upcoming" category, mirroring mobile's tasksContext.
function withPhantomTasks(
  workspaces: WorkspaceResult[],
  templates: components["schemas"]["TemplateWithCategory"][]
): WorkspaceResult[] {
  if (templates.length === 0) return workspaces;
  const allCategories = workspaces.flatMap((ws) => ws.categories ?? []);
  const phantomMap = computePhantomTasks(templates, allCategories);
  if (phantomMap.size === 0) return workspaces;

  return workspaces.map((ws) => {
    const upcomingTasks: TaskDocument[] = [];
    for (const cat of ws.categories ?? []) {
      const phantoms = phantomMap.get(cat.id);
      if (phantoms) upcomingTasks.push(...phantoms);
    }
    if (upcomingTasks.length === 0) return ws;
    const upcomingCategory = {
      id: `upcoming-${ws.name}`,
      name: "Upcoming",
      tasks: upcomingTasks,
    } as CategoryDocument;
    return { ...ws, categories: [...(ws.categories ?? []), upcomingCategory] };
  });
}

// One fetch returns the whole workspace → category → task tree, merged with
// phantom tasks for recurring templates with no active instance.
// react-query is the store; Authorization is injected by the client middleware.
export function useWorkspaces(): UseQueryResult<WorkspaceResult[]> {
  const workspacesQuery = $api.useQuery(
    "get",
    "/v1/user/workspaces",
    { params: { header: { Authorization: "" } } },
    { select: stripProxyCategories }
  ) as UseQueryResult<WorkspaceResult[]>;

  const templatesQuery = $api.useQuery("get", "/v1/user/tasks/templates", {
    params: { header: { Authorization: "" } },
  });
  const templates = templatesQuery.data?.templates ?? [];

  const data = useMemo(
    () => (workspacesQuery.data ? withPhantomTasks(workspacesQuery.data, templates) : workspacesQuery.data),
    [workspacesQuery.data, templates]
  );

  return { ...workspacesQuery, data } as UseQueryResult<WorkspaceResult[]>;
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
