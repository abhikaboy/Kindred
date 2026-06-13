import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsProgress } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";
import { LineChart } from "./charts/LineChart";

/** Completion trend over the period — a line built from progress buckets. */
export function CompletionTrendWidget({ progress }: { progress: AnalyticsProgress }) {
    const buckets = progress.buckets ?? [];
    if (buckets.length === 0) {
        return (
            <WidgetCard title="Completion trend">
                <ThemedText type="caption">No completed tasks in this period yet.</ThemedText>
            </WidgetCard>
        );
    }
    return (
        <WidgetCard title="Completion trend" takeaway={progress.takeaway}>
            <LineChart data={buckets.map((b) => b.total ?? 0)} labels={buckets.map((b) => b.label)} />
        </WidgetCard>
    );
}
