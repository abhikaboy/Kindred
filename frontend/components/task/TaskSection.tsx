import React from "react";
import { View, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ThemedText } from "@/components/ThemedText";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import SchedulableTaskCard from "@/components/cards/SchedulableTaskCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Task } from "@/api/types";

interface TaskSectionProps {
    tasks: Task[];
    title?: string;
    description?: string;
    emptyMessage?: string;
    // SchedulableTaskCard props
    useSchedulable?: boolean;
    onScheduleTask?: (task: Task, type: 'deadline' | 'startDate') => void;
    schedulingType?: 'deadline' | 'startDate';
}

const TaskSection = ({
    tasks,
    title = "Tasks",
    description,
    emptyMessage = "No tasks",
    useSchedulable = false,
    onScheduleTask,
    schedulingType = 'deadline'
}: TaskSectionProps) => {
    const ThemedColor = useThemeColor();

    const renderTaskItem = React.useCallback(({ item }: { item: Task }) => (
        <View style={styles.taskContainer}>
            {useSchedulable ? (
                <SchedulableTaskCard
                    redirect={true}
                    categoryId={item.categoryID || ""}
                    task={item}
                    onRightSwipe={() => onScheduleTask!(item, schedulingType)}
                />
            ) : (
                <SwipableTaskCard
                    redirect={true}
                    categoryId={item.categoryID}
                    task={item}
                />
            )}
        </View>
    ), [useSchedulable, onScheduleTask, schedulingType]);

    const getItemType = React.useCallback(() => 'task', []);

    if (tasks.length === 0) {
        return (
            <View style={{...styles.section, opacity: 0.3}}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                    {title}
                </ThemedText>
                {description && (
                    <ThemedText type="lightBody" style={[styles.description, { color: ThemedColor.caption }]}>
                        {description}
                    </ThemedText>
                )}
                <ThemedText type="lightBody">
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
                <ThemedText type="lightBody" style={[styles.description, { color: ThemedColor.caption }]}>
                    {description}
                </ThemedText>
            )}
            <View style={{ minHeight: 2 }}>
                <FlashList
                    data={tasks}
                    renderItem={renderTaskItem}
                    keyExtractor={(item) => item.id + item.content}
                    getItemType={getItemType}
                    removeClippedSubviews={true}
                />
            </View>
        </View>
    );
};

export default React.memo(TaskSection);

const styles = StyleSheet.create({
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "500",
    },
    description: {
        marginBottom: 8,
    },
    taskContainer: {
        gap: 8,
    },
});
