import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsResponse } from "./types";

// Who shows up for you, plus how much of your work gets support. Thanks people, never ranks them.
export function SupportersWidget({
  supporters,
  coverage,
}: {
  supporters: AnalyticsResponse["topSupporters"];
  coverage: AnalyticsResponse["supportCoverage"];
}) {
  return (
    <WidgetCard title="Who showed up for you" takeaway={coverage.takeaway}>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <ThemedText type="subheading" className="tabular-nums">
            {Math.round(coverage.pct)}%
          </ThemedText>
          <ThemedText type="caption">
            of tasks got support · {coverage.supported} of {coverage.total}
          </ThemedText>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, coverage.pct)}%` }} />
        </div>
      </div>

      {supporters.length > 0 && (
        <div className="flex flex-col gap-1">
          {supporters.map((s) => (
            <Link
              key={s.id}
              to={`/account/${s.id}`}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
            >
              {s.icon ? (
                <img src={s.icon} alt="" className="size-8 shrink-0 rounded-full bg-muted object-cover" />
              ) : (
                <span className="size-8 shrink-0 rounded-full bg-primary" />
              )}
              <ThemedText type="defaultSemiBold" className="min-w-0 flex-1 truncate">
                {s.name}
              </ThemedText>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
