import { useMemo, useState } from "react";
import { useWorkspaces, type TaskDocument } from "@/hooks/useWorkspaces";
import { $api } from "@/lib/api/query";

export type StageTask = TaskDocument & {
  categoryID: string;
  workspaceName: string;
  reason: string;
  /** Set when analytics flagged the task as stalled; the one-line why. */
  stalledWhy?: string;
};

const STALLED_OFF_KEY = "kindred.stalledBoost.off";
// Keep it quiet: only the first couple of stalled tasks get lifted.
const MAX_STALLED = 2;

const readOff = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STALLED_OFF_KEY) ?? "[]");
  } catch {
    return [];
  }
};

function stalledWhy(daysOpen: number, reasons: string[]) {
  const extra = reasons.filter((r) => r === "No deadline" || r === "High priority");
  const lead = `Open ${daysOpen} ${daysOpen === 1 ? "day" : "days"}`;
  return `${[lead, ...extra].join(" · ")}. A few minutes on it is usually enough to get it moving.`;
}

const isToday = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};
const isPast = (iso?: string | null) => !!iso && new Date(iso).getTime() < Date.now();

// One ordered queue for the stage: in progress, overdue, due today, then by priority.
export function useStageQueue(): {
  queue: StageTask[];
  isLoading: boolean;
  setStalledBoost: (taskId: string, on: boolean) => void;
} {
  const { data, isLoading } = useWorkspaces();
  const analytics = $api.useQuery(
    "get",
    "/v1/user/analytics",
    { params: { query: { range: "week" } } },
    { staleTime: 30 * 60 * 1000 },
  );
  const [boostOff, setBoostOff] = useState(readOff);
  const setStalledBoost = (taskId: string, on: boolean) => {
    setBoostOff((prev) => {
      const next = on ? prev.filter((id) => id !== taskId) : [...new Set([...prev, taskId])];
      localStorage.setItem(STALLED_OFF_KEY, JSON.stringify(next));
      return next;
    });
  };

  const queue = useMemo(() => {
    // Stalled (not overdue) tasks from analytics, minus ones the user set aside.
    const stalled = new Map<string, string>();
    for (const t of analytics.data?.attention.tasks ?? []) {
      if (stalled.size >= MAX_STALLED) break;
      if (boostOff.includes(t.id) || (t.deadline && new Date(t.deadline).getTime() < Date.now())) continue;
      stalled.set(t.id, stalledWhy(t.daysOpen, t.reasons ?? []));
    }
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
          else if (stalled.has(task.id)) [rank, reason] = [2.5, "Stalled"];
          else if ((task.priority ?? 0) >= 3) [rank, reason] = [3, "High priority"];
          const why = reason === "Stalled" ? stalled.get(task.id) : undefined;
          out.push({ ...task, categoryID, workspaceName: ws.name, reason, rank, stalledWhy: why });
        }
      }
    }
    const seen = new Set<string>();
    return out
      .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .sort((a, b) => a.rank - b.rank || (b.priority ?? 0) - (a.priority ?? 0));
  }, [data, analytics.data, boostOff]);

  return { queue, isLoading, setStalledBoost };
}
