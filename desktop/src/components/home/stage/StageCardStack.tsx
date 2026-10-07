import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import { TaskMeta, PRIORITY_DOT } from "@/components/task/TaskMeta";
import type { StageTask } from "./useStageQueue";

// Wheel distance (px of deltaY) to flip one card; past half of it on release also flips.
const WHEEL_STEP = 220;
// Settle wait after the last wheel event, and the pause after a flip that swallows trackpad momentum.
const WHEEL_IDLE = 140;
const FLIP_REST = 320;

// Continuous depth so cards can sit between slots while the wheel is mid-gesture.
// -1 is the card that just left (falls forward and fades); 0 is the front; 1–2 peek
// behind; 3 waits invisible so the next one fades in rather than popping.
function depthStyle(d: number): React.CSSProperties {
  if (d < 0) {
    const t = Math.min(1, -d);
    return { transform: `translate3d(0, ${24 * t}px, 0) scale(${1 + 0.03 * t})`, opacity: 1 - t, zIndex: 40 };
  }
  return {
    transform: `translate3d(0, ${-20 * d}px, 0) scale(${1 - 0.06 * d})`,
    opacity: d > 2 ? Math.max(0, 0.6 * (3 - d)) : 1 - 0.2 * d,
    zIndex: 30 - Math.round(d),
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
  // -1..1 fraction of a flip the wheel has dragged the stack; cards track it 1:1.
  const [drag, setDrag] = useState(0);
  const latest = useRef({ index, n, onIndexChange });
  latest.current = { index, n, onIndexChange };

  // Non-passive so the page doesn't scroll while flipping. Input is never locked:
  // after a flip, momentum is ignored briefly, then the next gesture starts fresh.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0;
    let restUntil = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const flip = (dir: number) => {
      const { index, n, onIndexChange } = latest.current;
      onIndexChange((index + dir + n) % n);
      acc = 0;
      setDrag(0);
      restUntil = performance.now() + FLIP_REST;
    };
    const onWheel = (e: WheelEvent) => {
      if (latest.current.n < 2) return;
      e.preventDefault();
      if (performance.now() < restUntil) return;
      acc = Math.max(-WHEEL_STEP, Math.min(WHEEL_STEP, acc + e.deltaY));
      if (Math.abs(acc) >= WHEEL_STEP) return flip(Math.sign(acc));
      setDrag(acc / WHEEL_STEP);
      clearTimeout(idle);
      idle = setTimeout(() => {
        if (Math.abs(acc) >= WHEEL_STEP / 2) flip(Math.sign(acc));
        else {
          acc = 0;
          setDrag(0);
        }
      }, WHEEL_IDLE);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(idle);
    };
  }, []);
  const dragging = drag !== 0;

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
              "absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-2xl bg-background/95 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_40px_-16px_rgba(0,0,0,0.16)] backdrop-blur-md transition-[transform,opacity,box-shadow] ease-[cubic-bezier(0.2,0,0,1)]",
              dragging ? "duration-75" : "duration-300",
              " dark:bg-card/95",
              depth !== 0 ? cn("pointer-events-none", depth - drag > 0.5 && "bg-muted! dark:bg-muted!") : "cursor-pointer hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_44px_-14px_rgba(0,0,0,0.22)]"
            )}
            style={{ ...depthStyle(depth - drag), transformOrigin: "50% 0%" }}
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
