import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { CheckCircle } from "phosphor-react-native";
import { formatDistanceToNow } from "date-fns";
import { Task } from "@/api/types";

interface CompletedTaskRowProps {
    task: Task;
}

const CompletedTaskRow: React.FC<CompletedTaskRowProps> = ({ task }) => {
    const ThemedColor = useThemeColor();

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <CheckCircle size={20} color={ThemedColor.success} weight="fill" />
            <View style={styles.textContainer}>
                <ThemedText
                    type="defaultSemiBold"
                    numberOfLines={1}
                    style={{ textDecorationLine: "line-through", opacity: 0.7 }}
                >
                    {task.content}
                </ThemedText>
                {task.timeCompleted && (
                    <ThemedText type="caption">
                        {formatDistanceToNow(new Date(task.timeCompleted), { addSuffix: true })}
                    </ThemedText>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    textContainer: {
        flex: 1,
        gap: 2,
    },
});

export default CompletedTaskRow;
