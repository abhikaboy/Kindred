import BackButton from "@/components/BackButton";
import { Stack } from "expo-router";
import React from "react";

export const unstable_settings = {
    initialRouteName: "index",
};

export default function ProfileLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                headerTransparent: true,

                headerBackTitle: "",
                headerBackButtonMenuEnabled: false,
                headerLeft: () => <BackButton />,
            }}
        />
    );
}
