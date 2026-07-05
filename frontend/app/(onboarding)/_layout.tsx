import { Stack } from "expo-router";
import React from "react";
import { BlueprintCreationProvider } from "@/contexts/blueprintContext";

export default function OnboardingLayout() {
    return (
        // The tutorial renders CreateModal → Standard, which reads useBlueprints;
        // the logged-in provider doesn't cover this route group
        <BlueprintCreationProvider>
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: {
                    backgroundColor: 'white',
                },
            }}
        >
            <Stack.Screen name="productivity" />
            <Stack.Screen name="positivity" />
            <Stack.Screen name="phone" />
            <Stack.Screen name="name" />
            <Stack.Screen name="password" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="tutorial" options={{ gestureEnabled: false }} />
            <Stack.Screen name="calendar" />
        </Stack>
        </BlueprintCreationProvider>
    );
}
