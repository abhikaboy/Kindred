import { CalendarBlank, Clock, Play, Repeat, Sparkle } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import type { TaskDocument } from "@/hooks/useWorkspaces";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { CompleteCheckbox } from "@/components/SwipeToComplete";
import { EncouragerAvatars } from "@/components/EncouragerAvatars";

// Primary (#854DFF) glow, softened for desktop — mobile's original (opacity 0.3) read too harsh here.
// Blur kept under the list gap (gap-3 = 12px) so adjacent encouraged cards
// (e.g. profile's accomplished-tasks list) don't bleed into one glowing blob.
const ENCOURAGED_GLOW = "0 0 10px rgba(133,77,255,0.22), 0 1px 4px rgba(133,77,255,0.12)";

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

// `onEncourage` puts the card in read-only "encourage" mode (another user's task):
// the whole card becomes a button that opens the encourage flow, the complete
// checkbox + own-task context menu are dropped, and a Sparkle affordance shows.
export function TaskItem({
  task,
  completed,
  onEncourage,
  linkToDetail,
  preview,
}: {
  task: TaskDocument;
  completed?: boolean;
  onEncourage?: () => void;
  // Whole card navigates to the task detail page (active tasks only).
  linkToDetail?: boolean;
  // Render an unsaved proposed task (AI preview): no complete-checkbox, no context menu.
  preview?: boolean;
}) {
  const navigate = useNavigate();
  // Completed tasks keep the priority dot but drop deadline/recurring/in-progress chips.
  const working = !completed && Boolean(task.workingOnSince);
  const deadline = completed ? null : formatDeadline(task.deadline);
  const scheduledTime =
    completed || !task.startTime
      ? null
      : `${formatDeadline(task.startTime)}, ${new Date(task.startTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  const dotColor = working ? "bg-primary" : PRIORITY_DOT[task.priority];
  const showChips = !completed && (working || Boolean(scheduledTime) || Boolean(deadline) || task.recurring);
  const encouragements = task.encouragements ?? [];
  const encouraged = encouragements.length > 0;
  const encourageMode = Boolean(onEncourage);
  const clickable = Boolean(linkToDetail) && !encourageMode && !task.isPhantom;
  const goToDetail = () => navigate(`/task/${task.id}`);

  const inner = (
    <div
      onClick={clickable ? goToDetail : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && goToDetail() : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={cn(
        "rounded-2xl border px-4 py-3.5 transition-colors",
        encouraged ? "border-border/60 bg-primary/5" : "border-border/60 bg-card",
        (encourageMode || clickable) ? "cursor-pointer hover:border-primary/60" : "hover:border-border",
        task.isPhantom && "border-dashed opacity-45 hover:border-border/60"
      )}
      style={encouraged ? { boxShadow: ENCOURAGED_GLOW } : undefined}
    >
      <div className="flex items-start gap-3">
        {!completed && !encourageMode && !preview && !task.isPhantom && <CompleteCheckbox className="mt-0.5" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <ThemedText type="default" className="break-words leading-6">
                {task.content || "Untitled task"}
              </ThemedText>
              {task.notes && (
                <ThemedText type="caption" className="line-clamp-2 break-words">
                  {task.notes}
                </ThemedText>
              )}
            </div>
            <div className="mt-1 flex shrink-0 items-center gap-1.5">
              {encouraged && <EncouragerAvatars encouragements={encouragements} />}
              {encourageMode || encouraged ? (
                <Sparkle size={18} weight="fill" className="text-primary" />
              ) : (
                dotColor && <span className={cn("mt-0.5 size-2.5 rounded-full", dotColor)} />
              )}
            </div>
          </div>

          {showChips && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {scheduledTime && <Chip icon={Clock} label={scheduledTime} />}
              {deadline && <Chip icon={CalendarBlank} label={`Due ${deadline}`} />}
              {task.recurring && <Chip icon={Repeat} label="Recurring" />}
              {working && <Chip icon={Play} label="in progress" active />}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (encourageMode) {
    return (
      <button type="button" onClick={onEncourage} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  if (preview || task.isPhantom) return inner;
  return <TaskContextMenu task={task}>{inner}</TaskContextMenu>;
}
