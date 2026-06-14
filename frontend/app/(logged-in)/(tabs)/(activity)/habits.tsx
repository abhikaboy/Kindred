import React, { useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { AnalyticsRange } from "@/api/analytics";
import { DetailHeader } from "@/components/analytics/DetailHeader";
import { RangeSwitcher } from "@/components/analytics/RangeSwitcher";
import { HabitsWidget } from "@/components/analytics/HabitsWidget";

export default function HabitsScreen() {
    const ThemedColor = useThemeColor() as any;
    const insets = useSafeAreaInsets();
    const [range, setRange] = useState<AnalyticsRange>("week");
    const { data, isLoading, isError } = useAnalyticsData({ range });

    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }}>
            <DetailHeader title="Habits & Recurring" />
            <View style={{ paddingHorizontal: 20 }}>
                <RangeSwitcher range={range} onChange={setRange} />
            </View>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 110 }}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={ThemedColor.primary} style={{ marginTop: 60 }} />
                ) : isError || !data ? (
                    <ThemedText type="caption">Couldn't load habits.</ThemedText>
                ) : (
                    <HabitsWidget habits={data.habits} />
                )}
            </ScrollView>
        </View>
    );
}
