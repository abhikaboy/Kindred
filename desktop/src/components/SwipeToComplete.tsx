import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ThemedText } from "@/components/ThemedText";
import { useCompleteTask, AUTH_HEADER } from "@/hooks/useTaskActions";
import { useCreate } from "@/components/create/CreateContext";
import { fireConfetti } from "@/lib/confetti";
import type { TaskDocument } from "@/hooks/useWorkspaces";

// Release fires completion once dragged past 70% of the row width.
export function shouldComplete(dx: number, width: number): boolean {
  return width > 0 && dx >= width * 0.7;
}

// Movement under this many pixels on release counts as a click, not a drag.
const CLICK_SLOP = 6;

// Lets a nested card (TaskItem) render a complete checkbox without prop threading.
type CompleteControl = { complete: () => void; pending: boolean };
const CompleteContext = createContext<CompleteControl | null>(null);
export const useTaskComplete = () => useContext(CompleteContext);

// A one-click complete checkbox: hover reveals a check, click fills green + fires
// the row's completion. Renders nothing outside a SwipeToComplete.
export function CompleteCheckbox({ className }: { className?: string }) {
  const ctx = useTaskComplete();
  if (!ctx) return null;
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        ctx.complete();
      }}
      disabled={ctx.pending}
      aria-label="Mark complete"
      className={cn(
        "group/check grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
        ctx.pending
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-muted-foreground/40 text-emerald-600 hover:border-emerald-500 hover:bg-emerald-500/10",
        className,
      )}
    >
      <Check
        size={12}
        weight="bold"
        className={cn("transition-opacity", ctx.pending ? "opacity-100" : "opacity-0 group-hover/check:opacity-100")}
      />
    </button>
  );
}

// Swipe a task row rightward to complete it, click the checkbox to complete, or
// tap to open the detail view. DOM pointer events only — no gesture lib.
export function SwipeToComplete({
  task,
  categoryId,
  children,
}: {
  task: TaskDocument;
  categoryId: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const completeTask = useCompleteTask();
  const { openCreatePost } = useCreate();
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const dragging = useRef(false);
  const [dx, setDx] = useState(0);
  const [transition, setTransition] = useState(false);
  const [done, setDone] = useState(false);

  const width = rowRef.current?.offsetWidth ?? 0;
  const threshold = width * 0.7;
  const revealOpacity = width > 0 ? Math.min(dx / threshold, 1) : 0;
  // Past the 70% threshold: releasing now completes — pulse the card to signal it's armed.
  const passedThreshold = width > 0 && dx >= threshold && !done;

  const complete = useCallback(() => {
    const w = rowRef.current?.offsetWidth ?? 0;
    setDone(true);
    setTransition(true);
    setDx(w); // slide fully open, then collapse the row height
    completeTask.mutate(
      {
        params: { header: AUTH_HEADER, path: { category: categoryId, id: task.id } },
        body: { timeCompleted: new Date().toISOString(), timeTaken: "PT0S" },
      },
      {
        onSuccess: (data) => {
          fireConfetti(rowRef.current);
          // Post-complete "share your win" prompt (mirrors mobile) — on every completion.
          const title =
            data?.streakChanged && data.currentStreak
              ? `🔥 ${data.currentStreak} day streak!`
              : "Task completed! 🎉";
          toast.success(title, {
            description: "Share your win and document your task",
            duration: 6000,
            action: {
              label: "Share",
              onClick: () =>
                openCreatePost({ id: task.id, content: task.content, categoryId }),
            },
          });
        },
        // On failure, un-collapse the row so the task doesn't silently vanish.
        onError: () => {
          setDone(false);
          setDx(0);
          toast.error("Couldn't complete that task. Please try again.");
        },
      },
    );
  }, [categoryId, task.id, task.content, completeTask, openCreatePost]);

  const control = useMemo<CompleteControl>(
    () => ({ complete, pending: done || completeTask.isPending }),
    [complete, done, completeTask.isPending],
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (done || completeTask.isPending) return;
    dragging.current = true;
    startX.current = e.clientX;
    setTransition(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    setDx(Math.max(0, e.clientX - startX.current));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const moved = e.clientX - startX.current;
    setTransition(true);

    if (moved < CLICK_SLOP) {
      setDx(0);
      navigate(`/task/${task.id}`);
      return;
    }
    if (shouldComplete(moved, width)) {
      complete();
      return;
    }
    setDx(0);
  }

  return (
    <div
      ref={rowRef}
      className="relative cursor-pointer select-none overflow-hidden rounded-2xl transition-[height,opacity,margin] duration-300"
      style={done ? { height: 0, opacity: 0, marginTop: -8 } : undefined}
    >
      {/* Reveal only fills the strip the card has vacated, so it never sits over the card. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl bg-emerald-500 pl-5 text-white"
        style={{ width: dx, opacity: revealOpacity }}
      >
        <Check size={20} weight="bold" />
        <ThemedText type="defaultSemiBold" className="text-white">
          Complete
        </ThemedText>
      </div>

      <div
        className="relative z-10"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translateX(${dx}px)`,
          transition: transition ? "transform 300ms ease" : undefined,
        }}
      >
        <div className={passedThreshold ? "animate-threshold-pulse" : undefined}>
          <CompleteContext.Provider value={control}>{children}</CompleteContext.Provider>
        </div>
      </div>
    </div>
  );
}
