import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Leaf } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import PrimaryButton from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { $api } from "@/lib/api/query";
import { useRingsHistory, useRingsToday, type RingState } from "@/hooks/useRings";

const DAYS = ["Today", "Yesterday"] as const;
type Day = (typeof DAYS)[number];
const NOTE_MAX = 140;

// Ring dates are the user's local day keyed at midnight UTC.
function localKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isPaused(history: RingState[] | undefined, daysAgo: number): boolean {
  const key = localKey(daysAgo);
  return !!history?.some((h) => h.date.slice(0, 10) === key && h.paused);
}

function useInvalidateRings() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["get", "/v1/user/rings/today"] });
    qc.invalidateQueries({ queryKey: ["get", "/v1/user/rings/history"] });
  };
}

/** Today's pause state, for dimming the rings while paused. */
export function usePausedToday(): boolean {
  const { data } = useRingsToday();
  return !!data?.ring_state.paused;
}

/**
 * A quiet, private "life happened" entry under the rings. A paused day holds
 * rings, the run and the score; friends never see it.
 */
export function LifeHappened() {
  const { data: today } = useRingsToday();
  const { data: history } = useRingsHistory();
  const invalidate = useInvalidateRings();
  const unpause = $api.useMutation("delete", "/v1/user/rings/pause");
  const [open, setOpen] = useState(false);

  const pausedToday = !!today?.ring_state.paused;
  const pausedYesterday = isPaused(history?.history, 1);

  const undo = async (daysAgo: number) => {
    try {
      await unpause.mutateAsync({ params: { query: { days_ago: daysAgo } } } as never);
      invalidate();
    } catch {
      toast.error("Couldn't undo the pause. Try again.");
    }
  };

  const pausedLines: { label: string; daysAgo: number }[] = [];
  if (pausedToday) pausedLines.push({ label: "Paused today", daysAgo: 0 });
  if (pausedYesterday) pausedLines.push({ label: "Yesterday paused", daysAgo: 1 });

  return (
    <div className="flex flex-col gap-1">
      {pausedLines.map(({ label, daysAgo }) => (
        <ThemedText key={daysAgo} type="caption">
          {label} · only you can see this ·{" "}
          <button
            type="button"
            onClick={() => undo(daysAgo)}
            disabled={unpause.isPending}
            className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            Undo
          </button>
        </ThemedText>
      ))}
      {!(pausedToday && pausedYesterday) && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-fit cursor-pointer items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Leaf size={14} />
          <ThemedText type="caption" className="text-inherit">
            Life happened
          </ThemedText>
        </button>
      )}
      <LifeHappenedDialog
        open={open}
        onOpenChange={setOpen}
        initialDay={pausedToday ? "Yesterday" : "Today"}
        disabledDay={pausedToday ? "Today" : pausedYesterday ? "Yesterday" : undefined}
        onPaused={invalidate}
      />
    </div>
  );
}

function LifeHappenedDialog({
  open,
  onOpenChange,
  initialDay,
  disabledDay,
  onPaused,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDay: Day;
  disabledDay?: Day;
  onPaused: () => void;
}) {
  const pause = $api.useMutation("post", "/v1/user/rings/pause");
  const [day, setDay] = useState<Day>(initialDay);
  const [note, setNote] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDay(initialDay);
      setNote("");
    }
    onOpenChange(next);
  };

  const alreadyPaused = day === disabledDay;

  const submit = async () => {
    try {
      await pause.mutateAsync({
        body: { days_ago: day === "Today" ? 0 : 1, note: note.trim() || undefined },
      } as never);
      onPaused();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't pause this day. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <div className="flex flex-col gap-2">
          <DialogTitle className="font-heading text-[22px] font-semibold tracking-[-1px]">Life happened</DialogTitle>
          <ThemedText type="lightBody">
            Rings, your run and your score hold where they are. Only you can see this.
          </ThemedText>
        </div>

        {/* Only offer the choice when both days are open. */}
        {disabledDay ? null : <SegmentedControl options={[...DAYS]} value={day} onChange={(v) => setDay(v as Day)} />}

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          placeholder="Add a note for yourself"
          maxLength={NOTE_MAX}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !alreadyPaused && !pause.isPending) submit();
          }}
        />

        <div className="flex flex-col gap-2">
          <PrimaryButton
            title={disabledDay ? `Pause ${day.toLowerCase()}` : "Pause"}
            onClick={submit}
            disabled={alreadyPaused || pause.isPending}
          />
          <ThemedText type="caption">No reason needed. Friends won't see ring updates.</ThemedText>
        </div>
      </DialogContent>
    </Dialog>
  );
}
