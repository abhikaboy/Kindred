import { useMemo, useState } from "react";
import { $api } from "@/lib/api/query";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types.gen";
import type { AnalyticsResponse } from "./types";

type HeatmapDay = components["schemas"]["AnalyticsHeatmapDay"];
type TaskDocument = components["schemas"]["TaskDocument"];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const LEVEL_CLASS: Record<number, string> = {
  0: "bg-muted",
  1: "bg-primary/20",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary",
};

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatLongDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

// Mon=0 ... Sun=6, matching the mobile heatmap so both read the same week.
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// GitHub-style layout: weeks as columns, weekdays as rows.
function toWeeks(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  if (days.length === 0) return [];
  const leadingBlanks = mondayIndex(parseLocalDate(days[0].date));
  const cells: (HeatmapDay | null)[] = [...Array(leadingBlanks).fill(null), ...days];

  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export function ActivityHeatmap({ heatmap }: { heatmap: AnalyticsResponse["heatmap"] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HeatmapDay | null>(null);
  // The heatmap window's own last day, not the client clock — avoids a
  // client/server timezone mismatch putting the ring on the wrong cell.
  const today = heatmap?.days?.[heatmap.days.length - 1]?.date;

  const weeks = useMemo(() => toWeeks(heatmap?.days ?? []), [heatmap?.days]);

  const detail = $api.useQuery(
    "get",
    "/v1/user/tasks/completed/date",
    { params: { header: { Authorization: "" }, query: { date: selectedDate ?? "", timezone: TIMEZONE } } },
    { enabled: !!selectedDate }
  );

  if (!heatmap || weeks.length === 0) {
    return <ThemedText type="caption">Complete a task to start your activity graph.</ThemedText>;
  }

  const summary = hovered
    ? `${hovered.count} completed · ${formatLongDate(hovered.date)}`
    : `${heatmap.total} completed in the last 13 weeks`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <ThemedText type="caption">{heatmap.takeaway}</ThemedText>
        <ThemedText type="caption">{summary}</ThemedText>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-3" onMouseLeave={() => setHovered(null)}>
            <div className="flex flex-col gap-[5px] pt-6">
              {WEEKDAY_LABELS.map((label, i) => (
                <ThemedText key={i} type="caption" className="h-[15px] text-[10px] leading-[15px]">
                  {label}
                </ThemedText>
              ))}
            </div>

            <div className="flex gap-[5px]">
              {weeks.map((week, wi) => {
                const firstDay = week.find((d) => d !== null);
                const prevFirstDay = weeks[wi - 1]?.find((d) => d !== null);
                const showMonthLabel =
                  wi === 0 ||
                  (firstDay &&
                    prevFirstDay &&
                    parseLocalDate(firstDay.date).getMonth() !== parseLocalDate(prevFirstDay.date).getMonth());

                return (
                  <div key={wi} className="flex flex-col gap-[5px]">
                    <ThemedText type="caption" className="h-4 text-[10px] leading-4">
                      {showMonthLabel && firstDay ? MONTH_LABELS[parseLocalDate(firstDay.date).getMonth()] : ""}
                    </ThemedText>
                    {week.map((day, di) =>
                      day ? (
                        <button
                          key={di}
                          type="button"
                          onMouseEnter={() => setHovered(day)}
                          onClick={() => day.count > 0 && setSelectedDate(day.date === selectedDate ? null : day.date)}
                          title={`${day.count} completed · ${formatLongDate(day.date)}`}
                          className={cn(
                            "size-[15px] rounded-[3px] transition-transform hover:scale-110",
                            day.count === 0 && "cursor-default",
                            LEVEL_CLASS[day.level] ?? LEVEL_CLASS[0],
                            day.date === today && "ring-1 ring-foreground/40 ring-offset-1 ring-offset-card",
                            day.date === selectedDate && "ring-2 ring-primary ring-offset-1 ring-offset-card"
                          )}
                        />
                      ) : (
                        <div key={di} className="size-[15px]" />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-1.5">
            <ThemedText type="caption">Less</ThemedText>
            {[0, 1, 2, 3, 4].map((level) => (
              <div key={level} className={cn("size-[13px] rounded-[3px]", LEVEL_CLASS[level])} />
            ))}
            <ThemedText type="caption">More</ThemedText>
          </div>
        </div>

        <div className="min-w-0 flex-1 rounded-xl border border-border bg-muted/40 p-4 lg:sticky lg:top-0">
          {selectedDate ? (
            <DayDetail
              date={selectedDate}
              tasks={detail.data?.tasks}
              isLoading={detail.isLoading}
            />
          ) : (
            <ThemedText type="caption">Click a day on the graph to see what you finished.</ThemedText>
          )}
        </div>
      </div>
    </div>
  );
}

function DayDetail({
  date,
  tasks,
  isLoading,
}: {
  date: string;
  tasks: TaskDocument[] | undefined;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ThemedText type="defaultSemiBold">Completed on {formatLongDate(date)}</ThemedText>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <ThemedText type="caption">No tasks completed on this day.</ThemedText>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-border bg-card px-3 py-2">
              <ThemedText type="defaultSemiBold" className="block text-sm">
                {task.content}
              </ThemedText>
              {task.timeCompleted ? (
                <ThemedText type="caption" className="text-xs">
                  {new Date(task.timeCompleted).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </ThemedText>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
