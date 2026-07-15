import { format } from "date-fns";
import { TaskItem } from "@/components/TaskItem";
import { ThemedText } from "@/components/ThemedText";
import type { DailyBuckets } from "@/lib/dailyTasks";
import type { TaskDocument } from "@/hooks/useWorkspaces";

type Props = { selectedDate: Date; buckets: DailyBuckets };

const SECTIONS: { key: keyof DailyBuckets; label: string }[] = [
  { key: "overdueTasks", label: "Overdue" },
  { key: "tasksForSelectedDate", label: "Today" },
  { key: "upcomingTasks", label: "Upcoming" },
  { key: "listUnscheduledTasks", label: "Unscheduled" },
];

export function Agenda({ selectedDate, buckets }: Props) {
  const nonEmpty = SECTIONS.map((s) => ({ ...s, tasks: buckets[s.key] as TaskDocument[] })).filter(
    (s) => s.tasks.length > 0
  );

  return (
    <div className="flex flex-col gap-6 overflow-y-auto pb-8">
      <ThemedText type="subtitle">{format(selectedDate, "EEEE, MMMM d")}</ThemedText>
      {nonEmpty.length === 0 && (
        <ThemedText type="caption" className="text-muted-foreground">
          Nothing scheduled.
        </ThemedText>
      )}
      {nonEmpty.map((section) => (
        <div key={section.key} className="flex flex-col gap-2">
          <ThemedText type="caption" className="text-muted-foreground">
            {section.label} ({section.tasks.length})
          </ThemedText>
          {section.tasks.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </div>
      ))}
    </div>
  );
}
