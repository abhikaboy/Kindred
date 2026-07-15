import { useMemo } from "react";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import type { TaskDocument } from "@/hooks/useWorkspaces";

// True when an ISO date falls on the local calendar "today".
function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// Flatten every category's tasks across all workspaces (proxy cats already stripped);
// stamp categoryID so downstream rows/links can resolve their category.
export function useAllTasks(): TaskDocument[] {
  const { data } = useWorkspaces();
  return useMemo(() => {
    const tasks: TaskDocument[] = [];
    for (const ws of data ?? []) {
      for (const cat of ws.categories ?? []) {
        for (const task of cat.tasks ?? []) {
          tasks.push({ ...task, categoryID: task.categoryID ?? cat.id });
        }
      }
    }
    return tasks;
  }, [data]);
}

// Tasks whose deadline OR start time lands on today.
export function useTodayTasks(): TaskDocument[] {
  const tasks = useAllTasks();
  return useMemo(
    () => tasks.filter((t) => isToday(t.deadline) || isToday(t.startTime)),
    [tasks]
  );
}

// Tasks marked in progress (durable `active`) or with a live focus session.
export function useWorkingOnTasks(): TaskDocument[] {
  const tasks = useAllTasks();
  return useMemo(
    () => tasks.filter((t) => (t.active || t.workingOnSince) && t.categoryID),
    [tasks]
  );
}
