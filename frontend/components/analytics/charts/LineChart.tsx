import React from "react";
import { LineChart as GiftedLineChart } from "react-native-gifted-charts";
import { useThemeColor } from "@/hooks/useThemeColor";

interface LineChartProps {
    data: number[];
    labels?: string[];
    color?: string;
    height?: number;
}

/** Completion-trend line (area-filled) for detail screens. */
export function LineChart({ data, labels, color, height = 140 }: LineChartProps) {
    const ThemedColor = useThemeColor() as any;
    const stroke = color ?? ThemedColor.primary;
    const safe = data ?? [];
    const points = safe.map((v, i) => ({ value: v, label: labels?.[i] }));
    const peak = Math.max(1, ...safe);
    const maxValue = peak <= 3 ? 3 : Math.ceil(peak / 3) * 3;

    return (
        <GiftedLineChart
            data={points as any}
            height={height}
            color={stroke}
            thickness={3}
            curved
            hideRules
            hideYAxisText
            yAxisThickness={0}
            xAxisThickness={0}
            noOfSections={3}
            maxValue={maxValue}
            initialSpacing={8}
            endSpacing={8}
            disableScroll
            dataPointsColor={stroke}
            areaChart
            startFillColor={stroke}
            startOpacity={0.18}
            endFillColor={stroke}
            endOpacity={0.02}
            xAxisLabelTextStyle={{ color: ThemedColor.caption, fontSize: 11 }}
        />
    );
}
