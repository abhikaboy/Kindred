import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import Octicons from "@expo/vector-icons/Octicons";

interface StatItemProps {
    icon: React.ReactNode;
    label: string;
    value: number;
}

function StatItem({ icon, label, value }: StatItemProps) {
    const ThemedColor = useThemeColor();

    return (
        <View
            style={[
                styles.statItem,
                {
                    backgroundColor: ThemedColor.lightened,
                    shadowColor: ThemedColor.text,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                },
            ]}>
            <View style={styles.iconContainer}>{icon}</View>
            <View style={styles.textContainer}>
                <ThemedText type="default" style={[styles.statValue, { color: ThemedColor.text }]}>
                    {value}
                </ThemedText>
                <ThemedText type="lightBody" style={[styles.statLabel, { color: ThemedColor.text }]}>
                    {label}
                </ThemedText>
            </View>
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
        <View style={styles.container}>
            <View style={styles.gridContainer}>
                <StatItem
                    icon={<Octicons name="flame" size={iconSize} color={ThemedColor.primary} />}
                    label="Streak"
                    value={streak}
                />
                <StatItem
                    icon={<Octicons name="device-camera" size={iconSize} color={ThemedColor.primary} />}
                    label="Posts"
                    value={posts}
                />
                <StatItem
                    icon={<Octicons name="credit-card" size={iconSize} color={ThemedColor.primary} />}
                    label="Total Points"
                    value={points}
                />
                <StatItem
                    icon={<Octicons name="check-circle" size={iconSize} color={ThemedColor.primary} />}
                    label="Tasks Done"
                    value={tasks}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
    },
    gridContainer: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        height: 175,
    },
    statItem: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        padding: 16,
        borderRadius: 12,
        gap: 12,
        width: "48%",
        height: 70.5,
    },
    iconContainer: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        flex: 1,
        flexDirection: "column",
        justifyContent: "center",
        gap: 0,
    },
    statValue: {
        fontWeight: "500",
        fontSize: 14,
        lineHeight: 18,
        marginBottom: 0,
    },
    statLabel: {
        fontWeight: "500",
        fontSize: 14,
        lineHeight: 18,
    },
});
