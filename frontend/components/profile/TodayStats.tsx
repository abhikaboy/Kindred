import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import Octicons from "@expo/vector-icons/Octicons";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/api/profile";

interface StatItemProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    loading?: boolean;
}

function StatItem({ icon, label, value, loading = false }: StatItemProps) {
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
                    {loading ? "..." : value}
                </ThemedText>
                <ThemedText type="lightBody" style={[styles.statLabel, { color: ThemedColor.text }]}>
                    {label}
                </ThemedText>
            </View>
        </View>
    );
}

interface TodayStatsProps {
    userId?: string;
}

const iconSize = 24;

export default function TodayStats({ userId }: TodayStatsProps) {
    const ThemedColor = useThemeColor();
    const { user } = useAuth();

    // Fetch profile data if viewing another user's profile
    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ["profile", userId],
        queryFn: () => getProfile(userId!),
        enabled: !!userId && userId !== user?._id,
    }) as any; // Type assertion until profile types are aligned

    // Determine which user's stats to show
    const targetUser = userId && userId !== user?._id ? profile : user;

    // Use stats directly from the user profile (no separate API calls needed)
    const stats = {
        streak: targetUser?.streak || 0,
        posts: targetUser?.posts_made || 0,
        points: targetUser?.points || 0,
        tasks: targetUser?.tasks_complete || 0,
    };

    // Loading state based on whether user data is available
    const loading = userId && userId !== user?._id ? profileLoading : !user;

    return (
        <View style={styles.container}>
            <View style={styles.gridContainer}>
                <StatItem
                    icon={<Octicons name="flame" size={iconSize} color={ThemedColor.primary} />}
                    label="Streak"
                    value={stats.streak}
                    loading={loading}
                />
                <StatItem
                    icon={<Octicons name="check-circle" size={iconSize} color={ThemedColor.primary} />}
                    label="Tasks Complete"
                    value={stats.tasks}
                    loading={loading}
                />
                <StatItem
                    icon={<Octicons name="device-camera" size={iconSize} color={ThemedColor.primary} />}
                    label="Posts Made"
                    value={stats.posts}
                    loading={loading}
                />
                <StatItem
                    icon={<Octicons name="credit-card" size={iconSize} color={ThemedColor.primary} />}
                    label="Points"
                    value={stats.points}
                    loading={loading}
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
    },
    statItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: 16,
        borderRadius: 12,
        gap: 12,
        width: "48%",
        minHeight: 70.5,
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
