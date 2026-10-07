import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";

/**
 * Relative age of the cached data, kept deliberately coarse — the point is to
 * reassure the user their data is recent, not to give them a stopwatch.
 */
function describeAge(timestamp: number | null): string | null {
    if (!timestamp) return null;
    const minutes = Math.floor((Date.now() - timestamp) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Shown whenever we can't reach the backend. The app keeps working from the
 * cached workspace underneath — this just explains why nothing is updating.
 */
export default function OfflineBanner() {
    const { isOffline } = useConnectivity();
    const { lastSyncedAt } = useTasks();
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();

    if (!isOffline) return null;

    const age = describeAge(lastSyncedAt);

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top + 8, backgroundColor: ThemedColor.lightened },
            ]}>
            <Ionicons name="cloud-offline-outline" size={16} color={ThemedColor.caption} />
            <Text style={[styles.text, { color: ThemedColor.caption }]}>
                {age ? `You're offline — last synced ${age}` : "You're offline"}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingBottom: 8,
        paddingHorizontal: 16,
    },
    text: {
        fontFamily: "Outfit",
        fontSize: 13,
    },
});
