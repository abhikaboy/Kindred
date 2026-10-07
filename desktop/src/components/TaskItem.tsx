import { MagicWand, Play, Sparkle } from "@phosphor-icons/react";
import { TaskMeta, PRIORITY_DOT } from "@/components/task/TaskMeta";
import { CheerIcon } from "@/components/kudos/CheerButton";
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

// Live states sit in the meta line in primary, not as chips.
function StatusLabel({ icon: Icon, label }: { icon: typeof Play; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-primary">
      <Icon size={13} weight="fill" />
      <ThemedText type="caption" className="text-inherit">
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
  // Completed tasks keep the priority dot but drop the meta line.
  const working = !completed && Boolean(task.workingOnSince);
  const dotColor = working ? "bg-primary" : PRIORITY_DOT[task.priority];
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
        "rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_28px_-14px_rgba(0,0,0,0.10)] transition-[box-shadow,transform] duration-150 ease-out",
        encouraged ? "bg-primary/5" : "bg-background dark:bg-card",
        (encourageMode || clickable) &&
          "cursor-pointer hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_44px_-14px_rgba(0,0,0,0.18)] active:scale-[0.995]",
        encourageMode && "cheer group/cheer hover:-translate-y-0.5 hover:bg-primary/[0.04]",
        task.isPhantom && "border border-dashed border-border opacity-45 shadow-none"
      )}
      style={encouraged ? { boxShadow: ENCOURAGED_GLOW } : undefined}
    >
      <div className="flex items-start gap-3">
        {!completed && !encourageMode && !preview && !task.isPhantom && <CompleteCheckbox className="mt-0.5" />}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ThemedText type="larger_default" className="min-w-0 break-words">
                {task.content || "Untitled task"}
              </ThemedText>
              {!encourageMode && !encouraged && dotColor && (
                <span className={cn("size-2 shrink-0 rounded-full", dotColor)} />
              )}
            </div>
            {(encourageMode || encouraged) && (
              <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                {encouraged && <EncouragerAvatars encouragements={encouragements} />}
                {encourageMode ? (
                  // Icon at rest; the label slides out on hover so the card invites the click.
                  <span className="inline-flex h-8 items-center gap-0 rounded-full bg-primary/10 px-2 text-primary transition-[gap,padding,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover/cheer:gap-1.5 group-hover/cheer:bg-primary group-hover/cheer:px-3 group-hover/cheer:text-primary-foreground">
                    <CheerIcon />
                    <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 group-hover/cheer:max-w-24 group-hover/cheer:opacity-100">
                      <ThemedText type="caption" className="text-inherit">Cheer on</ThemedText>
                    </span>
                  </span>
                ) : (
                  <Sparkle size={18} weight="fill" className="text-primary" />
                )}
              </div>
            )}
          </div>
          {task.notes && (
            <ThemedText type="caption" className="line-clamp-2 break-words">
              {task.notes}
            </ThemedText>
          )}
          {!completed && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 empty:hidden">
              <TaskMeta task={task} className="contents" />
              {task.autoCategorize && <StatusLabel icon={MagicWand} label="Sorting…" />}
              {working && <StatusLabel icon={Play} label="In progress" />}
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
