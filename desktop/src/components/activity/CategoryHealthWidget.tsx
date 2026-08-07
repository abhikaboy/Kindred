import { ThemedText } from "@/components/ThemedText";
import { Sparkline } from "./Sparkline";
import { StatusPill } from "./StatusPill";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsResponse } from "./types";

export function CategoryHealthWidget({ categoryHealth }: { categoryHealth: AnalyticsResponse["categoryHealth"] }) {
  const rows = categoryHealth.rows ?? [];

  return (
    <WidgetCard title="Category health">
      {rows.length === 0 ? (
        <ThemedText type="caption">No category activity in this period yet.</ThemedText>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.categoryId} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <div className="min-w-0">
                  <ThemedText type="defaultSemiBold" className="block truncate text-sm">
                    {row.name}
                  </ThemedText>
                  <ThemedText type="caption">
                    {row.onTimePct}% on time · {row.kudos} Kudos
                  </ThemedText>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <Sparkline data={row.sparkline ?? []} style={{ color: row.color }} />
                <StatusPill status={row.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
