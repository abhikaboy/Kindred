import React from "react";
import { Stack } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function ActivityLayout() {
    const ThemedColor = useThemeColor();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: ThemedColor.background }
            }}
        />
    );
}
