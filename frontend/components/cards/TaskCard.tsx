import React, { useState } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import EditPost from "../modals/edit/EditPost";
let ThemedColor = useThemeColor();

const priorityColors = {
    low: ThemedColor.success,
    medium: ThemedColor.warning,
    high: ThemedColor.error,
};

const priorityToString = {
    1: "low",
    2: "medium",
    3: "high",
};

const TaskCard = ({ content, points, priority, redirect = false, id, categoryId }: Props) => {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    let ThemedColor = useThemeColor();

    return (
        <TouchableOpacity
            style={styles.container}
            disabled={!redirect}
            onPress={() =>
                redirect &&
                router.push({
                    pathname: "/task/[id]",
                    params: {
                        name: content,
                        id: id,
                    },
                })
            }
            onLongPress={() => redirect && setEditing(true)}>
            <EditPost visible={editing} setVisible={setEditing} id={{ id: id, category: categoryId }} />
            <View style={{ flexDirection: "column" }}>
                <View>
                    <View style={styles.row}>
                        {/* <ThemedText type="tiny">{points}</ThemedText> */}
                        <View
                            style={[styles.circle, { backgroundColor: priorityColors[priorityToString[priority]] }]}
                        />
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
        backgroundColor: ThemedColor.lightened,
        borderRadius: 16,
        paddingBottom: 16,
        paddingTop: 16,
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
