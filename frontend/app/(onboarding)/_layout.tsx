import { Stack } from "expo-router";
import React from "react";

export default function OnboardingLayout() {
    return (
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
            <Stack.Screen name="accomplishment" />
        </Stack>
    );
}
