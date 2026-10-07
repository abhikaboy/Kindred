import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Camera } from "phosphor-react-native";
import { formatDistanceToNow } from "date-fns";
import { Task } from "@/api/types";

interface CompletedTaskRowProps {
    task: Task;
}

const CompletedTaskRow: React.FC<CompletedTaskRowProps> = ({ task }) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();

    const handlePress = () => {
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

    return (
        <TouchableOpacity
            style={[styles.taskItem, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}
            onPress={handlePress}
        >
            <View style={styles.taskContent}>
                <View style={styles.textContainer}>
                    <ThemedText type="defaultSemiBold" numberOfLines={2}>
                        {task.content}
                    </ThemedText>
                    {task.timeCompleted && (
                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                            {formatDistanceToNow(new Date(task.timeCompleted), { addSuffix: true })}
                        </ThemedText>
                    )}
                </View>
            </View>
            <View style={[styles.actionButton, { backgroundColor: ThemedColor.primary + "10" }]}>
                <Camera size={20} color={ThemedColor.primary} weight="regular" />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    taskItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
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
    textContainer: {
        flex: 1,
        gap: 2,
    },
    actionButton: {
        padding: 10,
        borderRadius: 20,
        marginLeft: 8,
    },
});

export default CompletedTaskRow;
