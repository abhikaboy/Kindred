import React from "react";
import { View, StyleSheet } from "react-native";
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

export const TaskListView: React.FC<TaskListViewProps> = ({
    selectedDate,
    tasksForSelectedDate,
    overdueTasks,
    upcomingTasks,
    pastTasks,
    unscheduledTasks,
    onQuickSchedule,
}) => {
    return (
        <View style={styles.container}>
            <View style={{ gap: 8 }}>
                {tasksForSelectedDate.length > 0 ? (
                    tasksForSelectedDate.map((task) => (
                        <SwipableTaskCard
                            key={task.id + task.content}
                            redirect={true}
                            categoryId={task.categoryID}
                            task={task}
                        />
                    ))
                ) : (
                    <ThemedText type="lightBody" style={{ textAlign: "center", marginTop: 12, marginBottom: 12 }}>
                        No tasks for this date
                    </ThemedText>
                )}
            </View>

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

const styles = StyleSheet.create({
    container: {
        gap: 24,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
});

