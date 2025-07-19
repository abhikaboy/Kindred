import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import TaskCard from "@/components/cards/TaskCard";

interface Task {
    id: string;
    content: string;
    value: number;
    priority: 1 | 2 | 3;
    encourage?: boolean;
}

interface TaskListProps {
    activeTasks: Task[];
    todayTasks: Task[];
    completedTasks: Task[];
    encouragementConfig?: {
        userHandle?: string;
        receiverId: string;
        categoryName: string;
    };
}

export default function TaskList({ activeTasks, todayTasks, completedTasks, encouragementConfig }: TaskListProps) {
    return (
        <>
            <View style={styles.taskSection}>
                <ThemedText type="subtitle">Active Tasks</ThemedText>
                {activeTasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        content={task.content}
                        value={task.value}
                        priority={task.priority}
                        id={task.id}
                        categoryId="profile"
                    />
                ))}
            </View>
            <View style={styles.taskSection}>
                <ThemedText type="subtitle">Today's Tasks</ThemedText>
                {todayTasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        content={task.content}
                        value={task.value}
                        priority={task.priority}
                        id={task.id}
                        categoryId="profile"
                        encourage={task.encourage}
                        encouragementConfig={encouragementConfig}
                    />
                ))}
            </View>
            <View style={styles.taskSection}>
                <ThemedText type="subtitle">Accomplished Recently</ThemedText>
                {completedTasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        content={task.content}
                        value={task.value}
                        priority={task.priority}
                        id={task.id}
                        categoryId="profile"
                    />
                ))}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    taskSection: {
        gap: 12,
    },
});
