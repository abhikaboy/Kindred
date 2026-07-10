import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Task } from "@/api/types";

// The upcoming queue: next tasks peek out under the focused card as readable strips.
const ReviewCardStack = ({ upNext }: { upNext: Task[] }) => {
    const ThemedColor = useThemeColor();
    if (upNext.length === 0) return null;

    return (
        <View style={styles.queue}>
            {upNext.slice(0, 2).map((task, i) => (
                <View
                    key={task.id}
                    style={[
                        styles.strip,
                        {
                            backgroundColor: ThemedColor.lightenedCard,
                            borderColor: ThemedColor.tertiary,
                            width: i === 0 ? "94%" : "86%",
                            opacity: i === 0 ? 0.85 : 0.45,
                            marginTop: i === 0 ? 0 : -6,
                            zIndex: 2 - i,
                        },
                    ]}>
                    <ThemedText
                        type="caption"
                        numberOfLines={1}
                        style={{ color: ThemedColor.caption, fontSize: 11, letterSpacing: 0.7 }}>
                        {task.categoryName || ""}
                    </ThemedText>
                    <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ fontSize: 14 }}>
                        {task.content}
                    </ThemedText>
                </View>
            ))}
        </View>
    );
};

export default ReviewCardStack;

const styles = StyleSheet.create({
    queue: {
        width: "100%",
        alignItems: "center",
        marginTop: 10,
    },
    strip: {
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 18,
        paddingVertical: 8,
        gap: 1,
    },
});
