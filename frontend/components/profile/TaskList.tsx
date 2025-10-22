import React from "react";
import { View, StyleSheet, Image, useColorScheme, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import TaskCard from "@/components/cards/TaskCard";

interface Task {
    id: string;
    content: string;
    value: number;
    priority: 1 | 2 | 3;
    encourage?: boolean;
    categoryName: string;
}

interface TaskListProps {
    todayTasks: Task[];
    completedTasks: Task[];
    encouragementConfig?: {
        userHandle?: string;
        receiverId: string;
        categoryName: string;
    };
}

export default function TaskList({
    todayTasks,
    completedTasks,
    encouragementConfig,
}: TaskListProps) {
    const colorScheme = useColorScheme();
    const isEmpty = todayTasks.length === 0 && completedTasks.length === 0;

    if (isEmpty) {
        return (
            <View style={styles.emptyStateContainer}>
                <Image 
                    source={require('@/assets/images/211. Coffee.png')}
                    style={[
                        styles.emptyStateImage,
                        colorScheme === 'dark' && styles.invertedImage
                    ]}
                    resizeMode="contain"
                />
                <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 8 }}>
                    All wrapped up!
                </ThemedText>
                <ThemedText style={{ textAlign: 'center', opacity: 0.7 }}>
                    We're all caught up and don't have any tasks to show!
                </ThemedText>
            </View>
        );
    }

    return (
        <>
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
                        encouragementConfig={
                            task.encourage
                                ? {
                                      userHandle: encouragementConfig.userHandle,
                                      receiverId: encouragementConfig.receiverId,
                                      categoryName: encouragementConfig.categoryName,
                                  }
                                : undefined
                        }
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
    emptyStateContainer: {
        paddingVertical: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateImage: {
        width: Dimensions.get("window").width * 0.6,
        height: Dimensions.get("window").width * 0.6,
        marginBottom: 20,
        marginTop: -32,
    },
    invertedImage: {
        tintColor: '#ffffff',
    },
});
