// redirect to login if not logged in

import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { Redirect, Slot, Stack, useRouter } from "expo-router";
import React, { useEffect, useState, useRef } from "react";

import { ScrollView, View, ActivityIndicator, Image } from "react-native";
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
import { BlueprintCreationProvider } from "@/contexts/blueprintContext";
import { MotiView } from "moti";
import { Skeleton } from "moti/skeleton";
import { ThemedView } from "@/components/ThemedView";
import { CreateModalProvider, useCreateModal } from "@/contexts/createModalContext";
import CreateModal from "@/components/modals/CreateModal";

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
    const { user, fetchAuthData } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);
    const authInitialized = useRef(false);
    const ThemedColor = useThemeColor();
    const router = useRouter();

    // Handle initial authentication - only run once
    useEffect(() => {
        if (authInitialized.current) return;

        const initializeAuth = async () => {
            try {
                setIsLoading(true);
                await fetchAuthData();
            } catch (error) {
                console.error("Authentication failed:", error);
                router.replace("/login");
            } finally {
                setIsLoading(false);
                authInitialized.current = true;
            }
        };

        initializeAuth();
    }, []); // Empty dependency array is correct here

    // Handle authentication state changes
    useEffect(() => {
        if (!authInitialized.current) return;

        // If auth was initialized but no user, redirect to login
        if (!user) {
            router.replace("/login");
            return;
        }

        // User is authenticated, stop loading
        setIsLoading(false);
    }, [user, router]);

    // Push notification setup - only run when user is authenticated
    useEffect(() => {
        if (!user) return;

        const setupNotifications = async () => {
            try {
                const result = await registerForPushNotificationsAsync();
                if (result) {
                    setExpoPushToken(result.token);
                    console.log("push token", result);

                    // Send token to backend
                    await sendPushTokenToBackend(result.token);
                }
            } catch (error) {
                console.error("Error setting up push notifications:", error);
                showToastable({
                    message: "Error setting up push notifications",
                    status: "danger",
                    position: "top",
                    offset: 100,
                    duration: 3000,
                });
            }
        };

        setupNotifications();

        // Set up notification listeners
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

        // Cleanup function
        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [user]); // Only run when user changes

    // Show loading state while authenticating
    if (isLoading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        type: "timing",
                        duration: 500,
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}>
                    <Image
                        source={require("@/assets/splash-icon.png")}
                        style={{
                            width: 120,
                            height: 120,
                            resizeMode: "contain",
                        }}
                    />
                </MotiView>
            </ThemedView>
        );
    }

    // If no user after loading, redirect will be handled by the useEffect above
    if (!user) {
        return <Redirect href="/login" />;
    }

    return (
        <CreateModalProvider>
            <LayoutContent />
        </CreateModalProvider>
    );
};

// Separate component to use the CreateModal context
const LayoutContent = () => {
    const ThemedColor = useThemeColor();
    const { visible, setVisible, modalConfig } = useCreateModal();

    return (
        <>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: ThemedColor.background } }} />
            <CreateModal 
                visible={visible} 
                setVisible={setVisible}
                edit={modalConfig.edit}
                screen={modalConfig.screen}
                categoryId={modalConfig.categoryId}
                isBlueprint={modalConfig.isBlueprint}
            />
        </>
    );
};

export default layout;
