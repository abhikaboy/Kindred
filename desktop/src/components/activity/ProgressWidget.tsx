import { ThemedText } from "@/components/ThemedText";
import { directionClass } from "./status";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsRange, AnalyticsResponse } from "./types";

const TITLES: Record<AnalyticsRange, string> = {
  week: "Weekly progress",
  month: "Monthly progress",
  sixmonth: "6-month progress",
};

const SUFFIX: Record<AnalyticsRange, string> = {
  week: "vs last week",
  month: "vs last month",
  sixmonth: "vs prior 6 months",
};

export function ProgressWidget({ progress, range }: { progress: AnalyticsResponse["progress"]; range: AnalyticsRange }) {
  const buckets = progress.buckets ?? [];
  const max = Math.max(1, ...buckets.map((b) => b.total ?? 0));
  const dir = progress.delta > 0 ? "up" : progress.delta < 0 ? "down" : "flat";
  const sign = progress.delta >= 0 ? "+" : "";

  return (
    <WidgetCard title={TITLES[range]} takeaway={progress.takeaway}>
      <div className="mb-5 flex items-baseline gap-3">
        <ThemedText type="fancyFrauncesHeading" className="text-3xl">
          {progress.total}
        </ThemedText>
        <ThemedText type="caption" className={directionClass(dir)}>
          {`${sign}${Math.round(progress.delta)}% ${SUFFIX[range]}`}
        </ThemedText>
      </div>

      <div className="flex h-40 items-end gap-2">
        {buckets.map((bucket) => {
          const segments = bucket.segments?.length ? bucket.segments : null;
          return (
            <div key={bucket.date} className="flex h-full flex-1 flex-col items-center gap-2" title={`${bucket.label}: ${bucket.total}`}>
              <div className="flex w-full flex-1 flex-col-reverse justify-start overflow-hidden rounded-md bg-muted/60">
                {segments
                  ? segments.map((seg, i) => (
                      <div
                        key={i}
                        className="w-full last:rounded-t-md"
                        style={{ height: `${(seg.count / max) * 100}%`, backgroundColor: seg.color }}
                      />
                    ))
                  : null}
              </div>
              <ThemedText type="caption" className="text-[10px] whitespace-nowrap">
                {bucket.label}
              </ThemedText>
            </div>
          );
        })}
      </div>

      {progress.legend?.length ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {progress.legend.map((item) => (
            <div key={item.categoryId} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <ThemedText type="caption">{item.name}</ThemedText>
            </div>
          ))}
        </div>
      ) : null}
    </WidgetCard>
  );
}
