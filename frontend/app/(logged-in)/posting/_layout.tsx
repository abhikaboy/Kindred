import React from "react";
import { Stack } from "expo-router";
import { Dimensions } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { PostComposerProvider } from "@/contexts/PostComposerContext";

export default function PostingLayout() {
    const ThemedColor = useThemeColor();
    return (
        <PostComposerProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    navigationBarHidden: true,
                    contentStyle: {
                        backgroundColor: ThemedColor.background,
                        minHeight: Dimensions.get("screen").height,
                    },
                }}>
                <Stack.Screen name="caption" />
                <Stack.Screen name="groups" />
                <Stack.Screen name="tag-people" options={{ presentation: "modal" }} />
            </Stack>
        </PostComposerProvider>
    );
}
