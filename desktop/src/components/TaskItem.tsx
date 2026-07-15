import { CalendarBlank, Clock, Play, Repeat } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import type { TaskDocument } from "@/hooks/useWorkspaces";

// Priority dot colors, mirroring the mobile card (none→transparent, 1→green, 2→amber, 3→red).
const PRIORITY_DOT: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-destructive",
};

function formatDeadline(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Chip({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ size?: number; weight?: "regular"; className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        active ? "bg-primary/10" : "bg-muted"
      )}
    >
      <Icon size={12} weight="regular" className={active ? "text-primary" : "text-muted-foreground"} />
      <ThemedText type="caption" className={active ? "text-primary" : "text-muted-foreground"}>
        {label}
      </ThemedText>
    </span>
  );
}

export function TaskItem({ task }: { task: TaskDocument }) {
  const working = Boolean(task.workingOnSince);
  const deadline = formatDeadline(task.deadline);
  const dotColor = working ? "bg-primary" : PRIORITY_DOT[task.priority];
  const showChips = working || Boolean(deadline) || task.recurring;

  return (
    <div className="flex flex-col justify-center rounded-2xl border bg-card/60 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <ThemedText type="default" className="line-clamp-2 leading-6">
            {task.content || "Untitled task"}
          </ThemedText>
          {task.notes && (
            <ThemedText type="caption" className="line-clamp-2">
              {task.notes}
            </ThemedText>
          )}
        </div>
        {dotColor && (
          <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", dotColor)} />
        )}
      </div>

      {showChips && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {deadline && (
            <Chip icon={task.startTime ? Clock : CalendarBlank} label={`Due ${deadline}`} />
          )}
          {task.recurring && <Chip icon={Repeat} label="Recurring" />}
          {working && <Chip icon={Play} label="in progress" active />}
        </div>
      )}
    </div>
  );
}
