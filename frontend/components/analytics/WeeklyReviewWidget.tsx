import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { WidgetCard } from "./WidgetCard";

/** Dashboard CTA card that opens the guided Weekly Review. */
export function WeeklyReviewWidget({ onOpen }: { onOpen: () => void }) {
    return (
        <WidgetCard title="Weekly review" onPress={onOpen} cta={{ label: "Open weekly review", onPress: onOpen }}>
            <ThemedText type="caption">See how your week came together — momentum, support, and what to focus on next.</ThemedText>
        </WidgetCard>
    );
}
