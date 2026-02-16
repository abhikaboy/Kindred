import React from "react";
import { View, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ThemedText } from "@/components/ThemedText";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import SchedulableTaskCard from "@/components/cards/SchedulableTaskCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Task } from "@/api/types";

interface UnscheduledTasksSectionProps {
    tasks: Task[];
    title?: string;
    description?: string;
    emptyMessage?: string;
    // SwipableTaskCard props
    useSwipable?: boolean;
    onCompleteTask?: (task: Task) => void;
    // SchedulableTaskCard props
    useSchedulable?: boolean;
    onScheduleTask?: (task: Task, type: 'deadline' | 'startDate') => void;
    schedulingType?: 'deadline' | 'startDate';
}

const UnscheduledTasksSection = ({
    tasks,
    title = "Tasks",
    description,
    emptyMessage = "No tasks",
    useSwipable = false,
    onCompleteTask,
    useSchedulable = false,
    onScheduleTask,
    schedulingType = 'deadline'
}: UnscheduledTasksSectionProps) => {
    const ThemedColor = useThemeColor();

    const renderTaskItem = React.useCallback(({ item }: { item: Task }) => (
        <View style={styles.taskItem}>
            {useSwipable && onCompleteTask ? (
                <SchedulableTaskCard
                    redirect={true}
                    categoryId={item.categoryID || ""}
                    task={item}
                    onRightSwipe={() => onCompleteTask(item)}
                />
            ) : useSchedulable && onScheduleTask ? (
                <SchedulableTaskCard
                    redirect={true}
                    categoryId={item.categoryID || ""}
                    task={item}
                    onRightSwipe={() => onScheduleTask(item, schedulingType)}
                />
            ) : (
                <SwipableTaskCard
                    redirect={true}
                    categoryId={item.categoryID}
                    task={item}
                />
            )}
        </View>
    ), [useSwipable, onCompleteTask, useSchedulable, onScheduleTask, schedulingType]);

    const keyExtractor = React.useCallback((item: Task) => `${item.id}-${item.content}`, []);
    const getItemType = React.useCallback(() => 'task', []);

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
            <View style={{ minHeight: 2 }}>
                <FlashList
                    data={tasks}
                    renderItem={renderTaskItem}
                    keyExtractor={keyExtractor}
                    getItemType={getItemType}
                    estimatedItemSize={80}
                    removeClippedSubviews={true}
                />
            </View>
        </View>
    );
};

export default React.memo(UnscheduledTasksSection);

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
    taskItem: {
        marginBottom: 8,
    },
    emptyText: {
        textAlign: "center",
        marginTop: 20,
    },
});
