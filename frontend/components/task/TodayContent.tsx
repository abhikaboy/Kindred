import React from "react";
import { Dimensions, StyleSheet, ScrollView, View } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTasks } from "@/contexts/tasksContext";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

/**
 * TodayContent - Displays tasks due today, scheduled for today, and window tasks
 * Extracted content component without drawer wrapper
 */
export const TodayContent: React.FC = () => {
    const { startTodayTasks, dueTodayTasks, windowTasks } = useTasks();

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                <ThemedText type="title" style={styles.title}>
                    {new Date().toLocaleDateString("en-US", { weekday: "long" })},{" "}
                    {new Date().toLocaleDateString("en-US", { month: "long" })}{" "}
                    {new Date().toLocaleDateString("en-US", { day: "numeric" })}
                </ThemedText>
                <ThemedText type="lightBody" style={{ lineHeight: 24, marginTop: 4 }}>
                    This is a glance of your tasks today, feel free to navigate to your workspaces to add new tasks!
                </ThemedText>
            </View>
            <ScrollView style={{ gap: 16 }} contentContainerStyle={{ gap: 24 }}>
                <View style={{ gap: 8 }}>
                    <ThemedText type="subtitle">Due Today</ThemedText>
                    <ScrollView contentContainerStyle={{ gap: 16 }}>
                        {dueTodayTasks.length === 0 ? (
                            <ThemedText type="lightBody">No tasks due today.</ThemedText>
                        ) : (
                            dueTodayTasks.map((task) => (
                                <SwipableTaskCard
                                    key={task.id}
                                    redirect={true}
                                    categoryId={task.categoryID}
                                    task={task}
                                />
                            ))
                        )}
                    </ScrollView>
                </View>
                <View style={{ gap: 8 }}>
                    <ThemedText type="subtitle">Scheduled for Today</ThemedText>
                    <ScrollView contentContainerStyle={{ gap: 16 }}>
                        {startTodayTasks.length === 0 ? (
                            <ThemedText type="lightBody">No tasks scheduled for today.</ThemedText>
                        ) : (
                            startTodayTasks.map((task) => (
                                <SwipableTaskCard
                                    key={task.id}
                                    redirect={true}
                                    categoryId={task.categoryID}
                                    task={task}
                                />
                            ))
                        )}
                    </ScrollView>
                </View>
                <View style={{ gap: 8 }}>
                    <ThemedText type="subtitle">Window Tasks</ThemedText>
                    <ScrollView contentContainerStyle={{ gap: 16 }}>
                        {windowTasks.length === 0 ? (
                            <ThemedText type="lightBody">No tasks in the window.</ThemedText>
                        ) : (
                            windowTasks.map((task) => (
                                <SwipableTaskCard
                                    key={task.id}
                                    redirect={true}
                                    categoryId={task.categoryID}
                                    task={task}
                                />
                            ))
                        )}
                    </ScrollView>
                </View>
            </ScrollView>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Dimensions.get("screen").height * 0.09,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: Dimensions.get("screen").height * 0.12,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
    },
    title: {
        fontWeight: "600",
    },
});

