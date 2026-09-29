import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { isToday } from "date-fns";
import { Plus } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import TaskSection from "@/components/task/TaskSection";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { AgendaRow } from "./WeekAgenda";
import { PlanDayHeader } from "./WaitingSection";
import { isInPlan } from "@/utils/waitingCandidate";

interface TaskListViewProps {
    selectedDate: Date;
    tasksForSelectedDate: any[];
    /** Upcoming recurrences with no real task yet; shown faded, display-only. */
    projectedTasks?: any[];
    overdueTasks: any[];
    openTasks: any[];
    onAddTask: () => void;
}

// Earliest concrete time on the task; untimed tasks sort after timed ones
const sortTime = (task: any): number => {
    const t = task.startTime ?? task.deadline;
    return t ? new Date(t).getTime() : Number.MAX_SAFE_INTEGER;
};

const TaskListViewComponent: React.FC<TaskListViewProps> = ({
    selectedDate,
    tasksForSelectedDate,
    projectedTasks = [],
    overdueTasks,
    openTasks,
    onAddTask,
}) => {
    const ThemedColor = useThemeColor();
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
    const getItemType = React.useCallback(() => 'task', []);

    // In-plan tasks render as their step in PlanDayHeader; released ones never render
    const dayTasks = React.useMemo(
        () =>
            tasksForSelectedDate
                .filter((t) => !t.releasedAt && !(t.plan?.at && isInPlan(t)))
                .sort((a, b) => sortTime(a) - sortTime(b)),
        [tasksForSelectedDate]
    );

    // Waiting and in-progress are relative to now, so they only belong under today
    const showCarryOver = isToday(selectedDate);

    const waiting = React.useMemo(() => [...overdueTasks, ...openTasks], [overdueTasks, openTasks]);
    const hasPlanned = tasksForSelectedDate.length > dayTasks.length;

    return (
        <View style={styles.container}>
            <View style={styles.bleed}>
                <PlanDayHeader selectedDate={selectedDate} waiting={waiting} />
            </View>
            {dayTasks.length > 0 || projectedTasks.length > 0 || hasPlanned ? (
                <View style={{ minHeight: 2 }}>
                    <FlashList
                        data={dayTasks}
                        renderItem={renderTaskItem}
                        keyExtractor={keyExtractor}
                        getItemType={getItemType}
                        removeClippedSubviews={true}
                    />
                    {projectedTasks.map((t) => (
                        <View key={t.id} style={styles.taskItem}>
                            <AgendaRow task={t} date={selectedDate} />
                        </View>
                    ))}
                </View>
            ) : (
                <TouchableOpacity
                    onPress={onAddTask}
                    activeOpacity={0.7}
                    style={[styles.empty, { borderColor: ThemedColor.tertiary }]}
                >
                    <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                        Nothing planned yet
                    </ThemedText>
                    <View style={styles.addRow}>
                        <Plus size={14} color={ThemedColor.primary} weight="bold" />
                        <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                            Add a task
                        </ThemedText>
                    </View>
                </TouchableOpacity>
            )}

            {showCarryOver && openTasks.length > 0 && (
                <TaskSection tasks={openTasks} title="In progress" />
            )}
        </View>
    );
};

// Memoize TaskListView to prevent unnecessary re-renders when hidden
export const TaskListView = React.memo(TaskListViewComponent, (prevProps, nextProps) => {
    // Use length comparison for arrays since useMemo should keep reference stable
    const sameDate = prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime();
    const sameSelectedTasks = prevProps.tasksForSelectedDate.length === nextProps.tasksForSelectedDate.length;
    const sameOverdue = prevProps.overdueTasks.length === nextProps.overdueTasks.length;
    const sameOpen = prevProps.openTasks.length === nextProps.openTasks.length;
    const sameProjected = (prevProps.projectedTasks?.length ?? 0) === (nextProps.projectedTasks?.length ?? 0);

    return sameDate && sameSelectedTasks && sameProjected && sameOverdue && sameOpen && prevProps.onAddTask === nextProps.onAddTask;
});

const styles = StyleSheet.create({
    container: {
        gap: 16,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    bleed: {
        marginHorizontal: -HORIZONTAL_PADDING,
    },
    taskItem: {
        marginBottom: 8,
    },
    empty: {
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 16,
        paddingVertical: 20,
        alignItems: "center",
        gap: 8,
    },
    addRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
});
