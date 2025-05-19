// redirect to login if not logged in
import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { Redirect, Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";

import { ScrollView, View, ActivityIndicator } from "react-native";
import { type ErrorBoundaryProps } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";

export const unstable_settings = {
    initialRouteName: "index",
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const ThemedColor = useThemeColor();
    return (
        <ScrollView
            style={{
                flex: 1,
                backgroundColor: ThemedColor.background,
                padding: 20,
                paddingTop: 150,
                paddingBottom: 150,
                justifyContent: "center",
                alignItems: "center",
            }}>
            <ThemedText type="heading">{error.name}</ThemedText>
            <ThemedText type="heading">Oops! Something went wrong.</ThemedText>
            <ThemedText type="default">{error.message}</ThemedText>
            <ThemedText type="default">{error.stack}</ThemedText>
            <ThemedText type="default">{error.cause as string}</ThemedText>
            <ThemedText type="default" onPress={retry}>
                Try Again?
            </ThemedText>
        </ScrollView>
    );
}

const layout = ({ children }: { children: React.ReactNode }) => {
    const { fetchAuthData } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    const router = useRouter();

    useEffect(() => {
        setIsLoading(true);

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

        console.log("isLoading", isLoading);
    }, []);

    useEffect(() => {
        console.log("isLoading", isLoading);
    }, [isLoading]);

    if (!user && !isLoading) {
        return <Redirect href="/login" />;
    }

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={"#000"} />
            </View>
        );
    }

    return (
        <>
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
        </>
    );
};

export default layout;
