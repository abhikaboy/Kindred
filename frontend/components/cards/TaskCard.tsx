import React from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { ThemedText } from "../ThemedText";
import { Colors } from "@/constants/Colors";

type Priority = "low" | "medium" | "high";

type Props = {
    content: string;
    points: number;
    priority: Priority;
    id?: string;
};

const priorityColors = {
    low: Colors.dark.success,
    medium: Colors.dark.warning,
    high: Colors.dark.error,
};

const TaskCard = ({ content, points, priority }: Props) => {
    return (
        <TouchableOpacity style={styles.container}>
            <View style={{ flexDirection: "column" }}>
                <View>
                    <View style={styles.row}>
                        <ThemedText type="tiny">{points}</ThemedText>
                        <View style={[styles.circle, { backgroundColor: priorityColors[priority] }]} />
                    </View>
                    <ThemedText
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{ textAlign: "left", paddingTop: 0, marginTop: -11, paddingRight: 33 }}
                        type="default">
                        {content}
                    </ThemedText>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default TaskCard;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        backgroundColor: "#171626",
        borderRadius: 16,
        paddingBottom: 16,
        paddingTop: 9,
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
});
