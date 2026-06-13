import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { statusColor, statusLabel } from "./analyticsColors";

/** Small colored pill for a health/rhythm status. */
export function StatusPill({ status }: { status: string }) {
    const ThemedColor = useThemeColor() as any;
    const color = statusColor(status, ThemedColor);
    return (
        <View style={[styles.pill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
            <ThemedText type="caption" style={{ color, fontSize: 11 }}>
                {statusLabel(status)}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
});
