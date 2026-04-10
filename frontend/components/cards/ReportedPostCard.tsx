import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    onDismiss?: () => void;
};

export default function ReportedPostCard({ onDismiss }: Props) {
    const ThemedColor = useThemeColor();

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background, borderBottomColor: ThemedColor.tertiary }]}>
            <ThemedText style={styles.message}>
                Thank you for reporting. We've hidden this post.
            </ThemedText>
            {onDismiss && (
                <TouchableOpacity onPress={onDismiss}>
                    <ThemedText style={[styles.dismiss, { color: ThemedColor.caption }]}>Dismiss</ThemedText>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 24,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    message: {
        fontSize: 15,
        textAlign: "center",
        fontWeight: "500",
    },
    dismiss: {
        fontSize: 14,
        marginTop: 4,
    },
});
