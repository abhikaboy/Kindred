import React, { useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { PencilSimple } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/contexts/tasksContext";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { AnalyticsRange, AnalyticsResponse } from "@/api/analytics";
import { WorkspaceSelector } from "./WorkspaceSelector";
import { RangeSwitcher } from "./RangeSwitcher";
import { FilterChips } from "./FilterChips";
import { useAnalyticsLayout, WidgetId } from "./analyticsLayout";
import { SignalStrip } from "./SignalStrip";
import { WeeklyProgressWidget } from "./WeeklyProgressWidget";
import { CategoryShareWidget } from "./CategoryShareWidget";
import { ActivityHeatmapWidget } from "./ActivityHeatmapWidget";
import { HabitsWidget } from "./HabitsWidget";
import { CategoryHealthWidget } from "./CategoryHealthWidget";
import { WorkspaceHealthWidget } from "./WorkspaceHealthWidget";

const EDIT_HREF = "/(activity)/edit" as Href;

export function AnalyticsHome() {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const insets = useSafeAreaInsets();

    const { user } = useAuth();
    const { workspaces } = useTasks();

    const [range, setRange] = useState<AnalyticsRange>("week");
    const [workspace, setWorkspace] = useState<string | undefined>(undefined);
    const [category, setCategory] = useState<string | undefined>(undefined);

    const { data, isLoading, isError, refetch } = useAnalyticsData({ range, workspace, category });
    const layout = useAnalyticsLayout(user?._id);

    const workspaceNames = useMemo(() => workspaces.map((w: any) => w.name), [workspaces]);
    const filterCategories = useMemo(() => {
        const source = workspace
            ? workspaces.find((w: any) => w.name === workspace)?.categories ?? []
            : workspaces.flatMap((w: any) => w.categories ?? []);
        return source.map((c: any) => ({ id: c.id, name: c.name }));
    }, [workspaces, workspace]);

    const onSelectWorkspace = (ws?: string) => {
        setWorkspace(ws);
        setCategory(undefined);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <ThemedText type="fancyFrauncesHeading">Analytics</ThemedText>
                <TouchableOpacity
                    style={styles.editButton}
                    activeOpacity={0.7}
                    onPress={() => router.push(EDIT_HREF)}>
                    <PencilSimple size={18} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                        Edit
                    </ThemedText>
                </TouchableOpacity>
            </View>

            <View style={styles.controls}>
                <WorkspaceSelector workspaces={workspaceNames} selected={workspace} onSelect={onSelectWorkspace} />
                <RangeSwitcher range={range} onChange={setRange} />
            </View>

            <View style={styles.chips}>
                <FilterChips categories={filterCategories} selected={category} onSelect={setCategory} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.feed, { paddingBottom: insets.bottom + 110 }]}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={ThemedColor.primary} style={styles.center} />
                ) : isError || !data ? (
                    <View style={styles.center}>
                        <ThemedText type="caption">Couldn't load analytics.</ThemedText>
                        <TouchableOpacity onPress={() => refetch()} activeOpacity={0.7} style={styles.retry}>
                            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                                Try again
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    layout.visible.map((id) => (
                        <WidgetRenderer
                            key={id}
                            id={id}
                            data={data}
                            range={range}
                            onSelectCategory={setCategory}
                        />
                    ))
                )}
            </ScrollView>
        </View>
    );
}

interface WidgetRendererProps {
    id: WidgetId;
    data: AnalyticsResponse;
    range: AnalyticsRange;
    onSelectCategory: (categoryId: string) => void;
}

/** Maps a widget id to its component — a proper component, not an inline helper. */
function WidgetRenderer({ id, data, range, onSelectCategory }: WidgetRendererProps) {
    switch (id) {
        case "signals":
            return <SignalStrip signals={data.signals} />;
        case "progress":
            return <WeeklyProgressWidget progress={data.progress} range={range} />;
        case "categoryShare":
            return <CategoryShareWidget share={data.categoryShare} range={range} onSelectCategory={onSelectCategory} />;
        case "habits":
            return <HabitsWidget habits={data.habits} />;
        case "heatmap":
            return <ActivityHeatmapWidget heatmap={data.heatmap} />;
        case "categoryHealth":
            return <CategoryHealthWidget categoryHealth={data.categoryHealth} onSelectCategory={onSelectCategory} />;
        case "workspaceHealth":
            return <WorkspaceHealthWidget workspaceHealth={data.workspaceHealth} />;
        default:
            return null;
    }
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
        },
        editButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        controls: {
            paddingHorizontal: 20,
            marginTop: 8,
        },
        chips: {
            paddingLeft: 20,
            marginTop: 4,
        },
        feed: {
            paddingHorizontal: 20,
            paddingTop: 12,
        },
        center: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 60,
            gap: 12,
        },
        retry: {
            paddingVertical: 8,
            paddingHorizontal: 16,
        },
    });
