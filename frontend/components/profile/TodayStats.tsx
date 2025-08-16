import React, { useEffect, useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import Octicons from "@expo/vector-icons/Octicons";
import { getTodayCompletedTasksCount, getTotalPointsFromCompletedTasks } from "@/api/task";
import { useAuth } from "@/hooks/useAuth";

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
    const [stats, setStats] = useState({
        tasks: 0,
        points: 0,
        streak: 0, // TODO: Implement streak calculation
        posts: 0,  // TODO: Implement posts count
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!userId && !user?._id) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                
                // Fetch today's completed tasks count
                const todayTasks = await getTodayCompletedTasksCount();
                
                // Fetch total points from completed tasks
                const totalPoints = await getTotalPointsFromCompletedTasks();
                
                setStats({
                    tasks: todayTasks,
                    points: Math.round(totalPoints), // Round to nearest integer
                    streak: 0, // TODO: Implement streak calculation from activity data
                    posts: 0,  // TODO: Implement posts count from posts API
                });
            } catch (error) {
                console.error('Error fetching today stats:', error);
                // Keep default values on error
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [userId, user?._id]);

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
                    icon={<Octicons name="device-camera" size={iconSize} color={ThemedColor.primary} />}
                    label="Posts"
                    value={stats.posts}
                    loading={loading}
                />
                <StatItem
                    icon={<Octicons name="credit-card" size={iconSize} color={ThemedColor.primary} />}
                    label="Total Points"
                    value={stats.points}
                    loading={loading}
                />
                <StatItem
                    icon={<Octicons name="check-circle" size={iconSize} color={ThemedColor.primary} />}
                    label="Tasks Done"
                    value={stats.tasks}
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
