import React from "react";
import { View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useThemeColor } from "@/hooks/useThemeColor";
import { AnalyticsProgressBucket } from "@/api/analytics";

interface StackedBarChartProps {
    buckets: AnalyticsProgressBucket[];
    height?: number;
}

/** Stacked bars by day/week/month, segmented by category color. */
export function StackedBarChart({ buckets, height = 160 }: StackedBarChartProps) {
    const ThemedColor = useThemeColor() as any;

    const safeBuckets = buckets ?? [];
    const stackData = safeBuckets.map((b) => {
        const segments = b.segments ?? [];
        return {
            label: b.label,
            stacks:
                segments.length > 0
                    ? segments.map((s) => ({ value: s.count, color: s.color }))
                    : [{ value: 0, color: "transparent" }],
        };
    });

    const peak = Math.max(1, ...safeBuckets.map((b) => b.total ?? 0));
    const maxValue = peak <= 3 ? 3 : Math.ceil(peak / 3) * 3;

    return (
        <View>
            <BarChart
                stackData={stackData as any}
                height={height}
                barWidth={18}
                spacing={buckets.length > 7 ? 10 : 16}
                initialSpacing={8}
                endSpacing={4}
                barBorderRadius={4}
                hideRules
                hideYAxisText
                yAxisThickness={0}
                xAxisThickness={0}
                noOfSections={3}
                maxValue={maxValue}
                disableScroll
                xAxisLabelTextStyle={{ color: ThemedColor.caption, fontSize: 11 }}
            />
        </View>
    );
}
