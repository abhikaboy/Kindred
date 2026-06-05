import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

interface DailyHeaderProps {
    selectedDate: Date;
}

export const DailyHeader: React.FC<DailyHeaderProps> = ({ selectedDate }) => {
    // ThemedColor kept for parity with the rest of the daily components.
    useThemeColor();

    return (
        <View style={styles.container}>
            <ThemedText type="title" style={styles.title}>
                {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                })}
            </ThemedText>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: HORIZONTAL_PADDING,
        // 24px above the date, on top of the safe-area inset applied by the screen container.
        paddingTop: 24,
    },
    title: {
        fontWeight: "600",
    },
});
