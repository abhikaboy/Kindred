import { Stack } from "expo-router";
import React from "react";

export default function TutorialLayout() {
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
            <Stack.Screen name="index" />
            <Stack.Screen name="workspaces" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="task-details" />
            <Stack.Screen name="swipe-complete" />
            <Stack.Screen name="public-tasks" />
        </Stack>
    );
}

