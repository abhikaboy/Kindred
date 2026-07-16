import { useState } from "react";
import { Bell, Flag, FlagCheckered, Plus, Repeat, X } from "@phosphor-icons/react";
import { MiniCalendar } from "@/components/create/MiniCalendar";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import type { TaskFormState } from "@/hooks/useCreateActions";

type Setter = (updater: (prev: TaskFormState) => TaskFormState) => void;
type Target = "start" | "deadline";

function withTime(day: Date, hhmm: string): Date {
  const [h, m] = (hhmm || "09:00").split(":").map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
const timeOf = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function localInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function spanLabel(start: Date, end: Date): string {
  if (dayOnly(start) === dayOnly(end)) return "Same day";
  const days = Math.round((dayOnly(end) - dayOnly(start)) / 86400000) + 1;
  return `${days} days`;
}

const timeInput =
  "rounded-md border border-input bg-transparent px-1.5 py-0.5 text-sm outline-none focus-visible:border-ring disabled:opacity-40 dark:bg-input/30";

// One node on the vertical timeline rail: a dot (filled when set / ringed when
// it's the active pick target) + a connecting line down to the next node.
function Node({
  filled,
  active,
  last,
  children,
}: {
  filled: boolean;
  active?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center pt-1">
        <span
          className={cn(
            "size-3 shrink-0 rounded-full border-2 transition-colors",
            filled ? "border-primary bg-primary" : active ? "border-primary bg-background" : "border-border bg-background",
          )}
        />
        {!last && <span className="my-1 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 flex-1 pb-3">{children}</div>
    </div>
  );
}

// A start/deadline node's body: activatable label, concrete date + time, clear.
function Endpoint({
  icon,
  label,
  date,
  isTarget,
  onActivate,
  onClear,
  onTime,
}: {
  icon: React.ReactNode;
  label: string;
  date: Date | null;
  isTarget: boolean;
  onActivate: () => void;
  onClear: () => void;
  onTime: (hhmm: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onActivate} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          {icon} {label}
        </button>
        {date && (
          <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        )}
      </div>
      {date ? (
        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={onActivate}>
            <ThemedText type="defaultSemiBold" className="text-sm">{fmt(date)}</ThemedText>
          </button>
          <input type="time" value={timeOf(date)} onChange={(e) => onTime(e.target.value)} className={timeInput} />
        </div>
      ) : (
        <button type="button" onClick={onActivate} className="mt-0.5 text-left">
          <ThemedText type="caption" className={isTarget ? "text-primary" : "text-muted-foreground/70"}>
            {isTarget ? "Pick a day →" : `Set ${label.toLowerCase()}`}
          </ThemedText>
        </button>
      )}
    </>
  );
}

// Expanded timeline planner: block dates on the calendar (left); a vertical
// timeline (right) grounds start → reminders → deadline, handling start-only,
// deadline-only, and same-day. Nudges recurring once a date is picked.
export function TaskTimeline({ form, setForm }: { form: TaskFormState; setForm: Setter }) {
  const start = form.startDate ? new Date(form.startDate) : null;
  const end = form.deadline ? new Date(form.deadline) : null;
  const [target, setTarget] = useState<Target>(() => (start && !end ? "deadline" : "start"));
  const [hintDismissed, setHintDismissed] = useState(false);

  const setStart = (d: Date | null) =>
    setForm((prev) => {
      const iso = d ? d.toISOString() : null;
      // Start moved past the deadline → drop the now-invalid deadline.
      const keepEnd = !(d && prev.deadline && dayOnly(new Date(prev.deadline)) < dayOnly(d));
      return { ...prev, startDate: iso, startTime: iso, deadline: keepEnd ? prev.deadline : null };
    });

  const setEnd = (d: Date | null) =>
    setForm((prev) => {
      const iso = d ? d.toISOString() : null;
      // Deadline before the start → drop the now-invalid start.
      const keepStart = !(d && prev.startDate && dayOnly(d) < dayOnly(new Date(prev.startDate)));
      return {
        ...prev,
        deadline: iso,
        startDate: keepStart ? prev.startDate : null,
        startTime: keepStart ? prev.startTime : null,
      };
    });

  const pick = (day: Date) => {
    if (target === "start") {
      setStart(withTime(day, start ? timeOf(start) : "09:00"));
      setTarget("deadline");
    } else {
      setEnd(withTime(day, end ? timeOf(end) : "17:00"));
    }
  };

  const setReminderAt = (index: number, local: string) =>
    setForm((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r, i) =>
        i === index ? { triggerTime: local ? new Date(local).toISOString() : "" } : r,
      ),
    }));
  const addReminder = () =>
    setForm((prev) => ({
      ...prev,
      reminders: [...prev.reminders, { triggerTime: (end ?? start ?? new Date()).toISOString() }],
    }));
  const removeReminder = (index: number) =>
    setForm((prev) => ({ ...prev, reminders: prev.reminders.filter((_, i) => i !== index) }));

  // Recurring nudge: sets a sensible cadence anchored on the picked day.
  const anchor = start ?? end ?? new Date();
  const makeDaily = () =>
    setForm((prev) => ({ ...prev, recurring: true, flex: null, recurFrequency: "daily", every: 1 }));
  const makeWeekly = () =>
    setForm((prev) => {
      const days = [0, 0, 0, 0, 0, 0, 0];
      days[anchor.getDay()] = 1;
      return { ...prev, recurring: true, flex: null, recurFrequency: "weekly", every: 1, daysOfWeek: days };
    });
  const showHint = (!!start || !!end) && !form.recurring && !form.flex && !hintDismissed;

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <ThemedText type="defaultSemiBold" className="text-sm">Timeline</ThemedText>
        {start && end ? (
          <ThemedText type="caption" className="text-foreground">{spanLabel(start, end)}</ThemedText>
        ) : (
          <ThemedText type="caption" className="text-muted-foreground">Block out when you'll work on it</ThemedText>
        )}
      </div>

      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          <MiniCalendar start={start} end={end} onPick={pick} />
        </div>

        <div className="flex w-56 shrink-0 flex-col">
          <Node filled={!!start} active={target === "start"}>
            <Endpoint
              icon={<Flag size={13} />}
              label="Start"
              date={start}
              isTarget={target === "start"}
              onActivate={() => setTarget("start")}
              onClear={() => { setStart(null); setTarget("start"); }}
              onTime={(t) => start && setStart(withTime(start, t))}
            />
          </Node>

          <Node filled={form.reminders.length > 0}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bell size={13} /> Reminders
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {form.reminders.map((r, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="datetime-local"
                    value={localInput(r.triggerTime)}
                    onChange={(e) => setReminderAt(i, e.target.value)}
                    className={cn(timeInput, "min-w-0 flex-1")}
                  />
                  <button
                    type="button"
                    onClick={() => removeReminder(i)}
                    aria-label="Remove reminder"
                    className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addReminder}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus size={11} /> Add reminder
              </button>
            </div>
          </Node>

          <Node filled={!!end} active={target === "deadline"} last>
            <Endpoint
              icon={<FlagCheckered size={13} />}
              label="Deadline"
              date={end}
              isTarget={target === "deadline"}
              onActivate={() => setTarget("deadline")}
              onClear={() => { setEnd(null); setTarget("deadline"); }}
              onTime={(t) => end && setEnd(withTime(end, t))}
            />
          </Node>
        </div>
      </div>

      {showHint && (
        <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 shadow-sm">
          <Repeat size={14} className="text-primary" />
          <ThemedText type="caption" className="flex-1 text-foreground">Repeat this task?</ThemedText>
          <button type="button" onClick={makeDaily} className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted">
            Daily
          </button>
          <button type="button" onClick={makeWeekly} className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted">
            Weekly
          </button>
          <button type="button" onClick={() => setHintDismissed(true)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
