import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { ConcentricRings } from "@/components/rings/ConcentricRings";
import { QuickCapture } from "@/components/home/QuickCapture";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth";
import { useRingsToday } from "@/hooks/useRings";
import { StageGlow } from "./StageGlow";
import { FocusView } from "./FocusView";
import { StageCardStack, type StageItem } from "./StageCardStack";
import { useRecentKudos } from "./useRecentKudos";
import { EnrichOffer } from "@/components/enrich/EnrichOffer";
import { useStageQueue, type StageTask } from "./useStageQueue";

const greetingFor = (h: number) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

// Gemini-style landing: the ring as the mark, one personal line, one task, one composer.
export function HomeStage({ onOpenOverview }: { onOpenOverview: () => void }) {
  const { user } = useAuth();
  const { data: rings } = useRingsToday();
  const { queue, isLoading, setStalledBoost } = useStageQueue();
  const { kudos, acknowledge } = useRecentKudos();
  const [index, setIndex] = useState(0);
  const [focusTask, setFocusTask] = useState<StageTask | null>(null);
  const [replay, setReplay] = useState(0);

  const [wsIndex, setWsIndex] = useState(-1);
  const workspaces = useMemo(() => [...new Set(queue.map((t) => t.workspaceName))], [queue]);
  // Recent kudos lead the "all workspaces" stack; workspace views stay task-only.
  const shown: StageItem[] = useMemo(() => {
    const tasks = (wsIndex < 0 ? queue : queue.filter((t) => t.workspaceName === workspaces[wsIndex])).map(
      (task): StageItem => ({ kind: "task", task }),
    );
    return wsIndex < 0 ? [...kudos.map((k): StageItem => ({ kind: "kudos", kudos: k })), ...tasks] : tasks;
  }, [queue, kudos, wsIndex, workspaces]);
  const current = shown.length ? shown[index % shown.length] : null;
  const wsLabel = wsIndex < 0 ? "All workspaces" : workspaces[wsIndex];
  // -1 is "all"; wraps through each workspace and back.
  const shiftWorkspace = (dir: 1 | -1) => {
    const span = workspaces.length + 1;
    setWsIndex((w) => ((w + 1 + dir + span) % span) - 1);
    setIndex(0);
  };

  useEffect(() => {
    if (focusTask) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = shown.length;
      if (e.key === "ArrowDown" && n > 1) setIndex((i) => (i % n + 1) % n);
      else if (e.key === "ArrowUp" && n > 1) setIndex((i) => (i % n - 1 + n) % n);
      else if (e.key === "ArrowRight" && workspaces.length > 1) shiftWorkspace(1);
      else if (e.key === "ArrowLeft" && workspaces.length > 1) shiftWorkspace(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


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
            ) : current ? (
              <div className="flex w-full max-w-md flex-col items-center gap-3">
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Previous workspace" onClick={() => shiftWorkspace(-1)} className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">
                    <CaretLeft size={12} />
                  </button>
                  {wsIndex < 0 ? (
                    <ThemedText key={wsLabel} type="caption" className="min-w-32 text-center animate-in fade-in duration-200">
                      {wsLabel}
                    </ThemedText>
                  ) : (
                    <Link
                      key={wsLabel}
                      to={`/workspace/${encodeURIComponent(wsLabel)}`}
                      className="min-w-32 text-center text-muted-foreground underline-offset-2 transition-colors duration-150 animate-in fade-in hover:text-foreground hover:underline"
                    >
                      <ThemedText type="caption" className="text-inherit">
                        {wsLabel}
                      </ThemedText>
                    </Link>
                  )}
                  <button type="button" aria-label="Next workspace" onClick={() => shiftWorkspace(1)} className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">
                    <CaretRight size={12} />
                  </button>
                </div>
                <StageCardStack
                key={wsLabel}
                items={shown}
                index={index % shown.length}
                onIndexChange={setIndex}
                onStart={setFocusTask}
                onAcknowledge={acknowledge}
                onSetAside={(task) => setStalledBoost(task.id, false)}
              />
              </div>
            ) : (
              <ThemedText type="caption">Nothing on your plate. Add something below.</ThemedText>
            )}
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center gap-4 pb-4 animate-in fade-in duration-700">
            <EnrichOffer />
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
