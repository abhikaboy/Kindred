import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import Octicons from "@expo/vector-icons/Octicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

interface StatItemProps {
    icon: React.ReactNode;
    label: string;
    value: number;
}

function StatItem({ icon, label, value }: StatItemProps) {
    const ThemedColor = useThemeColor();

    return (
        <View style={[styles.statItem, { backgroundColor: ThemedColor.lightened }]}>
            {icon}
            <ThemedText type="default" style={styles.statValue}>
                {value}
            </ThemedText>
            <ThemedText type="lightBody">{label}</ThemedText>
        </View>
    );
}

interface TodayStatsProps {
    tasks: number;
    points: number;
    streak: number;
    posts: number;
}

const iconSize = 24;

export default function TodayStats({ tasks, points, streak, posts }: TodayStatsProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={[styles.statsCard]}>
            <StatItem
                icon={<FontAwesome6 name="check-square" size={iconSize} color={ThemedColor.success} />}
                label="Tasks"
                value={tasks}
            />
            <StatItem
                icon={<FontAwesome6 size={iconSize} color={ThemedColor.primary} name="coins" />}
                label="Points"
                value={points}
            />
            <StatItem
                icon={<Octicons name="flame" size={iconSize} color={ThemedColor.error} />}
                label="Streak"
                value={streak}
            />
            <StatItem
                icon={<Ionicons name="camera-outline" size={iconSize} color={ThemedColor.warning} />}
                label="Posts"
                value={posts}
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
        alignSelf: "stretch",
        width: "100%",
        paddingVertical: 4,
        borderRadius: 12,
    },
    statItem: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        borderRadius: 12,
        alignSelf: "stretch",
        width: "24%",
        gap: 12,
    },
    statValue: {
        fontWeight: "500",
    },
});
