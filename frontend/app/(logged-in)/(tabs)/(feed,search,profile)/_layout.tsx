import React from "react";

import { Stack } from "expo-router";

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
    if (segment === "(search)") {
        return <Stack screenOptions={{ headerShown: false }} />;
    }
    if (segment === "(profile)") {
        return <Stack screenOptions={{ headerShown: false }} />;
    }
    if (segment === "(feed)") {
        return <Stack screenOptions={{ headerShown: false }} />;
    }
    return <Stack />;
}
