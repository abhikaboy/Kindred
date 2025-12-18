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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import DefaultToast from "@/components/ui/DefaultToast";
import { updateTimezone } from "@/api/profile";
import * as Localization from 'expo-localization';

export const unstable_settings = {
    initialRouteName: "index",
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const ThemedColor = useThemeColor();
    return (
        <ScrollView style={{ flex: 1, backgroundColor: ThemedColor.background.base }}>
            <View style={{ flex: 1, padding: 20, marginTop: 100 }}>
                <ThemedText type="title" style={{ color: ThemedColor.text.error }}>
                    Something went wrong
                </ThemedText>
                <ThemedText style={{ marginTop: 10 }}>{error.message}</ThemedText>
                <ThemedText style={{ marginTop: 10, fontWeight: "bold" }} onPress={retry}>
                    Try Again
                </ThemedText>
                <ThemedText style={{ marginTop: 10, fontWeight: "bold" }} onPress={() => {
                    AsyncStorage.clear();
                }}>
                    Clear Cache
                </ThemedText>
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const layout = ({ children }: { children: React.ReactNode }) => {
    const { user, fetchAuthData } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [redirectPath, setRedirectPath] = useState<string | null>(null);
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);
    const authInitialized = useRef(false);
    const ThemedColor = useThemeColor();
    const router = useRouter();

    // Handle initial authentication and routing - only run once
    useEffect(() => {
        if (authInitialized.current) return;

        const initializeAuth = async () => {
            try {
                setIsLoading(true);
                const userData = await fetchAuthData();
                
                // Check if we got a user back
                if (!userData) {
                    console.log('No user data returned from fetchAuthData');
                    // Check if user has seen onboarding before redirecting to login
                    const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
                    console.log('hasSeenOnboarding:', hasSeenOnboarding);
                    if (!hasSeenOnboarding) {
                        console.log('Redirecting to productivity onboarding');
                        setRedirectPath("/(onboarding)/productivity");
                    } else {
                        console.log('Redirecting to login');
                        setRedirectPath("/login");
                    }
                } else {
                    console.log('User authenticated, staying in app');
                    // Update user timezone on successful auth if it has changed
                    try {
                        const deviceTimezone = Localization.getCalendars()[0].timeZone || 'UTC';
                        
                        // Check if user has timezone field and if it differs from device timezone
                        // Cast user to any to access timezone field if it's not yet in the type definition
                        const userTimezone = (userData as any).timezone;
                        
                        if (deviceTimezone && userTimezone !== deviceTimezone) {
                            console.log(`Updating user timezone from ${userTimezone} to ${deviceTimezone}`);
                            await updateTimezone(deviceTimezone);
                        } else {
                            console.log('Timezone is up to date or invalid:', deviceTimezone);
                        }
                    } catch (tzError) {
                        console.error("Failed to update timezone:", tzError);
                        // Don't block auth flow for timezone update failure
                    }
                }
            } catch (error) {
                console.error("Authentication failed with error:", error);
                // If auth fails, clear everything and go to login
                setRedirectPath("/login");
            } finally {
                setIsLoading(false);
                authInitialized.current = true;
            }
        };

        initializeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;

        registerForPushNotificationsAsync().then((result) => {
            if (!result) return;
            
            setExpoPushToken(result.token);
            
            // Check against auth response token stored in context
            const userPushToken = (user as any)?.push_token;
            
            // Only send if token is different from what backend has
            if (result.token && userPushToken !== result.token) {
                sendPushTokenToBackend(result.token);
            }
        });
    }, [user]);

    useEffect(() => {
        notificationListener.current = addNotificationListener((notification) => {
            showToastable({
                message: notification.request.content.body || "New notification",
                title: notification.request.content.title || "Notification",
                status: "info",
                duration: 3000,
                render: (toast) => <DefaultToast toast={toast} />,
                onPress: () => {
                    const data = notification.request.content.data;
                    if (data?.url) {
                        router.push(data.url);
                    }
                }
            });
        });

        responseListener.current = addNotificationResponseListener((response) => {
            console.log(response);
            const data = response.notification.request.content.data;
            if (data?.url) {
                router.push(data.url);
            }
        });

        return () => {
            if (notificationListener.current) {
                try {
                    notificationListener.current.remove();
                } catch (error) {
                    console.warn("Failed to remove notification listener:", error);
                }
            }
            if (responseListener.current) {
                try {
                    responseListener.current.remove();
                } catch (error) {
                    console.warn("Failed to remove notification response listener:", error);
                }
            }
        };
    }, []);

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

    // If no user after loading, redirect based on onboarding status
    if (!user) {
        if (redirectPath) {
            return <Redirect href={redirectPath as any} />;
        }
        // Still determining redirect path
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

    return (
        <CreateModalProvider>
            <LayoutContent />
        </CreateModalProvider>
    );
};

// Separate component to use the CreateModal context
const LayoutContent = () => {
    const { visible, setVisible, modalConfig } = useCreateModal();
    
    return (
        <BlueprintCreationProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    header: (props) => <BackButton {...props} />,
                }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                {/* <Stack.Screen
                    name="profile/settings"
                    options={{
                        headerShown: true,
                        headerTitle: "Settings",
                        presentation: "modal",
                    }}
                /> */}
            </Stack>
            <CreateModal 
                visible={visible} 
                setVisible={setVisible}
                {...modalConfig}
            />
        </BlueprintCreationProvider>
    );
};

export default layout;
