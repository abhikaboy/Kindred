import React from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from "react-native";
import { ArrowLeft, Camera } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { Task } from "@/api/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface PostTaskSelectionViewProps {
    completedTasks: Task[];
    loading: boolean;
    onBackPress: () => void;
    onTaskSelect: (task: Task) => void;
    onLayout: (event: any) => void;
}

export const PostTaskSelectionView: React.FC<PostTaskSelectionViewProps> = ({
    completedTasks,
    loading,
    onBackPress,
    onTaskSelect,
    onLayout,
}) => {
    const ThemedColor = useThemeColor();

    return (
        <View
            style={styles.menuSection}
            onLayout={onLayout}
        >
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        onPress={onBackPress}
                        style={styles.backButton}
                    >
                        <ArrowLeft size={20} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>
                    <View style={styles.headerText}>
                        <ThemedText type="defaultSemiBold">
                            Select Completed Task
                        </ThemedText>
                        <ThemedText type="caption" style={styles.headerCaption}>
                            Choose a task to share
                        </ThemedText>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.taskList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.taskListContent}
            >
                {loading ? (
                    <View style={styles.emptyState}>
                        <ThemedText type="caption">Loading tasks...</ThemedText>
                    </View>
                ) : completedTasks.length === 0 ? (
                    <View style={styles.emptyState}>
                        <ThemedText type="caption">No completed tasks found</ThemedText>
                    </View>
                ) : (
                    completedTasks.map((task) => (
                        <TouchableOpacity
                            key={task.id}
                            style={[
                                styles.taskItem,
                                {
                                    backgroundColor: ThemedColor.lightenedCard,
                                    borderWidth: 1,
                                    borderColor: ThemedColor.tertiary,
                                }
                            ]}
                            onPress={() => onTaskSelect(task)}
                        >
                            <View style={styles.taskContent}>
                                <View style={styles.taskText}>
                                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                                        {task.content}
                                    </ThemedText>
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                        {task.categoryName}
                                    </ThemedText>
                                </View>
                            </View>
                            <View style={[styles.taskAction, { backgroundColor: ThemedColor.primary + "10" }]}>
                                <Camera size={20} color={ThemedColor.primary} weight="regular" />
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    menuSection: {
        padding: 8,
    },
    header: {
        padding: 16,
        paddingBottom: 12,
    },
    headerContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    backButton: {
        padding: 4,
    },
    headerText: {
        flex: 1,
    },
    headerCaption: {
        marginTop: 4,
        fontSize: 14,
    },
    taskList: {
        maxHeight: SCREEN_HEIGHT * 0.5,
        paddingHorizontal: 8,
    },
    taskListContent: {
        paddingBottom: 8,
    },
    emptyState: {
        padding: 16,
        alignItems: "center",
    },
    taskItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    taskContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    taskText: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 2,
    },
    taskAction: {
        padding: 10,
        borderRadius: 20,
        marginLeft: 8,
    },
});
