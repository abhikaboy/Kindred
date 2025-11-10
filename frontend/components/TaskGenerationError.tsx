import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    message: string;
};

export const TaskGenerationError = ({ message }: Props) => {
    const ThemedColor = useThemeColor();

    return (
        <View style={[styles.errorContainer, { backgroundColor: ThemedColor.tertiary }]}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" style={styles.errorIcon} />
            <ThemedText style={styles.errorText}>
                {message}
            </ThemedText>
        </View>
    );
};

const styles = StyleSheet.create({
    errorContainer: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 8,
        marginVertical: 12,
        gap: 8,
    },
    errorIcon: {
        flexShrink: 0,
    },
    errorText: {
        fontSize: 14,
        flex: 1,
        color: "#ef4444",
    },
});

