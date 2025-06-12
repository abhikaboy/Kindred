import React from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import { type ErrorBoundaryProps } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import BackButton from "@/components/BackButton";

export const unstable_settings = {
    initialRouteName: "index",
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background }}>
            <ThemedText type="default">{error.message}</ThemedText>
            <ThemedText type="default" onPress={retry}>
                Try Again?
            </ThemedText>
        </View>
    );
}

export default function TaskLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
}
