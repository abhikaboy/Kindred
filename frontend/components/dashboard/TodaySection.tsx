import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { Task } from "@/contexts/tasksContext";

const TodaySection = () => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const { startTodayTasks, dueTodayTasks } = useTasks();

    // Get total count and limit display to 3 tasks
    const allTodayTasks = [...dueTodayTasks, ...startTodayTasks];
    const todayTasks = allTodayTasks.slice(0, 3);
    const totalCount = allTodayTasks.length;
    const displayCount = todayTasks.length;

    const handleHeaderPress = () => {
        router.push("/(logged-in)/(tabs)/(task)/today");
    };

    if (totalCount === 0) {
        return null; // Don't show section if no tasks
    }

    return (
        <View style={styles.container}>
            <View style={styles.tasksContainer}>
                {todayTasks.map((task, index) => (
                    <SwipableTaskCard 
                        key={task._id || index} 
                        redirect={true}
                        categoryId={task.categoryID}
                        task={task}
                    />
                ))}
            </View>
        </View>
    );
};

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            width: "100%",
            marginBottom: 4,
        },
        headerContainer: {
            marginBottom: 8,
        },
        headerTop: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
        },
        viewAllButton: {
            flexDirection: "row",
            alignItems: "center",
            padding: 4,
            gap: 4,
        },
        seeAllText: {
            color: ThemedColor.caption,
        },
        countText: {
            color: ThemedColor.caption,
            marginTop: 12,
        },
        tasksContainer: {
            gap: 12,
        },
    });

export default TodaySection;
