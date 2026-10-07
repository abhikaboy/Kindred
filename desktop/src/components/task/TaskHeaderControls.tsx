import { forwardRef, useEffect, useState } from "react";
import { ChartLineUp, Check, Pause, Play } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// Ring color tracks priority, Todoist-style, so the circle doubles as the priority cue.
const RING: Record<number, string> = {
  1: "border-emerald-500 text-emerald-500 hover:bg-emerald-500/10",
  2: "border-amber-500 text-amber-500 hover:bg-amber-500/10",
  3: "border-destructive text-destructive hover:bg-destructive/10",
};

/** Large completion circle beside the title: hover previews the check, press fills it. */
export const CompleteCircle = forwardRef<HTMLButtonElement, { priority: number; pending: boolean; onComplete: () => void }>(
  ({ priority, pending, onComplete }, ref) => {
    const filled = pending;
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Mark complete"
        disabled={pending}
        onClick={onComplete}
        className={cn(
          "group mt-2 grid size-8 shrink-0 place-items-center rounded-full border-2 transition-[background-color,transform,border-color] duration-200 ease-out active:scale-90",
          RING[priority] ?? "border-muted-foreground/40 text-primary hover:border-primary hover:bg-primary/10",
          filled && "border-primary! bg-primary! text-primary-foreground!"
        )}
      >
        <Check
          size={16}
          weight="bold"
          className={cn(
            "transition-[opacity,transform] duration-200",
            filled ? "scale-100 opacity-100" : "scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-70"
          )}
        />
      </button>
    );
  }
);
CompleteCircle.displayName = "CompleteCircle";

function useElapsed(since?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return null;
  const mins = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** One quiet property line under the title: working status (toggle) and log progress. */
export function TaskStatusLine({
  active,
  workingOnSince,
  pending,
  onToggleWorking,
  onLogProgress,
}: {
  active: boolean;
  workingOnSince?: string | null;
  pending: boolean;
  onToggleWorking: () => void;
  onLogProgress: () => void;
}) {
  const elapsed = useElapsed(active ? workingOnSince : null);
  return (
    <div className="flex flex-wrap items-center gap-1 pl-8">
      <button
        type="button"
        onClick={onToggleWorking}
        disabled={pending}
        aria-pressed={active}
        className={cn(
          "group inline-flex h-8 items-center gap-2 rounded-full px-3 transition-colors duration-150 disabled:opacity-50",
          active ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {active ? (
          <>
            <span className="relative grid size-3.5 place-items-center">
              <span className="absolute size-2 animate-ping rounded-full bg-primary/40 group-hover:hidden" />
              <span className="size-2 rounded-full bg-primary group-hover:hidden" />
              <Pause size={14} weight="fill" className="hidden group-hover:block" />
            </span>
            <ThemedText type="caption" className="text-inherit tabular-nums">
              In progress{elapsed ? ` · ${elapsed}` : ""}
            </ThemedText>
          </>
        ) : (
          <>
            <Play size={14} />
            <ThemedText type="caption" className="text-inherit">
              Start working
            </ThemedText>
          </>
        )}
      </button>
      <span className="text-muted-foreground/40">·</span>
      <button
        type="button"
        onClick={onLogProgress}
        className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <ChartLineUp size={14} />
        <ThemedText type="caption" className="text-inherit">
          Log progress
        </ThemedText>
      </button>
    </div>
  );
}
