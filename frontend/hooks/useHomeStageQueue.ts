import { useMemo } from "react";
import { useTasks } from "@/contexts/tasksContext";
import type { Task } from "@/api/types";
import { isSomedayTask } from "@/hooks/useSomedayTasks";
import { useHiddenStageTasks } from "@/hooks/useHiddenStageTasks";

export type StageTask = Task & { categoryID: string; workspaceName: string; reason: string };

const isToday = (iso?: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
const isPast = (iso?: string | null) => !!iso && new Date(iso).getTime() < Date.now();

// Mirrors desktop's stage queue: in progress, overdue, due today, then by priority.
export function useHomeStageQueue(): StageTask[] {
    const { unnestedTasks } = useTasks();
    // Tasks hidden for 8 hours stay out of the stack until they come back
    const { hidden } = useHiddenStageTasks();
    return useMemo(() => {
        const out: (StageTask & { rank: number })[] = [];
        const seen = new Set<string>();
        for (const task of unnestedTasks) {
            const categoryID = task.categoryID;
            if (!categoryID || categoryID.startsWith("upcoming-") || seen.has(task.id) || hidden[task.id]) continue;
            seen.add(task.id);
            let rank = 4;
            let reason = "";
            if (task.active || task.workingOnSince) [rank, reason] = [0, "In progress"];
            else if (isPast(task.deadline)) [rank, reason] = [1, "Overdue"];
            else if (isToday(task.deadline) || isToday(task.startTime)) [rank, reason] = [2, "Due today"];
            else if ((task.priority ?? 0) >= 3) [rank, reason] = [3, "High priority"];
            // Someday tasks have no day yet: they sit after everything that does
            else if (isSomedayTask(task)) [rank, reason] = [5, "Someday"];
            out.push({ ...task, categoryID, workspaceName: task.workspaceName ?? "", reason, rank });
        }
        return out.sort((a, b) => a.rank - b.rank || (b.priority ?? 0) - (a.priority ?? 0));
    }, [unnestedTasks, hidden]);
}
