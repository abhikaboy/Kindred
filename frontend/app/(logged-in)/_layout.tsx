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
                }
            } catch (error) {
                console.error("Authentication failed with error:", error);
                
                // Check if user has seen onboarding before redirecting to login
                const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
                console.log('Auth error, hasSeenOnboarding:', hasSeenOnboarding);
                if (!hasSeenOnboarding) {
                    setRedirectPath("/(onboarding)/productivity");
                } else {
                    setRedirectPath("/login");
                }
            } finally {
                setIsLoading(false);
                authInitialized.current = true;
            }
        };

        initializeAuth();
    }, []); // Empty dependency array is correct here

    // Push notification setup - only run when user is authenticated
    useEffect(() => {
        if (!user) return;

        const setupNotifications = async () => {
            try {
                const result = await registerForPushNotificationsAsync();
                if (result) {
                    setExpoPushToken(result.token);
                    console.log("📱 Push token obtained:", result.token);

                    // Send token to backend
                    const success = await sendPushTokenToBackend(result.token);
                    if (!success) {
                        console.warn("⚠️ Push token was not registered with backend, but continuing...");
                        // Don't show error to user - this is not critical for app functionality
                    }
                }
            } catch (error) {
                console.error("❌ Error setting up push notifications:", error);
                // Only show error if it's a critical failure (not just backend registration)
                if (error instanceof Error && !error.message.includes("push token")) {
                    showToastable({
                        message: "Error setting up push notifications",
                        status: "danger",
                        position: "top",
                        offset: 100,
                        duration: 3000,
                        swipeDirection: "up",
                        renderContent: (props) => <DefaultToast {...props} />,
                    });
                }
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
            
            // Handle routing based on notification type
            if (data?.type) {
                switch (data.type) {
                    case 'friend_request':
                        // Route to the requester's profile if we have their ID, otherwise friends page
                        if (data.requester_id) {
                            router.push(`/account/${data.requester_id}` as any);
                        } else {
                            router.push('/(logged-in)/(tabs)/(profile)/friends' as any);
                        }
                        break;
                    
                    case 'friend_request_accepted':
                        // Route to the accepter's profile if we have their ID, otherwise friends page
                        if (data.accepter_id) {
                            router.push(`/account/${data.accepter_id}` as any);
                        } else {
                            router.push('/(logged-in)/(tabs)/(profile)/friends' as any);
                        }
                        break;
                    
                    case 'encouragement':
                        // Route to encouragements page
                        router.push('/(logged-in)/encouragement' as any);
                        break;
                    
                    case 'congratulation':
                        // Route to congratulations page
                        router.push('/(logged-in)/congratulations' as any);
                        break;
                    
                    case 'task_completion':
                        // Route to the user's profile if we have their ID
                        if (data.task_owner_id) {
                            router.push(`/account/${data.task_owner_id}` as any);
                        } else {
                            // Fallback to notifications page
                            router.push('/(logged-in)/(tabs)/(feed)/Notifications' as any);
                        }
                        break;
                    
                    default:
                        // Fallback: check for explicit screen path
                        if (data.screen) {
                            router.push(data.screen as any);
                        } else {
                            // Default to notifications page
                            router.push('/(logged-in)/(tabs)/(feed)/Notifications' as any);
                        }
                        break;
                }
            } else if (data?.screen) {
                // Legacy handling: if screen is provided directly
                router.push(data.screen as any);
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
