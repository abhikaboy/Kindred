import React, { useMemo, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useTasks } from "@/contexts/tasksContext";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { AnalyticsRange } from "@/api/analytics";
import { DetailHeader } from "@/components/analytics/DetailHeader";
import { RangeSwitcher } from "@/components/analytics/RangeSwitcher";
import { StatCards } from "@/components/analytics/StatCards";
import { CompletionTrendWidget } from "@/components/analytics/CompletionTrendWidget";
import { ActivityHeatmapWidget } from "@/components/analytics/ActivityHeatmapWidget";
import { BestTimeWidget } from "@/components/analytics/BestTimeWidget";
import { TasksNeedingAttentionWidget } from "@/components/analytics/TasksNeedingAttentionWidget";

export default function CategoryDetail() {
    const ThemedColor = useThemeColor() as any;
    const insets = useSafeAreaInsets();
    const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
    const { workspaces } = useTasks();
    const [range, setRange] = useState<AnalyticsRange>("week");
    const { data, isLoading, isError } = useAnalyticsData({ range, category: categoryId });

    const categoryName = useMemo(() => {
        const all = workspaces.flatMap((w: any) => w.categories ?? []);
        return all.find((c: any) => c.id === categoryId)?.name ?? "Category";
    }, [workspaces, categoryId]);

    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }}>
            <DetailHeader title={categoryName} />
            <View style={{ paddingHorizontal: 20 }}>
                <RangeSwitcher range={range} onChange={setRange} />
            </View>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 110 }}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={ThemedColor.primary} style={{ marginTop: 60 }} />
                ) : isError || !data ? (
                    <ThemedText type="caption">Couldn't load this category.</ThemedText>
                ) : (
                    <>
                        <StatCards
                            items={[
                                { label: "Done", value: String(data.progress.total) },
                                { label: "On time", value: data.signals.timing.value },
                                { label: "Kudos", value: String(Math.round(data.signals.support.rawValue)) },
                                { label: "Needs attn", value: String((data.attention.tasks ?? []).length) },
                            ]}
                        />
                        <CompletionTrendWidget progress={data.progress} />
                        <ActivityHeatmapWidget heatmap={data.heatmap} />
                        <BestTimeWidget bestTime={data.bestTime} />
                        <TasksNeedingAttentionWidget attention={data.attention} />
                    </>
                )}
            </ScrollView>
        </View>
    );
}
