import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getCompletedTasksAPI } from "@/api/task";
import { Camera, CheckCircle, Confetti } from "phosphor-react-native";
import { formatDistanceToNow } from "date-fns";

const RecentlyCompletedTasks = () => {
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);

    const { data, isLoading } = useQuery({
        queryKey: ["completedTasks", "recent"],
        queryFn: () => getCompletedTasksAPI(1, 10),
    });

    // Filter out tasks that have already been posted
    const recentTasks = data?.tasks?.filter((task: any) => !task.posted).slice(0, 3) || [];

    const handleTaskPress = (task: any) => {
        router.push({
            pathname: "/(logged-in)/posting/cameraview",
            params: {
                taskInfo: JSON.stringify({
                    id: task.id,
                    name: task.content,
                    category: task.categoryID,
                    categoryName: task.categoryName,
                    public: task.public,
                }),
            },
        });
    };

    if (isLoading || recentTasks.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="caption">RECENTLY COMPLETED</ThemedText>
                <Confetti size={20} color={ThemedColor.caption} weight="duotone" />
            </View>
            
            <View style={styles.listContainer}>
                {recentTasks.map((task) => (
                    <TouchableOpacity
                        key={task.id}
                        style={styles.taskItem}
                        onPress={() => handleTaskPress(task)}
                    >
                        <View style={styles.taskContent}>
                            <View style={styles.textContainer}>
                                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                                    {task.content}
                                </ThemedText>
                                {task.timeCompleted && (
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                        {formatDistanceToNow(new Date(task.timeCompleted), { addSuffix: true })}
                                    </ThemedText>
                                )}
                            </View>
                        </View>
                        <View style={styles.actionButton}>
                            <Camera size={20} color={ThemedColor.primary} weight="regular" />
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            marginHorizontal: 20,
            marginBottom: 18,
            gap: 12,
        },
        header: {
            marginBottom: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            // justifyContent: "space-between",
        },
        listContainer: {
            gap: 8,
        },
        taskItem: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: ThemedColor.lightenedCard,
            padding: 8,
            paddingHorizontal: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
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
        iconContainer: {
            justifyContent: "center",
            alignItems: "center",
        },
        textContainer: {
            flex: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 2,
        },
        metaContainer: {
            flexDirection: "row",
            alignItems: "center",
        },
        actionButton: {
            padding: 10,
            backgroundColor: ThemedColor.primary + "10", // 10% opacity
            borderRadius: 20,
            marginLeft: 8,
        },
    });

export default RecentlyCompletedTasks;
