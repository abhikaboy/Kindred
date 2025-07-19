import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import Octicons from "@expo/vector-icons/Octicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

interface StatItemProps {
    icon?: React.ReactNode;
    label: string;
    value: number;
}

function StatItem({ icon, label, value }: StatItemProps) {
    const ThemedColor = useThemeColor();
    const screenWidth = Dimensions.get("window").width;
    const minCardWidth = screenWidth * 0.3;

    return (
        <View style={[styles.statItem, { backgroundColor: ThemedColor.lightened, minWidth: minCardWidth }]}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
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
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContainer}
            style={styles.statsCard}>
            <StatItem
                icon={<FontAwesome6 name="check" size={iconSize} color={ThemedColor.primary} />}
                label="Completed Tasks"
                value={tasks}
            />
            <StatItem
                icon={<FontAwesome6 size={iconSize} color={ThemedColor.primary} name="coins" />}
                label="Total Points"
                value={points}
            />
            <StatItem
                icon={<Octicons name="flame" size={iconSize} color={ThemedColor.primary} />}
                label="Streak"
                value={streak}
            />
            <StatItem
                icon={<FontAwesome6 name="camera-retro" size={iconSize} color={ThemedColor.primary} />}
                label="Total Posts"
                value={posts}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    statsCard: {
        width: "100%",
    },
    scrollContainer: {
        gap: 8,
        flexDirection: "row",
    },
    statItem: {
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: 16,
        borderRadius: 12,
        gap: 12,
        height: Dimensions.get("window").height * 0.225,
        minWidth: Dimensions.get("window").width * 0.4,
    },
    iconContainer: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        flexDirection: "column",
        alignItems: "flex-start",
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
