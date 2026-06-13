import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsHeatmap } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";
import { MonthHeatmap } from "./charts/MonthHeatmap";
import { heatmapLevelColor } from "./analyticsColors";

export function ActivityHeatmapWidget({ heatmap }: { heatmap: AnalyticsHeatmap }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    return (
        <WidgetCard title="Activity heatmap" takeaway={heatmap.takeaway}>
            <MonthHeatmap days={heatmap.days} />
            <View style={styles.legend}>
                <ThemedText type="caption">Less</ThemedText>
                {[0, 1, 2, 3, 4].map((level) => (
                    <View key={level} style={[styles.cell, { backgroundColor: heatmapLevelColor(level, ThemedColor) }]} />
                ))}
                <ThemedText type="caption">More</ThemedText>
            </View>
        </WidgetCard>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        legend: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 12,
        },
        cell: {
            width: 12,
            height: 12,
            borderRadius: 3,
        },
    });
