// redirect to login if not logged in
import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { Redirect, Stack, useRouter } from "expo-router";
import React, { useEffect, useState, useRef } from "react";

import { ScrollView, View, ActivityIndicator } from "react-native";
import { type ErrorBoundaryProps } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import * as Notifications from "expo-notifications";
import {
    registerForPushNotificationsAsync,
    addNotificationListener,
    addNotificationResponseListener,
    sendPushTokenToBackend,
} from "@/utils/notificationService";
import { showToastable, ToastableMessageStatus } from "react-native-toastable";

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
            }}>
            <ThemedText type="heading">{error.name}</ThemedText>
            <ThemedText type="heading">Oops! Something went wrong.</ThemedText>
            <ThemedText type="default">{error.message}</ThemedText>
            <ThemedText type="default">{error.stack}</ThemedText>
            <ThemedText type="default">{error.cause as string}</ThemedText>
            <ThemedText type="default" onPress={retry}>
                Try Again?
            </ThemedText>
            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const layout = ({ children }: { children: React.ReactNode }) => {
    const { fetchAuthData } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

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

    // Push notification setup - optimized to avoid unnecessary API calls
    useEffect(() => {
        // Only run this once when the user is authenticated
        if (user) {
            registerForPushNotificationsAsync().then((result) => {
                if (result) {
                    setExpoPushToken(result.token);
                    console.log("push token", result);

                    // Only send to backend if token is new or changed
                    // TODO: Uncomment this when we have a way to check if the token is new or changed
                    // if (result.isNew) {
                    try {
                        sendPushTokenToBackend(result.token);
                    } catch (error) {
                        console.error("Error sending push token to backend:", error);
                        showToastable({
                            message: "Error sending push token to backend",
                            status: "danger",
                            position: "top",
                            offset: 100,
                            duration: 3000,
                            onToastableHide: () => {
                                console.log("Toast hidden");
                            },
                        });
                    }
                    // }
                }
            });

            // Notification handling remains the same
            notificationListener.current = addNotificationListener((notification) => {
                console.log("Notification received:", notification);
            });

            responseListener.current = addNotificationResponseListener((response) => {
                console.log("Notification response:", response);
                const data = response.notification.request.content.data;
                if (data?.screen) {
                    router.push(data.screen);
                }
            });
        }

        // Cleanup function
        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, [user]); // Only run when user changes (auth state changes)

    useEffect(() => {
        console.log("isLoading", isLoading);
    }, [isLoading]);

    if (!user && !isLoading) {
        return <Redirect href="/login" />;
    }

    if (isLoading) {
        return <Stack screenOptions={{ headerShown: false }} />;
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
