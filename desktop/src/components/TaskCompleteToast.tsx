import { toast } from "sonner";
import { CaretRight } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";

const DURATION = 6000;

// Mobile TaskToast parity: a tappable "you did it — go post it" card with a
// countdown bar. Tapping opens the post composer for the just-completed task.
export function showTaskCompleteToast({ streak, onShare }: { streak?: number; onShare: () => void }): void {
  const message =
    streak && streak > 1
      ? `🔥 ${streak} day streak! Click here to post and document your task.`
      : "Congrats! Click here to post and document your task.";

  toast.custom(
    (id) => (
      <button
        type="button"
        onClick={() => {
          onShare();
          toast.dismiss(id);
        }}
        className="flex w-[360px] max-w-[90vw] flex-col overflow-hidden rounded-xl border bg-card text-left shadow-lg transition-transform hover:scale-[1.01]"
      >
        <div className="flex items-center gap-3 p-4">
          <span className="text-2xl leading-none">🎉</span>
          <ThemedText type="default" className="flex-1">
            {message}
          </ThemedText>
          <CaretRight size={20} weight="bold" className="shrink-0 text-muted-foreground" />
        </div>
        <div className="task-toast-bar h-1 origin-left bg-primary" />
      </button>
    ),
    { duration: DURATION }
  );
}
