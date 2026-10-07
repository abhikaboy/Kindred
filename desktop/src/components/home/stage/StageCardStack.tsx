import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import { TaskMeta, PRIORITY_DOT } from "@/components/task/TaskMeta";
import type { StageTask } from "./useStageQueue";

const WHEEL_STEP = 40;
const WHEEL_COOLDOWN = 140;

// Depth -1 is the card that just left (falls forward and fades); 0 is the front; 1–2 peek
// behind; 3 waits invisible so the next one fades in rather than popping.
function depthStyle(depth: number): React.CSSProperties {
  if (depth < 0) return { transform: "translate3d(0, 24px, 0) scale(1.03)", opacity: 0, zIndex: 40 };
  return {
    transform: `translate3d(0, ${-20 * depth}px, 0) scale(${1 - 0.06 * depth})`,
    opacity: depth > 2 ? 0 : 1 - 0.2 * depth,
    zIndex: 30 - depth,
  };
}

export function StageCardStack({
  queue,
  index,
  onIndexChange,
  onStart,
}: {
  queue: StageTask[];
  index: number;
  onIndexChange: (next: number) => void;
  onStart: (task: StageTask) => void;
}) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const n = queue.length;
  const latest = useRef({ index, n, onIndexChange });
  latest.current = { index, n, onIndexChange };

  // Non-passive so the page doesn't scroll while flipping; the step threshold keeps
  // trackpads from skipping several cards per swipe. Input is never locked.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      const { index, n, onIndexChange } = latest.current;
      if (n < 2) return;
      e.preventDefault();
      acc += e.deltaY;
      const now = performance.now();
      if (Math.abs(acc) < WHEEL_STEP || now - last < WHEEL_COOLDOWN) return;
      last = now;
      onIndexChange((index + (acc > 0 ? 1 : -1) + n) % n);
      acc = 0;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const seen = new Set<string>();
  const layers: { task: StageTask; depth: number }[] = [];
  for (const depth of [0, 1, 2, 3, -1]) {
    if (n === 0 || (depth !== 0 && n < 2)) continue;
    const task = queue[(index + depth + n) % n];
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    layers.push({ task, depth });
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <div
        ref={ref}
        className="relative h-[232px] w-full"
      >
        {layers.map(({ task, depth }) => (
          <div
            key={task.id}
            aria-hidden={depth !== 0}
            role={depth === 0 ? "link" : undefined}
            tabIndex={depth === 0 ? 0 : -1}
            onClick={depth === 0 ? () => navigate(`/task/${task.id}`) : undefined}
            onKeyDown={depth === 0 ? (e) => e.key === "Enter" && e.target === e.currentTarget && navigate(`/task/${task.id}`) : undefined}
            className={cn(
              "absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-2xl bg-background/95 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_40px_-16px_rgba(0,0,0,0.16)] backdrop-blur-md transition-[transform,opacity,box-shadow] duration-300 ease-[cubic-bezier(0.2,0,0,1)] dark:bg-card/95",
              depth !== 0 ? "pointer-events-none bg-muted! dark:bg-muted!" : "cursor-pointer hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_44px_-14px_rgba(0,0,0,0.22)]"
            )}
            style={{ ...depthStyle(depth), transformOrigin: "50% 0%" }}
          >
            <div className="flex flex-col gap-1">
              <ThemedText type="caption" className="truncate">
                {[task.reason, task.workspaceName].filter(Boolean).join(" · ")}
              </ThemedText>
              <div className="flex items-center gap-2">
                <ThemedText type="larger_default" className="min-w-0 truncate">
                  {task.content || "Untitled task"}
                </ThemedText>
                {PRIORITY_DOT[task.priority] && (
                  <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority])} />
                )}
              </div>
              {task.notes && (
                <ThemedText type="caption" className="truncate">
                  {task.notes}
                </ThemedText>
              )}
              <TaskMeta task={task} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                tabIndex={depth === 0 ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  onStart(task);
                }}
                className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-primary-foreground shadow-[0_6px_10px_-2px_rgba(133,77,255,0.3)] transition-[transform,opacity] duration-150 hover:opacity-95 active:scale-[0.97]"
              >
                <Play size={14} weight="fill" />
                <ThemedText type="defaultSemiBold" className="text-sm text-primary-foreground">
                  Start
                </ThemedText>
              </button>
            </div>
          </div>
        ))}
      </div>

      {n > 1 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(n, 7) }, (_, i) => {
              const dots = Math.min(n, 7);
              const active = i === Math.round((index / (n - 1)) * (dots - 1));
              return (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-[width,background-color] duration-300",
                    active ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/25"
                  )}
                />
              );
            })}
          </div>
          <ThemedText type="caption" className="tabular-nums">
            {index + 1} of {n} · scroll or ↑↓ to flip
          </ThemedText>
        </div>
      )}
    </div>
  );
}
