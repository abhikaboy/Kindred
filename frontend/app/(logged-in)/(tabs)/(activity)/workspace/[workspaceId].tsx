import React, { useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router, type Href } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { AnalyticsRange } from "@/api/analytics";
import { DetailHeader } from "@/components/analytics/DetailHeader";
import { RangeSwitcher } from "@/components/analytics/RangeSwitcher";
import { StatCards } from "@/components/analytics/StatCards";
import { CategoryHealthWidget } from "@/components/analytics/CategoryHealthWidget";
import { CategoryShareWidget } from "@/components/analytics/CategoryShareWidget";
import { TasksNeedingAttentionWidget } from "@/components/analytics/TasksNeedingAttentionWidget";

export default function WorkspaceDetail() {
    const ThemedColor = useThemeColor() as any;
    const insets = useSafeAreaInsets();
    const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
    const workspaceName = decodeURIComponent(String(workspaceId ?? ""));
    const [range, setRange] = useState<AnalyticsRange>("week");
    const { data, isLoading, isError } = useAnalyticsData({ range, workspace: workspaceName });

    const goToCategory = (id: string) => router.push(`/(activity)/category/${id}` as Href);

    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }}>
            <DetailHeader title={workspaceName} />
            <View style={{ paddingHorizontal: 20 }}>
                <RangeSwitcher range={range} onChange={setRange} />
            </View>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 110 }}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={ThemedColor.primary} style={{ marginTop: 60 }} />
                ) : isError || !data ? (
                    <ThemedText type="caption">Couldn't load this workspace.</ThemedText>
                ) : (
                    <>
                        <StatCards
                            items={[
                                { label: "Done", value: String(data.progress.total) },
                                { label: "On time", value: data.signals.timing.value },
                                { label: "Kudos", value: String(Math.round(data.signals.support.rawValue)) },
                            ]}
                        />
                        <CategoryShareWidget share={data.categoryShare} range={range} onSelectCategory={goToCategory} />
                        <CategoryHealthWidget categoryHealth={data.categoryHealth} onSelectCategory={goToCategory} />
                        <TasksNeedingAttentionWidget attention={data.attention} />
                    </>
                )}
            </ScrollView>
        </View>
    );
}
