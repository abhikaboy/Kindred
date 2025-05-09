import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import Octicons from "@expo/vector-icons/Octicons";
import { useThemeColor } from "@/hooks/useThemeColor";

interface StatItemProps {
    icon: React.ReactNode;
    label: string;
    value: number;
}

function StatItem({ icon, label, value }: StatItemProps) {
    return (
        <View style={styles.statItem}>
            {icon}
            <ThemedText type="lightBody">{label}</ThemedText>
            <ThemedText type="default" style={styles.statValue}>
                {value}
            </ThemedText>
        </View>
    );
}

interface TodayStatsProps {
    tasks: number;
    points: number;
    streak: number;
}

const iconSize = 24;

export default function TodayStats({ tasks, points, streak }: TodayStatsProps) {
    const ThemedColor = useThemeColor();

    return (
        <View style={[styles.statsCard, { backgroundColor: ThemedColor.lightened }]}>
            <StatItem
                icon={<Ionicons name="checkmark" size={iconSize} color={ThemedColor.success} />}
                label="Tasks"
                value={tasks}
            />
            <StatItem
                icon={<Ionicons size={iconSize} color={ThemedColor.primary} name="cash-outline" />}
                label="Points"
                value={points}
            />
            <StatItem
                icon={<Octicons name="flame" size={iconSize} color={ThemedColor.error} />}
                label="Streak"
                value={streak}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    statsCard: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: 20,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statItem: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        gap: 4,
    },
    statValue: {
        fontWeight: "500",
    },
});
