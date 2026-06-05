import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ThemedText } from "@/components/ThemedText";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import SchedulableTaskCard from "@/components/cards/SchedulableTaskCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Task } from "@/api/types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

interface UnscheduledTasksSectionProps {
    tasks: Task[];
    title?: string;
    description?: string;
    emptyMessage?: string;
    /** When set, the empty state shows a "tap to create a task" CTA and fires this on press. */
    onEmptyPress?: () => void;
    collapsible?: boolean;
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
    onEmptyPress,
    collapsible = false,
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

    const content = tasks.length === 0 ? (
        <>
            {description ? (
                <ThemedText type="lightBody" style={styles.description}>
                    {description}
                </ThemedText>
            ) : null}
            {onEmptyPress ? (
                <TouchableOpacity onPress={onEmptyPress} activeOpacity={0.7}>
                    <ThemedText type="caption" style={styles.emptyText}>
                        {emptyMessage}
                        <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                            {"  ·  tap to create a task"}
                        </ThemedText>
                    </ThemedText>
                </TouchableOpacity>
            ) : (
                <ThemedText type="caption" style={styles.emptyText}>
                    {emptyMessage}
                </ThemedText>
            )}
        </>
    ) : (
        <>
            {description ? (
                <ThemedText type="lightBody" style={styles.description}>
                    {description}
                </ThemedText>
            ) : null}
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
        </>
    );

    if (collapsible) {
        return (
            <View style={styles.section}>
                <CollapsibleSection title={title} titleStyle={styles.sectionTitle}>
                    <View style={styles.collapsibleContent}>
                        {content}
                    </View>
                </CollapsibleSection>
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
                {title}
            </ThemedText>
            {content}
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
        fontWeight: "500",
        letterSpacing: 0.2,
    },
    collapsibleContent: {
        gap: 12,
        paddingTop: 12,
    },
    description: {
        marginBottom: 8,
    },
    taskItem: {
        marginBottom: 8,
    },
    emptyText: {
        marginTop: 4,
    },
});
