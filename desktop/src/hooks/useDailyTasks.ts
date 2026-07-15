import { useMemo } from "react";
import { useAllTasks } from "@/hooks/useHomeTasks";
import { categorizeDailyTasks, type DailyBuckets } from "@/lib/dailyTasks";

export function useDailyTasks(selectedDate: Date): DailyBuckets {
  const allTasks = useAllTasks();
  return useMemo(
    () => categorizeDailyTasks(allTasks, selectedDate),
    [allTasks, selectedDate.getTime()]
  );
}
