import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ThemedText } from "@/components/ThemedText";
import { ConcentricRings } from "@/components/rings/ConcentricRings";
import { useRingsToday } from "@/hooks/useRings";
import { useCompleteTask, AUTH_HEADER } from "@/hooks/useTaskActions";
import { useRingUpdate } from "@/components/rings/RingUpdateContext";
import { showTaskCompleteToast } from "@/components/TaskCompleteToast";
import { useCreate } from "@/components/create/CreateContext";
import { fireConfetti } from "@/lib/confetti";
import type { StageTask } from "./useStageQueue";

const pad = (n: number) => String(n).padStart(2, "0");
const formatElapsed = (s: number) =>
  s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

// The ring grows into the center of the screen and becomes the timer.
export function FocusView({ task, onExit, onDone }: { task: StageTask; onExit: () => void; onDone: () => void }) {
  const { data } = useRingsToday();
  const completeTask = useCompleteTask();
  const { showRingUpdate } = useRingUpdate();
  const { openCreatePost } = useCreate();
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const finish = (anchor: HTMLElement) => {
    if (finishing) return;
    setFinishing(true);
    completeTask.mutate(
      {
        params: { header: AUTH_HEADER, path: { category: task.categoryID, id: task.id } },
        body: { timeCompleted: new Date().toISOString(), timeTaken: `PT${elapsed}S` },
      },
      {
        onSuccess: (res) => {
          fireConfetti(anchor);
          showRingUpdate(res?.ringDelta);
          showTaskCompleteToast({
            streak: res?.currentStreak,
            onShare: () => openCreatePost({ id: task.id, content: task.content, categoryId: task.categoryID }),
          });
          onDone();
        },
        onError: () => {
          setFinishing(false);
          toast.error("Couldn't complete that task. Something went wrong on our end. Give it another try.");
        },
      }
    );
  };

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 animate-in fade-in duration-500">
      <button
        type="button"
        onClick={onExit}
        className="absolute left-0 top-0 flex items-center gap-2 rounded-full px-3 py-2 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft size={16} />
        <ThemedText type="caption" className="text-inherit">
          Back
        </ThemedText>
      </button>

      <div className="animate-in zoom-in-75 fade-in duration-700 ease-out">
        {data ? (
          <ConcentricRings
            rings={data.ring_state}
            size={260}
            strokeWidth={14}
            gap={6}
            center={
              <ThemedText type="defaultSemiBold" className="text-4xl tabular-nums">
                {formatElapsed(elapsed)}
              </ThemedText>
            }
          />
        ) : (
          <div className="size-[260px]" />
        )}
      </div>

      <div className="flex max-w-xl flex-col items-center gap-2 text-center">
        <ThemedText type="caption">{task.workspaceName}</ThemedText>
        <ThemedText type="fancyFrauncesSubheading" as="h2" className="break-words">
          {task.content || "Untitled task"}
        </ThemedText>
      </div>

      <button
        type="button"
        onClick={(e) => finish(e.currentTarget)}
        disabled={finishing}
        className="flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-primary-foreground shadow-[0_6px_10px_-2px_rgba(133,77,255,0.35)] transition-[transform,opacity] duration-150 hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
      >
        <Check size={18} weight="bold" />
        <ThemedText type="defaultSemiBold" className="text-primary-foreground">
          {finishing ? "Wrapping up" : "Mark done"}
        </ThemedText>
      </button>
      <ThemedText type="caption" className="-mt-4">
        Esc to step out
      </ThemedText>
    </div>
  );
}
