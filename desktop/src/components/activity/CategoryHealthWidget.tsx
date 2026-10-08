import { ThemedText } from "@/components/ThemedText";
import { Sparkline } from "./Sparkline";
import { StatusText } from "./StatusText";
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
              <div className="flex min-w-0 items-center gap-3">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <div className="min-w-0">
                  <ThemedText type="defaultSemiBold" className="block truncate">
                    {row.name}
                  </ThemedText>
                  <ThemedText type="caption">
                    {row.onTimePct}% on time · {row.kudos} kudos
                    <StatusText status={row.status} />
                  </ThemedText>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Sparkline data={row.sparkline ?? []} style={{ color: row.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
