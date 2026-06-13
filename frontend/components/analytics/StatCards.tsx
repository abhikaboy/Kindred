import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";

export interface StatItem {
    label: string;
    value: string;
}

/** Compact metric row for detail screens (Done / On-time / Kudos / Stale). */
export function StatCards({ items }: { items: StatItem[] }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.row}>
            {items.map((item) => (
                <View key={item.label} style={styles.card}>
                    <ThemedText type="fancyFrauncesSubheading" style={styles.value}>
                        {item.value}
                    </ThemedText>
                    <ThemedText type="caption">{item.label}</ThemedText>
                </View>
            ))}
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        row: {
            flexDirection: "row",
            gap: 10,
            marginBottom: 16,
        },
        card: {
            flex: 1,
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            paddingVertical: 14,
            paddingHorizontal: 10,
            alignItems: "flex-start",
            gap: 2,
            boxShadow: ThemedColor.shadowSmall,
        },
        value: {
            fontSize: 20,
        },
    });
