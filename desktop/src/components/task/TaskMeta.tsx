import { CalendarBlank, Clock, Repeat } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import type { TaskDocument } from "@/hooks/useWorkspaces";

export const PRIORITY_DOT: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-destructive",
};

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function relativeDay(d: Date): string {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(new Date())) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const valid = (iso?: string | null) => (iso && !Number.isNaN(new Date(iso).getTime()) ? new Date(iso) : null);

// Start time, deadline and recurrence as one tight caption line with leading icons.
export function TaskMeta({ task, className }: { task: TaskDocument; className?: string }) {
  const start = valid(task.startTime);
  const due = valid(task.deadline);
  const overdue = !!due && due.getTime() < Date.now();
  const items = [
    start && { icon: Clock, label: `${relativeDay(start)}, ${time(start)}` },
    due && { icon: CalendarBlank, label: `${overdue ? "Overdue" : "Due"} ${relativeDay(due).toLowerCase()}`, warn: overdue },
    task.recurring && { icon: Repeat, label: "Repeats" },
  ].filter(Boolean) as { icon: typeof Clock; label: string; warn?: boolean }[];

  if (!items.length) return null;
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {items.map(({ icon: Icon, label, warn }) => (
        <span key={label} className={cn("inline-flex items-center gap-1", warn ? "text-destructive" : "text-muted-foreground")}>
          <Icon size={13} />
          <ThemedText type="caption" className="text-inherit">
            {label}
          </ThemedText>
        </span>
      ))}
    </div>
  );
}
