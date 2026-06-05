import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ForYouCard as ForYouCardModel } from "@/api/forYou";

type Props = {
    card: ForYouCardModel;
    /** Adds a subtle drop shadow to lift the card off the page (Catch up section). */
    elevated?: boolean;
};

/**
 * Renders a weekly_recap card as a compact value table ("This week at a glance")
 * instead of a prose summary line. Each metric is one labeled row.
 */
export default function WeeklyRecapCard({ card, elevated }: Props) {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const metrics = card.metrics ?? [];

    return (
        <TouchableOpacity
            onPress={() => router.push(card.deepLink as never)}
            activeOpacity={0.8}
            style={[styles.container, elevated && styles.elevation]}
            accessibilityRole="button"
            accessibilityLabel={card.title}>
            <View style={styles.header}>
                <View style={[styles.iconCircle, { backgroundColor: ThemedColor.primary + "20" }]}>
                    <Ionicons name="sparkles" size={20} color={ThemedColor.primary} />
                </View>
                <ThemedText type="defaultSemiBold">{card.title}</ThemedText>
            </View>

            <View style={styles.table}>
                {metrics.map((metric, index) => (
                    <View
                        key={metric.label}
                        style={[
                            styles.row,
                            index < metrics.length - 1 && {
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: ThemedColor.tertiary,
                            },
                        ]}>
                        <ThemedText type="caption" style={styles.label}>
                            {metric.label}
                        </ThemedText>
                        <ThemedText type="defaultSemiBold" style={styles.value}>
                            {metric.value}
                        </ThemedText>
                    </View>
                ))}
            </View>
        </TouchableOpacity>
    );
}

const stylesheet = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: {
            padding: 16,
            borderRadius: 14,
            backgroundColor: ThemedColor.lightenedCard,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
        },
        elevation: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
        },
        iconCircle: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
        },
        table: {
            marginTop: 4,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
        },
        label: {
            flex: 1,
        },
        value: {
            marginLeft: 12,
        },
    });
