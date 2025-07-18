import React from "react";
import { Stack } from "expo-router";
import { Dimensions, View } from "react-native";
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
        <View
            style={{
                flex: 1,
                backgroundColor: ThemedColor.background,
                justifyContent: "center",
                alignItems: "center",
            }}>
            <ThemedText type="default">{error.message}</ThemedText>
            <ThemedText type="default" onPress={retry}>
                Try Again?
            </ThemedText>
        </View>
    );
}

export default function TaskLayout() {
    const ThemedColor = useThemeColor();
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                navigationBarHidden: true,
                contentStyle: {
                    backgroundColor: ThemedColor.background,
                    minHeight: Dimensions.get("screen").height,
                },
            }}
        />
    );
}
