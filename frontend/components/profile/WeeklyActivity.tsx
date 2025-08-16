import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ActivityPoint from "@/components/profile/ActivityPoint";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { activityAPI, convertToWeeklyActivityLevels } from "@/api/activity";

interface WeeklyActivityProps {
    userid: string;
    displayName?: string;
}

export default function WeeklyActivity({ userid, displayName }: WeeklyActivityProps) {
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const [activityLevels, setActivityLevels] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRecentActivity = async () => {
            if (!userid) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                
                const activities = await activityAPI.getRecentActivity(userid);
                const levels = convertToWeeklyActivityLevels(activities);
                setActivityLevels(levels);
            } catch (err) {
                console.error('Failed to fetch recent activity:', err);
                setError('Failed to load activity data');
                // Keep default levels on error
            } finally {
                setLoading(false);
            }
        };

        fetchRecentActivity();
    }, [userid]);

    return (
        <TouchableOpacity onPress={() => router.push(`/activity/${userid}?displayName=${encodeURIComponent(displayName || '')}`)} style={styles.section}>
            <View style={styles.header}>
                <ThemedText type="subtitle">Recent Activity</ThemedText>
                <Ionicons name="chevron-forward" size={24} color={ThemedColor.text} />
            </View>
            <View style={styles.activityContainer}>
                {loading ? (
                    // Show loading state with empty activity points
                    Array.from({ length: 8 }, (_, index) => (
                        <ActivityPoint key={index} level={0} />
                    ))
                ) : error ? (
                    // Show error state with empty activity points
                    Array.from({ length: 8 }, (_, index) => (
                        <ActivityPoint key={index} level={0} />
                    ))
                ) : (
                    // Show actual activity data
                    activityLevels.map((level, index) => (
                        <ActivityPoint key={index} level={level} />
                    ))
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    section: {
        gap: 16,
    },
    activityContainer: {
        display: "flex",
        flexDirection: "row",
        gap: "auto",
        width: "100%",
        justifyContent: "space-between",
    },
    header: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
    },
});
