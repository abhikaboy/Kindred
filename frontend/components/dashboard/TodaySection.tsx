import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import TaskCard from "@/components/cards/TaskCard";
import { Task } from "@/contexts/tasksContext";

const TodaySection = () => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const { startTodayTasks, dueTodayTasks } = useTasks();

    // Combine and limit to 3 tasks
    const todayTasks = [...dueTodayTasks, ...startTodayTasks].slice(0, 3);

    const handleHeaderPress = () => {
        router.push("/(logged-in)/(tabs)/(task)/today");
    };

    if (todayTasks.length === 0) {
        return null; // Don't show section if no tasks
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={handleHeaderPress} style={styles.header}>
                <ThemedText type="subtitle">Today</ThemedText>
                <View style={styles.viewAllButton}>
                    <Ionicons name="chevron-forward" size={24} color={ThemedColor.text} />
                </View>
            </TouchableOpacity>

            <View style={styles.tasksContainer}>
                {todayTasks.map((task, index) => (
                    <TaskCard key={task._id || index} task={task} />
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
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
        },
        viewAllButton: {
            padding: 4,
        },
        tasksContainer: {
            gap: 12,
        },
    });

export default TodaySection;
