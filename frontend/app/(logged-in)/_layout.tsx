// redirect to login if not logged in
import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { Redirect, Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";

import { View } from "react-native";
import { type ErrorBoundaryProps } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background }}>
            <ThemedText type="heading">{error.name}</ThemedText>
            <ThemedText type="heading">root</ThemedText>
            <ThemedText type="default">{error.stack}</ThemedText>
            <ThemedText type="default">{error.message}</ThemedText>
            <ThemedText type="default" onPress={retry}>
                Try Again?
            </ThemedText>
        </View>
    );
}

const layout = ({ children }: { children: React.ReactNode }) => {
    const { fetchAuthData } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    const router = useRouter();
    useEffect(() => {
        if (isLoading) {
            fetchAuthData()
                .then((user) => {
                    setUser(user);
                    setIsLoading(false);
                })
                .catch((error) => {
                    setIsLoading(false);
                    router.replace("/login");
                });
        }
    }, []);

    if (isLoading) {
        return <Stack screenOptions={{ headerShown: false }} />;
    }

    if (!user) {
        console.log("redirecting to login");
        return <Redirect href="/login" />;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                headerTransparent: true,
                headerLeft: (tab) => <BackButton />,
                headerBackButtonDisplayMode: "minimal",
                headerTitleStyle: {
                    fontFamily: "Outfit",
                    fontWeight: 100,
                    fontSize: 1,
                },
            }}
        />
    );
};

export default layout;
