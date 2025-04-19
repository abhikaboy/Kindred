import React, { useState } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import EditPost from "../modals/edit/EditPost";
import { Task } from "@/api/types";

const PRIORITY_MAP = {
    1: "low",
    2: "medium",
    3: "high",
} as const;

type Priority = keyof typeof PRIORITY_MAP;
type PriorityLevel = (typeof PRIORITY_MAP)[Priority];

interface Props {
    content: string;
    value: number;
    priority: Priority;
    redirect?: boolean;
    id: string;
    categoryId: string;
}

const TaskCard = ({ content, value, priority, redirect = false, id, categoryId }: Props) => {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const ThemedColor = useThemeColor();

    const getPriorityColor = (level: PriorityLevel) => {
        switch (level) {
            case "low":
                return ThemedColor.success;
            case "medium":
                return ThemedColor.warning;
            case "high":
                return ThemedColor.error;
        }
    };

    const handlePress = () => {
        if (!redirect) return;
        router.push({
            pathname: "/task/[id]",
            params: { name: content, id },
        });
    };

    const handleLongPress = () => {
        if (redirect) setEditing(true);
    };

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: ThemedColor.lightened }]}
            disabled={!redirect}
            onPress={handlePress}
            onLongPress={handleLongPress}>
            <EditPost visible={editing} setVisible={setEditing} id={{ id, category: categoryId }} />
            <View style={styles.row}>
                <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                    {value}
                </ThemedText>
                <View style={[styles.circle, { backgroundColor: getPriorityColor(PRIORITY_MAP[priority]) }]} />
            </View>
            <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.content} type="default">
                {content}
            </ThemedText>
        </TouchableOpacity>
    );
};

export default TaskCard;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        borderRadius: 16,
        paddingVertical: 16,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 6,
        marginRight: -6,
    },
    circle: {
        width: 10,
        height: 10,
        borderRadius: 10,
    },
    content: {
        textAlign: "left",
        marginTop: -11,
        paddingRight: 33,
    },
});
