import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CalendarBlank,
  Fire,
  Gauge,
  ListChecks,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { ProductivityRings } from "@/components/home/ProductivityRings";
import { ThemedText } from "@/components/ThemedText";
import { useRingsToday } from "@/hooks/useRings";
import { useTodayTasks } from "@/hooks/useHomeTasks";
import { useTaskCountsByDay, dayKey } from "@/hooks/useTaskCountsByDay";
import { cn } from "@/lib/utils";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

// The Sunday-anchored week containing `today`, as seven local dates.
function weekOf(today: Date): Date[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/**
 * One stat: an icon carries the meaning, the number carries the value, and an
 * optional meter shows it against its ceiling. The label is exposed to
 * assistive tech and on hover rather than set as a caption — three stacked
 * uppercase words read as noise next to the rings.
 */
function Stat({
  icon: Icon,
  value,
  label,
  accent,
  meter,
}: {
  icon: PhosphorIcon;
  value: number | string;
  label: string;
  /** Tint the icon when the stat is "live" (a running streak, work due). */
  accent?: boolean;
  /** 0–1 fill, for stats with a known ceiling. */
  meter?: number;
}) {
  return (
    <div className="flex items-center gap-2.5" title={label}>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon size={18} weight={accent ? "fill" : "regular"} />
      </span>
      <span className="w-8 font-sans text-lg font-semibold leading-none tabular-nums">{value}</span>
      {meter === undefined ? null : (
        <span className="block h-1 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.round(Math.min(Math.max(meter, 0), 1) * 100)}%` }}
          />
        </span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}

// A week at a glance: one dot column per day, sized by how much is scheduled,
// today ringed. Counts come from the workspaces already in cache, so this adds
// no network of its own. Clicking through lands on the calendar.
function WeekStrip() {
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => weekOf(today), [today]);
  const counts = useTaskCountsByDay(days[0], days[6]);
  const todayKey = dayKey(today);

  return (
    <Link
      to="/calendar"
      className="group flex flex-1 flex-col gap-3 rounded-xl p-3 transition-colors hover:bg-muted/60"
      aria-label="Open calendar"
    >
      <div className="flex items-center gap-2">
        <CalendarBlank size={14} className="text-muted-foreground" />
        <ThemedText type="caption" className="uppercase tracking-wider text-muted-foreground">
          This week
        </ThemedText>
      </div>
      <div className="flex items-end justify-between gap-2">
        {days.map((day) => {
          const key = dayKey(day);
          const count = counts[key]?.count ?? 0;
          const isToday = key === todayKey;
          return (
            <div key={key} className="flex w-8 flex-col items-center gap-2">
              <ThemedText
                type="caption"
                className={cn("text-[11px]", isToday ? "text-foreground" : "text-muted-foreground")}
              >
                {WEEKDAY[day.getDay()]}
              </ThemedText>
              <div
                className={cn(
                  "grid size-8 place-items-center rounded-lg text-xs tabular-nums transition-colors",
                  count === 0 && "bg-muted text-muted-foreground",
                  count > 0 && count <= 2 && "bg-primary/20 text-primary",
                  count > 2 && "bg-primary/45 text-primary",
                  isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card"
                )}
              >
                {count || ""}
              </div>
              <ThemedText
                type="caption"
                className={cn("text-[11px]", isToday ? "text-foreground" : "text-muted-foreground")}
              >
                {day.getDate()}
              </ThemedText>
            </div>
          );
        })}
      </div>
    </Link>
  );
}

// WHOOP-style band: the rings keep their place as the headline metric, with the
// week strip and the streak/score stats the API already returns filling the
// width beside them, and one contextual call to action.
export function TodayHero() {
  const { data } = useRingsToday();
  const todayTasks = useTodayTasks();

  const dueToday = todayTasks.length;
  const score = data?.productivity_score;
  const streak = data?.current_streak;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_28px_-14px_rgba(0,0,0,0.08)] lg:flex-row lg:items-center lg:gap-8">
      <ProductivityRings />

      <div className="hidden w-px self-stretch bg-border lg:block" />

      <WeekStrip />

      <div className="hidden w-px self-stretch bg-border lg:block" />

      <div className="flex flex-col gap-3">
        <Stat
          icon={Gauge}
          value={score ?? "—"}
          label={`Productivity score ${score ?? 0} of 100`}
          meter={(score ?? 0) / 100}
        />
        <Stat
          icon={Fire}
          value={streak ?? "—"}
          label={`${streak ?? 0} day streak`}
          accent={(streak ?? 0) > 0}
        />
        <Stat
          icon={ListChecks}
          value={dueToday}
          label={`${dueToday} due today`}
          accent={dueToday > 0}
        />
      </div>
    </div>
  );
}
