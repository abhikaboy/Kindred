import { useMemo, useState } from "react";
import { $api } from "@/lib/api/query";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types.gen";

type HeatmapDay = components["schemas"]["AnalyticsHeatmapDay"];

const AUTH_PARAMS = { params: { query: { range: "month" as const } } };

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function ActivityHeatmap() {
  const { data, isLoading } = $api.useQuery("get", "/v1/user/analytics", AUTH_PARAMS);
  const heatmap = data?.heatmap;
  const [hovered, setHovered] = useState<HeatmapDay | null>(null);

  const weeks = useMemo(() => toWeeks(heatmap?.days ?? []), [heatmap?.days]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (!heatmap || weeks.length === 0) {
    return <ThemedText type="caption">Complete a task to start your activity graph.</ThemedText>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <ThemedText type="caption">{heatmap.takeaway}</ThemedText>
        <ThemedText type="caption">
          {hovered
            ? `${hovered.count} completed on ${parseLocalDate(hovered.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}`
            : `${heatmap.total} completed in the last 13 weeks`}
        </ThemedText>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]" onMouseLeave={() => setHovered(null)}>
          {weeks.map((week, wi) => {
            const firstDay = week.find((d) => d !== null);
            const prevFirstDay = weeks[wi - 1]?.find((d) => d !== null);
            const showMonthLabel =
              wi === 0 ||
              (firstDay &&
                prevFirstDay &&
                parseLocalDate(firstDay.date).getMonth() !== parseLocalDate(prevFirstDay.date).getMonth());

            return (
              <div key={wi} className="flex flex-col gap-[3px]">
                <ThemedText type="caption" className="h-4 text-[10px] leading-4">
                  {showMonthLabel && firstDay ? MONTH_LABELS[parseLocalDate(firstDay.date).getMonth()] : ""}
                </ThemedText>
                {week.map((day, di) =>
                  day ? (
                    <div
                      key={di}
                      onMouseEnter={() => setHovered(day)}
                      className={cn("size-[11px] rounded-[2px]", LEVEL_CLASS[day.level] ?? LEVEL_CLASS[0])}
                    />
                  ) : (
                    <div key={di} className="size-[11px]" />
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <ThemedText type="caption">Less</ThemedText>
        {[0, 1, 2, 3, 4].map((level) => (
          <div key={level} className={cn("size-[11px] rounded-[2px]", LEVEL_CLASS[level])} />
        ))}
        <ThemedText type="caption">More</ThemedText>
      </div>
    </div>
  );
}
