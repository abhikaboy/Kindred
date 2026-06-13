import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { AnalyticsHome } from "@/components/analytics/AnalyticsHome";

export default function ActivityIndex() {
    const { user } = useAuth();
    const ThemedColor = useThemeColor();

    // Wait for the user before rendering the dashboard (layout + queries key off it).
    if (!user) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: ThemedColor.background }}>
                <ActivityIndicator size="large" color={ThemedColor.primary} />
            </View>
        );
    }

    return <AnalyticsHome />;
}
