import React, { useState, useCallback } from "react";
import { View, StyleSheet, LayoutAnimation, UIManager, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useCompletedThisWeek } from "@/hooks/useCompletedThisWeek";
import StatItem from "./StatItem";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import CompletedTaskRow from "./CompletedTaskRow";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_VISIBLE = 5;

type ExpandedStat = "open" | "doneThisWeek" | null;

const DashboardStats: React.FC = () => {
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const { unnestedTasks, dueTodayTasks } = useTasks();
    const { completedThisWeek, isLoading: completedLoading } = useCompletedThisWeek();
    const [expanded, setExpanded] = useState<ExpandedStat>(null);

    const openTasks = unnestedTasks;

    const handlePress = useCallback((stat: "open" | "dueToday" | "doneThisWeek") => {
        if (stat === "dueToday") {
            if (dueTodayTasks.length === 0) return;
            router.push("/(logged-in)/(tabs)/(task)/daily");
            return;
        }
        if (stat === "open" && openTasks.length === 0) return;
        if (stat === "doneThisWeek" && completedThisWeek.length === 0) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((prev) => (prev === stat ? null : stat));
    }, [router, dueTodayTasks.length, openTasks.length, completedThisWeek.length]);

    const visibleOpen = openTasks.slice(0, MAX_VISIBLE);
    const visibleCompleted = completedThisWeek.slice(0, MAX_VISIBLE);

    return (
        <View style={styles.wrapper}>
            {/* Stats row */}
            <View style={styles.row}>
                <StatItem
                    value={openTasks.length}
                    label="Open"
                    isSelected={expanded === "open"}
                    isDimmed={expanded !== null && expanded !== "open"}
                    onPress={() => handlePress("open")}
                />
                <StatItem
                    value={dueTodayTasks.length}
                    label="Due Today"
                    isSelected={false}
                    isDimmed={expanded !== null}
                    onPress={() => handlePress("dueToday")}
                />
                <StatItem
                    value={completedThisWeek.length}
                    label="Done This Week"
                    isSelected={expanded === "doneThisWeek"}
                    isDimmed={expanded !== null && expanded !== "doneThisWeek"}
                    onPress={() => handlePress("doneThisWeek")}
                    isLoading={completedLoading}
                />
            </View>

            {/* Expanded: Open tasks */}
            {expanded === "open" && openTasks.length > 0 && (
                <View style={styles.expandedList}>
                    {visibleOpen.map((task, index) => (
                        <SwipableTaskCard
                            key={task.id || index}
                            redirect={true}
                            categoryId={task.categoryID!}
                            task={task}
                        />
                    ))}
                    {openTasks.length > MAX_VISIBLE && (
                        <TouchableOpacity style={styles.showAll} activeOpacity={0.7}>
                            <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                Show all {openTasks.length} open →
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Expanded: Done This Week */}
            {expanded === "doneThisWeek" && completedThisWeek.length > 0 && (
                <View style={styles.expandedList}>
                    {visibleCompleted.map((task, index) => (
                        <CompletedTaskRow key={task.id || index} task={task} />
                    ))}
                    {completedThisWeek.length > MAX_VISIBLE && (
                        <TouchableOpacity style={styles.showAll} activeOpacity={0.7}>
                            <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                Show all {completedThisWeek.length} completed →
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        gap: 16,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-around",
    },
    expandedList: {
        gap: 8,
    },
    showAll: {
        alignItems: "center",
        paddingVertical: 8,
    },
});

export default DashboardStats;
