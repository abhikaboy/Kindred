import React from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { AnalyticsSupporter } from "@/api/analytics";
import { DetailHeader } from "@/components/analytics/DetailHeader";
import { StatCards } from "@/components/analytics/StatCards";
import { WidgetCard } from "@/components/analytics/WidgetCard";
import { WorkspaceHealthWidget } from "@/components/analytics/WorkspaceHealthWidget";
import { CategoryHealthWidget } from "@/components/analytics/CategoryHealthWidget";
import { KudosEffectWidget } from "@/components/analytics/KudosEffectWidget";
import { SupportCoverageWidget } from "@/components/analytics/SupportCoverageWidget";

export default function WeeklyReview() {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const insets = useSafeAreaInsets();
    const { data, isLoading, isError } = useAnalyticsData({ range: "week" });

    const now = new Date();
    const rangeLabel = `${format(startOfWeek(now, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(now, { weekStartsOn: 1 }), "MMM d")}`;

    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }}>
            <DetailHeader title="Weekly Review" subtitle={rangeLabel} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 110 }}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={ThemedColor.primary} style={{ marginTop: 60 }} />
                ) : isError || !data ? (
                    <ThemedText type="caption">Couldn't load your weekly review.</ThemedText>
                ) : (
                    <>
                        <ThemedText type="fancyFrauncesHeading" style={styles.hero}>
                            {data.progress.total > 0 ? "Nice week 🎉" : "A fresh start"}
                        </ThemedText>
                        <ThemedText type="caption" style={styles.heroSub}>
                            {data.progress.total > 0
                                ? "Here's how it came together — what moved and who showed up."
                                : "Nothing logged yet this week. A small win is a great place to begin."}
                        </ThemedText>

                        <StatCards
                            items={[
                                { label: "Completed", value: String(data.progress.total) },
                                { label: "On time", value: data.signals.timing.value },
                                { label: "Workspaces", value: String((data.workspaceHealth.rows ?? []).length) },
                                { label: "Kudos", value: String(Math.round(data.signals.support.rawValue)) },
                            ]}
                        />

                        <WhoShowedUp supporters={data.topSupporters ?? []} />
                        <WorkspaceHealthWidget workspaceHealth={data.workspaceHealth} />
                        <CategoryHealthWidget categoryHealth={data.categoryHealth} />
                        <KudosEffectWidget kudosEffect={data.kudosEffect} />
                        <SupportCoverageWidget supportCoverage={data.supportCoverage} />

                        <TouchableOpacity
                            style={styles.planButton}
                            activeOpacity={0.85}
                            onPress={() => router.push("/(task)" as Href)}>
                            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.buttonText }}>
                                Plan next week
                            </ThemedText>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

function WhoShowedUp({ supporters }: { supporters: AnalyticsSupporter[] }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    if (supporters.length === 0) {
        return (
            <WidgetCard title="Who showed up">
                <ThemedText type="caption">No Kudos yet this week — that's okay.</ThemedText>
            </WidgetCard>
        );
    }
    return (
        <WidgetCard title="Who showed up">
            <View style={{ gap: 12 }}>
                {supporters.map((s) => (
                    <View key={s.id} style={styles.supporterRow}>
                        <ThemedText type="defaultSemiBold">{s.name || "A friend"}</ThemedText>
                        <ThemedText type="caption">
                            {s.count} {s.count === 1 ? "Kudos" : "Kudos"}
                        </ThemedText>
                    </View>
                ))}
            </View>
        </WidgetCard>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        hero: {
            fontSize: 28,
            marginTop: 4,
        },
        heroSub: {
            marginTop: 4,
            marginBottom: 16,
            lineHeight: 18,
        },
        supporterRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        planButton: {
            backgroundColor: ThemedColor.primary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 8,
        },
    });
