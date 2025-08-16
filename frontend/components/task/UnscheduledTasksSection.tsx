import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import SchedulableTaskCard from "@/components/cards/SchedulableTaskCard";
import { useThemeColor } from "@/hooks/useThemeColor";

interface Task {
    id: string;
    content: string;
    categoryID?: string;
    startDate?: string;
    deadline?: string;
    [key: string]: any;
}

interface UnscheduledTasksSectionProps {
    tasks: Task[];
    title?: string;
    description?: string;
    showScheduling?: boolean;
    onScheduleTask?: (task: Task, type: 'deadline' | 'startDate') => void;
    emptyMessage?: string;
}

export default function UnscheduledTasksSection({
    tasks,
    title = "Unscheduled Tasks",
    description,
    showScheduling = false,
    onScheduleTask,
    emptyMessage = "No unscheduled tasks"
}: UnscheduledTasksSectionProps) {
    const ThemedColor = useThemeColor();

    if (tasks.length === 0) {
        return (
            <View style={styles.section}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                    {title}
                </ThemedText>
                {description && (
                    <ThemedText type="lightBody" style={styles.description}>
                        {description}
                    </ThemedText>
                )}
                <ThemedText type="lightBody" style={styles.emptyText}>
                    {emptyMessage}
                </ThemedText>
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
                {title}
            </ThemedText>
            {description && (
                <ThemedText type="lightBody" style={styles.description}>
                    {description}
                </ThemedText>
            )}
            {tasks.map((task) => (
                <View key={task.id + task.content} style={styles.taskContainer}>
                    {showScheduling && onScheduleTask ? (
                        <SchedulableTaskCard
                            redirect={true}
                            categoryId={task.categoryID || ""}
                            task={task}
                            onRightSwipe={() => onScheduleTask(task, 'deadline')}
                        />
                    ) : (
                        <SwipableTaskCard
                            redirect={true}
                            categoryId={task.categoryID}
                            task={task}
                        />
                    )}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "600",
        letterSpacing: -1,
    },
    description: {
        marginBottom: 8,
    },
    taskContainer: {
        gap: 8,
    },
    emptyText: {
        textAlign: "center",
        marginTop: 20,
    },
});
