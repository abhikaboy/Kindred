import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsRange, AnalyticsResponse } from "./types";

export function CategoryShareWidget({
  share,
  range,
  activeCategory,
  onSelectCategory,
}: {
  share: AnalyticsResponse["categoryShare"];
  range: AnalyticsRange;
  activeCategory?: string;
  onSelectCategory: (categoryId?: string) => void;
}) {
  const slices = share.slices ?? [];
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const title = range === "week" ? "Where your time went" : "Category share";

  let acc = 0;
  const stops = slices
    .map((s) => {
      const start = total ? (acc / total) * 360 : 0;
      acc += s.count;
      const end = total ? (acc / total) * 360 : 0;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <WidgetCard title={title} takeaway={share.takeaway}>
      {slices.length === 0 ? (
        <ThemedText type="caption">No completed tasks in this period yet.</ThemedText>
      ) : (
        <div className="flex items-center gap-6">
          <div
            className="relative size-28 shrink-0 rounded-full"
            style={{ background: total ? `conic-gradient(${stops})` : "var(--color-muted)" }}
          >
            <div className="absolute inset-2.5 flex items-center justify-center rounded-full bg-card">
              <ThemedText type="defaultSemiBold">{total}</ThemedText>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {slices.map((slice) => {
              const clickable = slice.categoryId !== "other";
              const active = activeCategory === slice.categoryId;
              return (
                <button
                  key={slice.categoryId}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onSelectCategory(active ? undefined : slice.categoryId)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                    clickable && "hover:bg-muted",
                    active && "bg-primary/10"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                    <ThemedText type="default" className="truncate text-sm">
                      {slice.name}
                    </ThemedText>
                  </span>
                  <ThemedText type="defaultSemiBold" className="shrink-0 text-sm">
                    {Math.round(slice.pct)}%
                  </ThemedText>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
