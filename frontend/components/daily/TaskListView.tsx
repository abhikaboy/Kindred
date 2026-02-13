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

    const getItemType = React.useCallback((item: any) => {
        return 'task';
    }, []);

    return (
        <View style={styles.container}>
            {tasksForSelectedDate.length > 0 ? (
                <View style={{ minHeight: 2 }}>
                    <FlashList
                        data={tasksForSelectedDate}
                        renderItem={renderTaskItem}
                        keyExtractor={(item) => item.id + item.content}
                        getItemType={getItemType}
                        removeClippedSubviews={true}
                    />
                </View>
            ) : (
                <ThemedText type="lightBody" style={styles.emptyText}>
                    No tasks for this date
                </ThemedText>
            )}

            <TaskSection
                tasks={overdueTasks}
                title="Overdue Tasks"
                description=""
                emptyMessage="No overdue tasks"
            />
            <TaskSection
                tasks={upcomingTasks}
                title="Upcoming Tasks"
                description="These tasks have future start dates or deadlines."
                emptyMessage="No upcoming tasks"
            />
            <TaskSection
                tasks={pastTasks}
                title="Past Tasks"
                description="These tasks started in the past but have no deadline."
                emptyMessage="No past tasks"
            />
            <TaskSection
                tasks={unscheduledTasks}
                title="Unscheduled Tasks"
                description="These are tasks that don't have a start date or deadline. Swipe right to schedule for this day."
                useSchedulable={true}
                onScheduleTask={onQuickSchedule}
                emptyMessage="No unscheduled tasks"
                schedulingType="deadline"
            />
        </View>
    );
};

// Memoize TaskListView to prevent unnecessary re-renders when hidden
export const TaskListView = React.memo(TaskListViewComponent, (prevProps, nextProps) => {
    return (
        prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime() &&
        prevProps.tasksForSelectedDate === nextProps.tasksForSelectedDate &&
        prevProps.overdueTasks === nextProps.overdueTasks &&
        prevProps.upcomingTasks === nextProps.upcomingTasks &&
        prevProps.pastTasks === nextProps.pastTasks &&
        prevProps.unscheduledTasks === nextProps.unscheduledTasks
    );
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
