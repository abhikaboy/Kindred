import React from "react";
import { View } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";

interface DonutSlice {
    color: string;
    count: number;
}

interface DonutChartProps {
    slices: DonutSlice[];
    total: number;
    size?: number;
}

/** Category-share donut with the period total in the center. */
export function DonutChart({ slices, total, size = 140 }: DonutChartProps) {
    const ThemedColor = useThemeColor() as any;

    const data = slices.filter((s) => s.count > 0).map((s) => ({ value: s.count, color: s.color }));
    const safeData = data.length > 0 ? data : [{ value: 1, color: ThemedColor.lightened }];

    return (
        <PieChart
            data={safeData as any}
            donut
            radius={size / 2}
            innerRadius={size / 2 - 22}
            // lightenedCard carries alpha; the donut hole must stay opaque
            innerCircleColor={ThemedColor.lightenedCard.slice(0, 7)}
            centerLabelComponent={() => (
                <View style={{ alignItems: "center" }}>
                    <ThemedText type="fancyFrauncesSubheading">{String(total)}</ThemedText>
                    <ThemedText type="caption">tasks</ThemedText>
                </View>
            )}
        />
    );
}
