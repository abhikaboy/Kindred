import React, { useState } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { format } from "date-fns";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { AnalyticsRange, AnalyticsHeatmap } from "@/api/analytics";
import { DetailHeader } from "@/components/analytics/DetailHeader";
import { RangeSwitcher } from "@/components/analytics/RangeSwitcher";
import { ActivityHeatmapWidget } from "@/components/analytics/ActivityHeatmapWidget";
import { BestTimeWidget } from "@/components/analytics/BestTimeWidget";
import { WidgetCard } from "@/components/analytics/WidgetCard";

function parseLocalDate(iso: string): Date {
    const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
    return new Date(y, (m || 1) - 1, d || 1);
}

export default function InsightDetail() {
    const ThemedColor = useThemeColor() as any;
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ insightId: string; category?: string; workspace?: string }>();
    const [range, setRange] = useState<AnalyticsRange>("month");
    const { data, isLoading, isError } = useAnalyticsData({
        range,
        category: params.category,
        workspace: params.workspace,
    });

    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }}>
            <DetailHeader title="Insights" />
            <View style={{ paddingHorizontal: 20 }}>
                <RangeSwitcher range={range} onChange={setRange} />
            </View>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 110 }}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={ThemedColor.primary} style={{ marginTop: 60 }} />
                ) : isError || !data ? (
                    <ThemedText type="caption">Couldn't load insights.</ThemedText>
                ) : (
                    <>
                        <ActivityHeatmapWidget heatmap={data.heatmap} />
                        <BestTimeWidget bestTime={data.bestTime} />
                        <TopActiveDays heatmap={data.heatmap} />
                    </>
                )}
            </ScrollView>
        </View>
    );
}

function TopActiveDays({ heatmap }: { heatmap: AnalyticsHeatmap }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const top = (heatmap.days ?? [])
        .filter((d) => d.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    if (top.length === 0) {
        return null;
    }

    return (
        <WidgetCard title="Top active days">
            <View style={{ gap: 12 }}>
                {top.map((d) => (
                    <View key={d.date} style={styles.row}>
                        <ThemedText type="default">{format(parseLocalDate(d.date), "EEE, MMM d")}</ThemedText>
                        <ThemedText type="defaultSemiBold">{d.count} tasks</ThemedText>
                    </View>
                ))}
            </View>
        </WidgetCard>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
    });
