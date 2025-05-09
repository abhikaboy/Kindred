import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ActivityPoint from "@/components/profile/ActivityPoint";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";

interface WeeklyActivityProps {
    activityLevels: number[];
}

export default function WeeklyActivity({ activityLevels }: WeeklyActivityProps) {
    const router = useRouter();
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity onPress={() => router.push("/Activity")} style={styles.section}>
            <View style={styles.header}>
                <ThemedText type="subtitle">Past 7 Day</ThemedText>
                <Ionicons name="chevron-forward" size={24} color={ThemedColor.text} />
            </View>
            <View style={styles.activityContainer}>
                {activityLevels.map((level, index) => (
                    <ActivityPoint key={index} level={level} />
                ))}
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
