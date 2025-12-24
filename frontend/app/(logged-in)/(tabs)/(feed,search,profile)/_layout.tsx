import React from "react";

import { Stack } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";

export const unstable_settings = {
    initialRouteName: "search",
    search: {
        initialRouteName: "search",
    },
    profile: {
        initialRouteName: "profile",
    },
    feed: {
        initialRouteName: "feed",
    },
};

export default function DynamicLayout({ segment }) {
    const ThemedColor = useThemeColor();
    
    if (segment === "(search)") {
        return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: ThemedColor.background } }} />;
    }
    if (segment === "(profile)") {
        return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: ThemedColor.background } }} />;
    }
    if (segment === "(feed)") {
        return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: ThemedColor.background } }} />;
    }
    return <Stack screenOptions={{ contentStyle: { backgroundColor: ThemedColor.background } }} />;
}
