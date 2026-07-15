import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export type PickedDateTime = { date: Date; hasTime: boolean };

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const pad = (n: number) => String(n).padStart(2, "0");
const to24 = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "HH:mm" (24h) → "h:mm AM/PM".
function display12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${ap}`;
}

// Accepts "5", "5:30", "5:30 pm", "17:30" → "HH:mm" (24h), or null if unparseable.
function parseTime(input: string): string | null {
  const m = input.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    if (m[3] === "pm" && h !== 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
  } else if (h > 23) return null;
  return `${pad(h)}:${pad(min)}`;
}

function nudge(hhmm: string, deltaMin: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h * 60 + m + deltaMin) % 1440 + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// Custom time field: type it ("5:30 pm"), or ArrowUp/Down to step by 15 min. Commits on Enter/blur.
function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const [text, setText] = useState(() => display12(value));
  useEffect(() => setText(display12(value)), [value]);

  const commit = () => {
    const parsed = parseTime(text);
    if (parsed) onChange(parsed);
    else setText(display12(value));
  };

  return (
    <input
      aria-label="Time"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onChange(nudge(value, 15));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onChange(nudge(value, -15));
        }
      }}
      className="w-24 rounded-lg border bg-background px-3 py-1.5 text-center text-sm font-medium text-foreground outline-none transition-colors focus:border-primary"
    />
  );
}

function Panel({
  value,
  hasTime,
  minDate,
  clearable,
  onApply,
  onClose,
}: {
  value?: string;
  hasTime?: boolean;
  minDate?: Date;
  clearable?: boolean;
  onApply: (r: PickedDateTime | null) => void;
  onClose: () => void;
}): JSX.Element {
  const initial = value ? new Date(value) : new Date();
  const [selected, setSelected] = useState<Date>(initial);
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [withTime, setWithTime] = useState(hasTime ?? false);
  const [time, setTime] = useState(value && hasTime ? to24(initial) : "09:00");
  const dayRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const minDay = minDate && new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  const today = new Date();

  // Land keyboard focus on the selected day when the popover opens.
  useEffect(() => {
    if (selected.getMonth() === month && selected.getFullYear() === year) {
      dayRefs.current[selected.getDate() - 1]?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setQuick = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelected(d);
    setView(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const apply = () => {
    const [h, m] = time.split(":").map(Number);
    onApply({
      date: new Date(year, month, selected.getDate(), withTime ? h : 0, withTime ? m : 0, 0, 0),
      hasTime: withTime,
    });
  };

  // Roving arrow-key navigation across the day grid.
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (!delta) return;
    const idx = dayRefs.current.findIndex((el) => el === document.activeElement);
    if (idx < 0) return;
    const next = dayRefs.current[idx + delta];
    if (next && !next.disabled) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Pick date and time"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border bg-card p-4 shadow-xl"
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[
          { label: "Today", off: 0 },
          { label: "Tomorrow", off: 1 },
          { label: "Next week", off: 7 },
        ].map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setQuick(q.off)}
            className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted focus-visible:border-primary focus-visible:outline-none"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <CaretLeft size={16} />
        </button>
        <ThemedText type="defaultSemiBold" className="text-sm">
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </ThemedText>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <CaretRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center" onKeyDown={onGridKeyDown}>
        {WEEKDAYS.map((w) => (
          <ThemedText key={w} type="caption" className="py-1 text-[11px]">
            {w}
          </ThemedText>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(year, month, day);
          const disabled = minDay ? d < minDay : false;
          const isSel = sameDay(d, selected);
          const isToday = sameDay(d, today);
          return (
            <button
              key={day}
              ref={(el) => {
                dayRefs.current[i] = el;
              }}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(d)}
              className={cn(
                "mx-auto flex size-9 items-center justify-center rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                disabled && "opacity-30",
                isSel
                  ? "bg-primary font-medium text-primary-foreground"
                  : cn("hover:bg-muted", isToday && "font-semibold text-primary")
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <Switch checked={withTime} onCheckedChange={setWithTime} />
          <ThemedText type="caption">Set time</ThemedText>
        </div>
        {withTime ? <TimeInput value={time} onChange={setTime} /> : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {clearable ? (
          <Button variant="ghost" size="sm" onClick={() => onApply(null)}>
            Clear
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={apply}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

// A trigger (children) that opens a calendar + custom-time popover. Reused for start & deadline.
export function DateTimePicker({
  value,
  hasTime,
  minDate,
  clearable,
  onChange,
  children,
}: {
  value?: string;
  hasTime?: boolean;
  minDate?: Date;
  clearable?: boolean;
  onChange: (r: PickedDateTime | null) => void;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {children}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <Panel
            value={value}
            hasTime={hasTime}
            minDate={minDate}
            clearable={clearable}
            onClose={close}
            onApply={(r) => {
              onChange(r);
              close();
            }}
          />
        </>
      ) : null}
    </div>
  );
}

export default DateTimePicker;
