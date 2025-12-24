import React from "react";
import { Stack } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function BlueprintLayout() {
    const ThemedColor = useThemeColor();
    
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                contentStyle: {
                    backgroundColor: ThemedColor.background,
                },
            }}
        />
    );
}