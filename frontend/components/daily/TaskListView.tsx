import React from "react";
import { View, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ThemedText } from "@/components/ThemedText";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import TaskSection from "@/components/task/TaskSection";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

interface TaskListViewProps {
    selectedDate: Date;
    tasksForSelectedDate: any[];
    overdueTasks: any[];
    upcomingTasks: any[];
    pastTasks: any[];
    unscheduledTasks: any[];
    onQuickSchedule: (task: any, type: 'deadline' | 'startDate') => void;
}

const TaskListViewComponent: React.FC<TaskListViewProps> = ({
    selectedDate,
    tasksForSelectedDate,
    overdueTasks,
    upcomingTasks,
    pastTasks,
    unscheduledTasks,
    onQuickSchedule,
}) => {
    const renderTaskItem = React.useCallback(({ item }: { item: any }) => (
        <View style={styles.taskItem}>
            <SwipableTaskCard
                redirect={true}
                categoryId={item.categoryID}
                task={item}
            />
        </View>
    ), []);

    const keyExtractor = React.useCallback((item: any) => `${item.id}-${item.content}`, []);
    const getItemType = React.useCallback((item: any) => {
        return 'task';
    }, []);

    const sections = React.useMemo(() => {
        const all = [
            {
                key: "overdue",
                tasks: overdueTasks,
                title: "Overdue Tasks",
                description: "",
                emptyMessage: "No overdue tasks",
            },
            {
                key: "upcoming",
                tasks: upcomingTasks,
                title: "Upcoming Tasks",
                description: "These tasks have future start dates or deadlines.",
                emptyMessage: "No upcoming tasks",
            },
            {
                key: "past",
                tasks: pastTasks,
                title: "Past Tasks",
                description: "These tasks started in the past but have no deadline.",
                emptyMessage: "No past tasks",
            },
            {
                key: "unscheduled",
                tasks: unscheduledTasks,
                title: "Unscheduled Tasks",
                description: "These are tasks that don't have a start date or deadline. Swipe right to schedule for this day.",
                emptyMessage: "No unscheduled tasks",
                useSchedulable: true,
                onScheduleTask: onQuickSchedule,
                schedulingType: "deadline" as const,
            },
        ];

        const active = all.filter((s) => s.tasks.length > 0);
        const empty = all.filter((s) => s.tasks.length === 0);
        return [...active, ...empty];
    }, [overdueTasks, upcomingTasks, pastTasks, unscheduledTasks, onQuickSchedule]);

    return (
        <View style={styles.container}>
            {tasksForSelectedDate.length > 0 ? (
                <View style={{ minHeight: 2 }}>
                    <FlashList
                        data={tasksForSelectedDate}
                        renderItem={renderTaskItem}
                        keyExtractor={keyExtractor}
                        getItemType={getItemType}
                        estimatedItemSize={80}
                        removeClippedSubviews={true}
                    />
                </View>
            ) : (
                <ThemedText type="lightBody" style={styles.emptyText}>
                    No tasks for this date
                </ThemedText>
            )}

            {sections.map((section) => (
                <TaskSection
                    key={section.key}
                    tasks={section.tasks}
                    title={section.title}
                    description={section.description}
                    emptyMessage={section.emptyMessage}
                    useSchedulable={section.useSchedulable}
                    onScheduleTask={section.onScheduleTask}
                    schedulingType={section.schedulingType}
                />
            ))}
        </View>
    );
};

// Memoize TaskListView to prevent unnecessary re-renders when hidden
export const TaskListView = React.memo(TaskListViewComponent, (prevProps, nextProps) => {
    // Use length comparison for arrays since useMemo should keep reference stable
    const sameDate = prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime();
    const sameSelectedTasks = prevProps.tasksForSelectedDate.length === nextProps.tasksForSelectedDate.length;
    const sameOverdue = prevProps.overdueTasks.length === nextProps.overdueTasks.length;
    const sameUpcoming = prevProps.upcomingTasks.length === nextProps.upcomingTasks.length;
    const samePast = prevProps.pastTasks.length === nextProps.pastTasks.length;
    const sameUnscheduled = prevProps.unscheduledTasks.length === nextProps.unscheduledTasks.length;

    return sameDate && sameSelectedTasks && sameOverdue && sameUpcoming && samePast && sameUnscheduled;
});

const styles = StyleSheet.create({
    container: {
        gap: 24,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    taskItem: {
        marginBottom: 8,
    },
    emptyText: {
        textAlign: "center",
        marginTop: 12,
        marginBottom: 12,
    },
});
