import type { JSX, ReactNode } from "react";
import { Flag, Plus } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { DateTimePicker, type PickedDateTime } from "@/components/task/DateTimePicker";

function fmt(iso: string, withTime: boolean): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (!withTime) return date;
  return `${date} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// Deadline is a single datetime; treat local midnight as "all day" (no time shown).
const hasClock = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
};

function PinRow({ label, value, placeholder }: { label: string; value?: string; placeholder: string }): JSX.Element {
  return (
    <div className="rounded-xl px-2 py-1.5 transition-colors hover:bg-muted">
      <ThemedText type="caption" className="block">
        {label}
      </ThemedText>
      {value ? (
        <ThemedText type="defaultSemiBold" className="block">
          {value}
        </ThemedText>
      ) : (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Plus size={13} />
          <ThemedText type="caption">{placeholder}</ThemedText>
        </span>
      )}
    </div>
  );
}

function Rail({ dot, connector }: { dot: ReactNode; connector?: boolean }): JSX.Element {
  return (
    <div className="flex w-5 flex-col items-center pt-2.5">
      {dot}
      {connector ? <span className="mt-1 h-8 w-px border-l border-dashed border-border" /> : null}
    </div>
  );
}

type Props = {
  startDate?: string;
  startTime?: string;
  deadline?: string;
  onChangeStart: (r: PickedDateTime | null) => void;
  onChangeDeadline: (r: PickedDateTime | null) => void;
};

// Vertical timeline: a "Starts" dot → dashed connector → a "Due" flag; each opens the picker.
export function ScheduleTimeline({
  startDate,
  startTime,
  deadline,
  onChangeStart,
  onChangeDeadline,
}: Props): JSX.Element {
  const startVal = startTime ?? startDate;
  const startHasTime = !!startTime;
  const deadlineHasTime = deadline ? hasClock(deadline) : false;

  return (
    <div className="flex flex-col">
      <div className="flex gap-3">
        <Rail dot={<span className="size-3 rounded-full border-2 border-primary" />} connector />
        <div className="flex-1 pb-1">
          <DateTimePicker value={startVal} hasTime={startHasTime} onChange={onChangeStart}>
            <PinRow label="Starts" value={startVal ? fmt(startVal, startHasTime) : undefined} placeholder="Add start" />
          </DateTimePicker>
        </div>
      </div>

      <div className="flex gap-3">
        <Rail dot={<Flag size={16} weight="fill" className="text-primary" />} />
        <div className="flex-1">
          <DateTimePicker
            value={deadline}
            hasTime={deadlineHasTime}
            minDate={new Date()}
            clearable
            onChange={onChangeDeadline}
          >
            <PinRow label="Due" value={deadline ? fmt(deadline, deadlineHasTime) : undefined} placeholder="Add deadline" />
          </DateTimePicker>
        </div>
      </div>
    </div>
  );
}

export default ScheduleTimeline;
