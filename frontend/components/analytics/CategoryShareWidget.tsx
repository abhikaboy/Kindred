import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsCategoryShare, AnalyticsRange, AnalyticsShareSlice } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";
import { DonutChart } from "./charts/DonutChart";
import { StackedBandChart } from "./charts/StackedBandChart";

interface Props {
    share: AnalyticsCategoryShare;
    range: AnalyticsRange;
    onSelectCategory?: (categoryId: string) => void;
}

export function CategoryShareWidget({ share, range, onSelectCategory }: Props) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    const title = range === "week" ? "Where your time went" : "Category share";
    const total = share.slices.reduce((sum, s) => sum + s.count, 0);
    const useBands = range !== "week" && share.overTime.length > 0;

    return (
        <WidgetCard title={title} takeaway={share.takeaway}>
            {useBands ? (
                <StackedBandChart bands={share.overTime} />
            ) : (
                <View style={styles.donutRow}>
                    <DonutChart slices={share.slices} total={total} />
                    <View style={styles.legend}>
                        {share.slices.map((slice) => (
                            <ShareLegendRow key={slice.categoryId} slice={slice} onSelectCategory={onSelectCategory} />
                        ))}
                    </View>
                </View>
            )}
        </WidgetCard>
    );
}

function ShareLegendRow({
    slice,
    onSelectCategory,
}: {
    slice: AnalyticsShareSlice;
    onSelectCategory?: (categoryId: string) => void;
}) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const tappable = !!onSelectCategory && slice.categoryId !== "other";

    return (
        <TouchableOpacity
            style={styles.legendRow}
            disabled={!tappable}
            activeOpacity={0.6}
            onPress={() => tappable && onSelectCategory?.(slice.categoryId)}>
            <View style={styles.legendLeft}>
                <View style={[styles.dot, { backgroundColor: slice.color }]} />
                <ThemedText type="default" style={styles.legendName}>
                    {slice.name}
                </ThemedText>
            </View>
            <ThemedText type="defaultSemiBold">{Math.round(slice.pct)}%</ThemedText>
        </TouchableOpacity>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        donutRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
        },
        legend: {
            flex: 1,
            gap: 10,
        },
        legendRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        legendLeft: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flexShrink: 1,
        },
        legendName: {
            fontSize: 14,
            flexShrink: 1,
        },
        dot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
    });
