import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsProgress, AnalyticsRange, AnalyticsLegendItem } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";
import { StackedBarChart } from "./charts/StackedBarChart";
import { directionColor } from "./analyticsColors";

const TITLES: Record<AnalyticsRange, string> = {
    week: "Weekly progress",
    month: "Monthly progress",
    sixmonth: "6-month progress",
};

const SUFFIX: Record<AnalyticsRange, string> = {
    week: "vs last week",
    month: "vs last month",
    sixmonth: "vs prior 6 months",
};

function deltaText(delta: number, range: AnalyticsRange): string {
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${Math.round(delta)}% ${SUFFIX[range]}`;
}

interface Props {
    progress: AnalyticsProgress;
    range: AnalyticsRange;
}

export function WeeklyProgressWidget({ progress, range }: Props) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const dir = progress.delta > 0 ? "up" : progress.delta < 0 ? "down" : "flat";

    return (
        <WidgetCard title={TITLES[range]} takeaway={progress.takeaway}>
            <View style={styles.statRow}>
                <ThemedText type="fancyFrauncesHeading" style={styles.stat}>
                    {progress.total}
                </ThemedText>
                <ThemedText type="caption" style={{ color: directionColor(dir, ThemedColor) }}>
                    {deltaText(progress.delta, range)}
                </ThemedText>
            </View>

            <StackedBarChart buckets={progress.buckets} />

            <View style={styles.legend}>
                {progress.legend.map((item) => (
                    <LegendChip key={item.categoryId} item={item} />
                ))}
            </View>
        </WidgetCard>
    );
}

function LegendChip({ item }: { item: AnalyticsLegendItem }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <ThemedText type="caption">{item.name}</ThemedText>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        statRow: {
            flexDirection: "row",
            alignItems: "baseline",
            gap: 10,
            marginBottom: 8,
        },
        stat: {
            fontSize: 30,
        },
        legend: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 12,
        },
        chip: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        dot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
    });
