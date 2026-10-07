import { useState } from "react";
import { ArrowRight, ArrowsClockwise, Play } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { ConcentricRings } from "@/components/rings/ConcentricRings";
import { QuickCapture } from "@/components/home/QuickCapture";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth";
import { useRingsToday } from "@/hooks/useRings";
import { StageGlow } from "./StageGlow";
import { FocusView } from "./FocusView";
import { useStageQueue, type StageTask } from "./useStageQueue";

const greetingFor = (h: number) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

// Gemini-style landing: the ring as the mark, one personal line, one task, one composer.
export function HomeStage({ onOpenOverview }: { onOpenOverview: () => void }) {
  const { user } = useAuth();
  const { data: rings } = useRingsToday();
  const { queue, isLoading } = useStageQueue();
  const [index, setIndex] = useState(0);
  const [focusTask, setFocusTask] = useState<StageTask | null>(null);
  const [replay, setReplay] = useState(0);

  const task = queue.length ? queue[index % queue.length] : null;
  const streak = rings?.current_streak ?? 0;
  const dueToday = queue.filter((t) => t.reason === "Due today" || t.reason === "Overdue").length;
  const facts = [dueToday > 0 && `${dueToday} due today`, streak > 0 && `${streak} day streak`].filter(Boolean);

  const exitFocus = () => {
    setFocusTask(null);
    setReplay((r) => r + 1);
  };

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col">
      <div className="pointer-events-none absolute -inset-x-6 -bottom-12 -top-8">
        <StageGlow focused={!!focusTask} replayKey={replay} />
      </div>

      {focusTask ? (
        <FocusView
          key={focusTask.id}
          task={focusTask}
          onExit={exitFocus}
          onDone={() => {
            setIndex(0);
            exitFocus();
          }}
        />
      ) : (
        <>
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 pb-8">
            <div className="flex flex-col items-center gap-5 text-center animate-in fade-in slide-in-from-bottom-1 duration-500">
              <button
                type="button"
                onClick={onOpenOverview}
                aria-label="Open your rings and day"
                className="rounded-full transition-transform duration-200 ease-out hover:scale-[1.04] active:scale-[0.98]"
              >
                {rings ? (
                  <ConcentricRings rings={rings.ring_state} size={64} strokeWidth={6} gap={2} />
                ) : (
                  <Skeleton className="size-16 rounded-full" />
                )}
              </button>
              <div className="flex flex-col items-center gap-2">
                <ThemedText type="titleFraunces" as="h1">
                  {greetingFor(new Date().getHours())}, {user?.display_name || "there"}
                </ThemedText>
                {facts.length > 0 && <ThemedText type="caption">{facts.join(" · ")}</ThemedText>}
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-32 w-full max-w-md rounded-2xl" />
            ) : task ? (
              <div
                key={task.id}
                className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-background/70 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_40px_-16px_rgba(0,0,0,0.16)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-300 dark:bg-card/70"
              >
                <div className="flex flex-col gap-1">
                  <ThemedText type="caption">
                    {[task.reason, task.workspaceName].filter(Boolean).join(" · ")}
                  </ThemedText>
                  <ThemedText type="larger_default" className="break-words">
                    {task.content || "Untitled task"}
                  </ThemedText>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusTask(task)}
                    className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-primary-foreground shadow-[0_6px_10px_-2px_rgba(133,77,255,0.3)] transition-[transform,opacity] duration-150 hover:opacity-95 active:scale-[0.97]"
                  >
                    <Play size={14} weight="fill" />
                    <ThemedText type="defaultSemiBold" className="text-sm text-primary-foreground">
                      Start
                    </ThemedText>
                  </button>
                  {queue.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIndex((i) => i + 1)}
                      className="group flex h-10 items-center gap-2 rounded-full px-4 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                    >
                      <ArrowsClockwise size={14} className="transition-transform duration-300 group-active:rotate-180" />
                      <ThemedText type="caption" className="text-inherit">
                        Something else
                      </ThemedText>
                    </button>
                  )}
                  <ThemedText type="caption" className="ml-auto tabular-nums">
                    {(index % queue.length) + 1} of {queue.length}
                  </ThemedText>
                </div>
              </div>
            ) : (
              <ThemedText type="caption">Nothing on your plate. Add something below.</ThemedText>
            )}
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center gap-4 pb-4 animate-in fade-in duration-700">
            <div className="w-full">
              <QuickCapture />
            </div>
            <button
              type="button"
              onClick={onOpenOverview}
              className="group flex items-center gap-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <ThemedText type="caption" className="text-inherit">
                See your whole day
              </ThemedText>
              <ArrowRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
