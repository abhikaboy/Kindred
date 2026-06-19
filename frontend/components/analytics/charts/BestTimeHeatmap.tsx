import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsBestTimeCell } from "@/api/analytics";
import { heatmapLevelColor } from "../analyticsColors";

interface BestTimeHeatmapProps {
    cells: AnalyticsBestTimeCell[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BLOCKS = 8; // 8 three-hour blocks
const BLOCK_LABELS: Record<number, string> = { 0: "12a", 2: "6a", 4: "12p", 6: "6p" };

/** Hour×weekday grid bucketed into eight 3-hour blocks. */
export function BestTimeHeatmap({ cells }: BestTimeHeatmapProps) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    // weekday(Mon=0) × block -> count
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(BLOCKS).fill(0));
    let max = 0;
    for (const c of cells ?? []) {
        const block = Math.min(BLOCKS - 1, Math.floor(c.hour / 3));
        if (c.weekday >= 0 && c.weekday < 7) {
            matrix[c.weekday][block] += c.count;
            if (matrix[c.weekday][block] > max) max = matrix[c.weekday][block];
        }
    }

    const levelFor = (count: number) => {
        if (count <= 0 || max <= 0) return 0;
        return Math.max(1, Math.ceil((count / max) * 4));
    };

    return (
        <View>
            {WEEKDAYS.map((label, wd) => (
                <View key={wd} style={styles.row}>
                    <ThemedText type="caption" style={styles.rowLabel}>
                        {label}
                    </ThemedText>
                    {matrix[wd].map((count, block) => (
                        <View
                            key={block}
                            style={[styles.cell, { backgroundColor: heatmapLevelColor(levelFor(count), ThemedColor) }]}
                        />
                    ))}
                </View>
            ))}
            <View style={styles.axis}>
                <View style={styles.rowLabel} />
                {Array.from({ length: BLOCKS }).map((_, block) => (
                    <ThemedText key={block} type="caption" style={styles.axisLabel}>
                        {BLOCK_LABELS[block] ?? ""}
                    </ThemedText>
                ))}
            </View>
        </View>
    );
}

const CELL = 18;
const GAP = 4;

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: GAP,
            marginBottom: GAP,
        },
        rowLabel: {
            width: 32,
            fontSize: 11,
        },
        cell: {
            width: CELL,
            height: CELL,
            borderRadius: 4,
        },
        axis: {
            flexDirection: "row",
            gap: GAP,
            marginTop: 2,
        },
        axisLabel: {
            width: CELL,
            fontSize: 9,
            textAlign: "left",
        },
    });
