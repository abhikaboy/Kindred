import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { AnalyticsHeatmapDay } from "@/api/analytics";
import { heatmapLevelColor } from "../analyticsColors";

interface MonthHeatmapProps {
    days: AnalyticsHeatmapDay[];
}

/** Trailing-quarter activity grid: columns of 7 days, colored by intensity. */
export function MonthHeatmap({ days }: MonthHeatmapProps) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    const safeDays = days ?? [];
    const columns: AnalyticsHeatmapDay[][] = [];
    for (let i = 0; i < safeDays.length; i += 7) {
        columns.push(safeDays.slice(i, i + 7));
    }

    return (
        <View style={styles.grid}>
            {columns.map((col, ci) => (
                <View key={ci} style={styles.column}>
                    {col.map((d) => (
                        <View
                            key={d.date}
                            style={[styles.cell, { backgroundColor: heatmapLevelColor(d.level, ThemedColor) }]}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        grid: {
            flexDirection: "row",
            gap: 4,
        },
        column: {
            gap: 4,
        },
        cell: {
            width: 12,
            height: 12,
            borderRadius: 3,
        },
    });
