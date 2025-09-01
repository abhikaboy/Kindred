import React from "react";
import { Stack } from "expo-router";

export default function BlueprintLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
            }}
        />
    );
}