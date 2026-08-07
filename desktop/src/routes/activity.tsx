import { useState } from "react";
import { ArrowClockwise, CaretDown } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ActivityHeatmap } from "@/components/activity/ActivityHeatmap";
import { SignalStrip } from "@/components/activity/SignalStrip";
import { ProgressWidget } from "@/components/activity/ProgressWidget";
import { CategoryShareWidget } from "@/components/activity/CategoryShareWidget";
import { HabitsWidget } from "@/components/activity/HabitsWidget";
import { CategoryHealthWidget } from "@/components/activity/CategoryHealthWidget";
import { WorkspaceHealthWidget } from "@/components/activity/WorkspaceHealthWidget";
import type { AnalyticsRange } from "@/components/activity/types";

const RANGE_OPTIONS: { label: string; value: AnalyticsRange }[] = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "6 Months", value: "sixmonth" },
];

export default function ActivityScreen() {
  const [range, setRange] = useState<AnalyticsRange>("week");
  const [workspace, setWorkspace] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<string | undefined>(undefined);

  const workspaces = useWorkspaces();

  const analytics = $api.useQuery("get", "/v1/user/analytics", {
    params: { query: { range, workspace, category } },
  });

  const onSelectWorkspace = (value: string) => {
    setWorkspace(value || undefined);
    setCategory(undefined);
  };

  return (
    <div className="flex w-full flex-col gap-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ThemedText type="titleFraunces" as="h1">
          Activity
        </ThemedText>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={workspace ?? ""}
              onChange={(e) => onSelectWorkspace(e.target.value)}
              className="h-9 appearance-none rounded-full border border-border bg-background pl-4 pr-8 text-sm text-foreground outline-none"
            >
              <option value="">All workspaces</option>
              {workspaces.data?.map((ws) => (
                <option key={ws.name} value={ws.name}>
                  {ws.name}
                </option>
              ))}
            </select>
            <CaretDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>

          <SegmentedControl
            options={RANGE_OPTIONS.map((o) => o.label)}
            value={RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "Week"}
            onChange={(label) => {
              const match = RANGE_OPTIONS.find((o) => o.label === label);
              if (match) setRange(match.value);
            }}
            accent
            className="w-64"
          />
        </div>
      </div>

      {category ? (
        <button
          type="button"
          onClick={() => setCategory(undefined)}
          className="flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/15"
        >
          <ThemedText type="caption" className="text-primary">
            Filtered by category
          </ThemedText>
          <span className="text-xs">×</span>
        </button>
      ) : null}

      {analytics.isLoading ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : analytics.isError || !analytics.data ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <ThemedText type="caption">Couldn't load your activity.</ThemedText>
          <button
            type="button"
            onClick={() => analytics.refetch()}
            className="flex items-center gap-1.5 text-primary"
          >
            <ArrowClockwise size={14} />
            <ThemedText type="defaultSemiBold" className="text-primary">
              Try again
            </ThemedText>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <SignalStrip signals={analytics.data.signals} />

          <section className="rounded-2xl border border-border p-6">
            <ThemedText type="subtitle" as="h3" className="mb-1 block">
              Activity graph
            </ThemedText>
            <ActivityHeatmap heatmap={analytics.data.heatmap} />
          </section>

          <ProgressWidget progress={analytics.data.progress} range={range} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoryShareWidget
              share={analytics.data.categoryShare}
              range={range}
              activeCategory={category}
              onSelectCategory={setCategory}
            />
            <HabitsWidget habits={analytics.data.habits} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoryHealthWidget categoryHealth={analytics.data.categoryHealth} />
            <WorkspaceHealthWidget workspaceHealth={analytics.data.workspaceHealth} />
          </div>
        </div>
      )}
    </div>
  );
}
