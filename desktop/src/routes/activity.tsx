import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowClockwise, CaretDown } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ThemedText } from "@/components/ThemedText";
import { WeekRecapEntry } from "@/components/weekrecap/WeekRecapEntry";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ActivityHeatmap } from "@/components/activity/ActivityHeatmap";
import { SignalStrip } from "@/components/activity/SignalStrip";
import { ProgressWidget } from "@/components/activity/ProgressWidget";
import { CategoryShareWidget } from "@/components/activity/CategoryShareWidget";
import { HabitsWidget } from "@/components/activity/HabitsWidget";
import { CategoryHealthWidget } from "@/components/activity/CategoryHealthWidget";
import { WorkspaceHealthWidget } from "@/components/activity/WorkspaceHealthWidget";
import { AttentionWidget } from "@/components/activity/AttentionWidget";
import { BestTimeWidget } from "@/components/activity/BestTimeWidget";
import type { AnalyticsRange } from "@/components/activity/types";

// Each view answers one question instead of showing every chart at once.
const VIEWS = ["Overview", "Patterns"] as const;
type View = (typeof VIEWS)[number];

const RANGE_OPTIONS: { label: string; value: AnalyticsRange }[] = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "6 Months", value: "sixmonth" },
];

export default function ActivityScreen() {
  const [params, setParams] = useSearchParams();
  const view: View = VIEWS.find((v) => v.toLowerCase() === params.get("view")) ?? "Overview";
  const setView = (v: string) => setParams({ view: v.toLowerCase() }, { replace: true });
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-4">
          <ThemedText type="titleFraunces" as="h1">
            Activity
          </ThemedText>
          <SegmentedControl options={[...VIEWS]} value={view} onChange={setView} className="w-56" />
        </div>

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

      <WeekRecapEntry />

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
        <div key={view} className="flex flex-col gap-12 animate-in fade-in duration-200">
          {view === "Overview" && (
            <>
              <SignalStrip signals={analytics.data.signals} />
              <AttentionWidget attention={analytics.data.attention} />
              <ProgressWidget progress={analytics.data.progress} range={range} />
            </>
          )}

          {view === "Patterns" && (
            <>
              <BestTimeWidget bestTime={analytics.data.bestTime} />
              <section className="flex flex-col gap-4">
                <ThemedText type="larger_default" as="h2">
                  Activity graph
                </ThemedText>
                <ActivityHeatmap heatmap={analytics.data.heatmap} />
              </section>
              <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                <CategoryShareWidget
                  share={analytics.data.categoryShare}
                  range={range}
                  activeCategory={category}
                  onSelectCategory={setCategory}
                />
                <HabitsWidget habits={analytics.data.habits} />
              </div>
              <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                <WorkspaceHealthWidget workspaceHealth={analytics.data.workspaceHealth} />
                <CategoryHealthWidget categoryHealth={analytics.data.categoryHealth} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
