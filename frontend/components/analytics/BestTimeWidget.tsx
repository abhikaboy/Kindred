import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsBestTime } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";
import { BestTimeHeatmap } from "./charts/BestTimeHeatmap";

export function BestTimeWidget({ bestTime }: { bestTime: AnalyticsBestTime }) {
    if (!bestTime || (bestTime.cells ?? []).length === 0) {
        return (
            <WidgetCard title="Best time of day">
                <ThemedText type="caption">Not enough activity yet to find your peak time.</ThemedText>
            </WidgetCard>
        );
    }
    return (
        <WidgetCard title="Best time of day" takeaway={bestTime.takeaway}>
            <BestTimeHeatmap cells={bestTime.cells} />
        </WidgetCard>
    );
}
