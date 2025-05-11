// redirect to login if not logged in
import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Redirect, Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

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
