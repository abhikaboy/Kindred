import { useMemo } from "react";
import { useWorkspaces, type TaskDocument } from "@/hooks/useWorkspaces";

export type StageTask = TaskDocument & { categoryID: string; workspaceName: string; reason: string };

const isToday = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};
const isPast = (iso?: string | null) => !!iso && new Date(iso).getTime() < Date.now();

// One ordered queue for the stage: in progress, overdue, due today, then by priority.
export function useStageQueue(): { queue: StageTask[]; isLoading: boolean } {
  const { data, isLoading } = useWorkspaces();

  const queue = useMemo(() => {
    const out: (StageTask & { rank: number })[] = [];
    for (const ws of data ?? []) {
      for (const cat of ws.categories ?? []) {
        for (const task of cat.tasks ?? []) {
          const categoryID = task.categoryID ?? cat.id;
          if (task.isPhantom || !categoryID || (cat.id ?? "").startsWith("upcoming-")) continue;
          let rank = 4;
          let reason = "";
          if (task.active || task.workingOnSince) [rank, reason] = [0, "In progress"];
          else if (isPast(task.deadline)) [rank, reason] = [1, "Overdue"];
          else if (isToday(task.deadline) || isToday(task.startTime)) [rank, reason] = [2, "Due today"];
          else if ((task.priority ?? 0) >= 3) [rank, reason] = [3, "High priority"];
          out.push({ ...task, categoryID, workspaceName: ws.name, reason, rank });
        }
      }
    }
    const seen = new Set<string>();
    return out
      .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .sort((a, b) => a.rank - b.rank || (b.priority ?? 0) - (a.priority ?? 0));
  }, [data]);

  return { queue, isLoading };
}
