// redirect to login if not logged in

import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { Redirect, Slot, Stack, router, usePathname } from "expo-router";
import React, { useCallback, useEffect, useState, useRef } from "react";

import { ScrollView, View, ActivityIndicator, Animated, AppState, InteractionManager, LogBox } from "react-native";
import { updateStreakWidget } from "@/widgets/updateStreakWidget";

LogBox.ignoreLogs(['addListener', 'native JS logger']);
import { type ErrorBoundaryProps } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import * as Notifications from "expo-notifications";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    initNotificationHandler,
    registerForPushNotificationsAsync,
    addNotificationListener,
    addNotificationResponseListener,
    sendPushTokenToBackend,
} from "@/utils/notificationService";
import { showToastable, ToastableMessageStatus } from "react-native-toastable";
import { BlueprintCreationProvider } from "@/contexts/blueprintContext";
import { ThemedView } from "@/components/ThemedView";
import { CreateModalProvider, useCreateModal } from "@/contexts/createModalContext";
import CreateModal from "@/components/modals/CreateModal";
import DefaultToast from "@/components/ui/DefaultToast";
import { useKudos } from "@/contexts/kudosContext";
import { updateTimezone } from "@/api/profile";
import * as Localization from 'expo-localization';
import EnhancedSplashScreen from "@/components/ui/EnhancedSplashScreen";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { tryStartActiveTaskActivity, tryStartDeadlineActivity } from '@/utils/liveActivityManager';
import { useLiveActivityScheduler } from '@/hooks/useLiveActivityScheduler';
import { useBackgroundTaskSync, registerBackgroundFetch } from '@/tasks/backgroundTaskSync';
import { useTasks } from '@/contexts/tasksContext';

export const unstable_settings = {
    initialRouteName: "index",
};

/** Known push notification types sent by the backend. */
type NotificationType =
    | "encouragement"
    | "congratulation"
    | "task_completion"
    | "friend_request"
    | "friend_request_accepted"
    | "new_post"
    | "comment"
    | "rings_closed"
    | "TASK_MISSED"
    | "TASK_REGENERATED"
    | "ABSOLUTE"
    | "RELATIVE"
    | "FOLLOW_UP"
    | "live_activity";

interface NotificationData {
    type?: NotificationType;
    url?: string;
    // Social
    accepter_id?: string;
    user_id?: string;
    // Task
    taskId?: string;
    categoryId?: string;
    taskName?: string;
    // Live Activity
    liveActivityType?: 'activeTask' | 'deadlineCountdown';
    workspaceName?: string;
    startTime?: string;
    endTime?: string;
    deadline?: string;
    priority?: string;
}

/** Derive a navigation URL from push notification data. */
function getNotificationRoute(data: NotificationData | undefined): string | null {
    if (!data) return null;
    // Explicit url always wins
    if (data.url) return data.url;

    switch (data.type) {
        case "encouragement":
            return "/(logged-in)/(tabs)/(task)/kudos?tab=encouragements";
        case "congratulation":
            return "/(logged-in)/(tabs)/(task)/kudos?tab=congratulations";
        case "task_completion":
            return "/(logged-in)/(tabs)/(task)/kudos?tab=congratulations";
        case "friend_request":
            return "/(logged-in)/(tabs)/(activity)";
        case "friend_request_accepted":
            if (data.accepter_id) {
                return `/(logged-in)/(tabs)/(feed,search,profile)/account/${data.accepter_id}`;
            }
            return "/(logged-in)/(tabs)/(activity)";
        case "new_post":
            return "/(logged-in)/(tabs)/(feed)/feed";
        case "comment":
            return "/(logged-in)/(tabs)/(feed)/feed";
        case "rings_closed":
            if (data.user_id) {
                return `/(logged-in)/(tabs)/(feed,search,profile)/account/${data.user_id}`;
            }
            return "/(logged-in)/(tabs)/(profile)/profile";
        case "TASK_MISSED":
        case "TASK_REGENERATED":
        case "ABSOLUTE":
        case "RELATIVE":
        case "FOLLOW_UP":
            return "/(logged-in)/(tabs)/(task)";
        default:
            return null;
    }
}

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
    const { fetchKudosData } = useKudos();
    const { identify, capture } = useAnalytics();
    const [isLoading, setIsLoading] = useState(true);
    const [redirectPath, setRedirectPath] = useState<string | null>(null);
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);
    const authInitialized = useRef(false);
    const [canTransition, setCanTransition] = useState(false);
    const ThemedColor = useThemeColor();
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

    // Handle initial authentication and routing - only run once
    useEffect(() => {
        if (authInitialized.current) return;

        const initializeAuth = async () => {
            try {
                setIsLoading(true);
                const userData = await fetchAuthData();

                // Check if we got a user back
                if (!userData) {
                    // Check if user has seen onboarding before redirecting to login
                    const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
                    if (!hasSeenOnboarding) {
                        setRedirectPath("/(onboarding)/productivity");
                    } else {
                        setRedirectPath("/login");
                    }
                } else {

                    // Identify user in PostHog
                    identify(userData._id, {
                        display_name: userData.display_name,
                        handle: (userData as any).handle,
                        timezone: (userData as any).timezone,
                        streak: userData.streak ?? 0,
                        created_at: (userData as any).created_at,
                    });

                    // Update user timezone on successful auth if it has changed
                    try {
                        const deviceTimezone = Localization.getCalendars()[0].timeZone || 'UTC';

                        // Check if user has timezone field and if it differs from device timezone
                        // Cast user to any to access timezone field if it's not yet in the type definition
                        const userTimezone = (userData as any).timezone;

                        if (deviceTimezone && userTimezone !== deviceTimezone) {
                            await updateTimezone(deviceTimezone);
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

    // Update streak widget on app foreground.
    // Initial update deferred via InteractionManager to avoid Hermes GC pressure during startup.
    useEffect(() => {
        if (!user?._id) return;

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                updateStreakWidget(user._id, user.streak || 0, 0).catch(() => {});
            }
        });

        const handle = InteractionManager.runAfterInteractions(() => {
            updateStreakWidget(user._id, user.streak || 0, 0).catch(() => {});
        });

        return () => {
            subscription.remove();
            handle.cancel();
        };
    }, [user?._id]);

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
        registerBackgroundFetch();
        initNotificationHandler();

        const startActiveTaskActivityFromPush = (data: NotificationData) => {
            tryStartActiveTaskActivity(data.taskId || '', {
                taskName: data.taskName || '',
                workspaceName: data.workspaceName || 'Tasks',
                startTime: data.startTime || new Date().toISOString(),
                endTime: data.endTime || undefined,
                hasEndTime: !!data.endTime,
                categoryId: data.categoryId || '',
                taskId: data.taskId || '',
            });
        };

        const startDeadlineActivityFromPush = (data: NotificationData) => {
            tryStartDeadlineActivity(data.taskId || '', {
                taskName: data.taskName || '',
                workspaceName: data.workspaceName || 'Tasks',
                deadline: data.deadline || '',
                priority: parseInt(data.priority || '0', 10),
                categoryId: data.categoryId || '',
                taskId: data.taskId || '',
                accentColor: '#8B5CF6',
                statusLabel: 'Due Soon',
            });
        };

        notificationListener.current = addNotificationListener((notification) => {
            const data = notification.request.content.data as NotificationData | undefined;

            // Handle live activity triggers from push notifications
            if (data?.type === 'live_activity') {
                if (data.liveActivityType === 'activeTask') {
                    startActiveTaskActivityFromPush(data);
                } else if (data.liveActivityType === 'deadlineCountdown') {
                    startDeadlineActivityFromPush(data);
                }
                return; // Don't show toast for live activity pushes
            }

            if (data?.type === 'encouragement' || data?.type === 'congratulation') {
                fetchKudosData();
            }
            showToastable({
                message: notification.request.content.body || "New notification",
                title: notification.request.content.title || "Notification",
                status: "neutral" as any,
                duration: 3000,
                renderContent: (props) => <DefaultToast {...props} />,
                onPress: () => {
                    // Don't navigate during onboarding — user can get stuck
                    if (pathnameRef.current?.includes("onboarding")) return;
                    const route = getNotificationRoute(data);
                    if (route) {
                        router.navigate(route);
                    }
                }
            });
        });

        responseListener.current = addNotificationResponseListener((response) => {
            const data = response.notification.request.content.data as NotificationData | undefined;

            // Start live activity when user taps the notification
            if (data?.type === 'live_activity') {
                if (data.liveActivityType === 'activeTask') {
                    startActiveTaskActivityFromPush(data);
                } else if (data.liveActivityType === 'deadlineCountdown') {
                    startDeadlineActivityFromPush(data);
                }
                // Navigate to the task
                if (data.categoryId && data.taskId) {
                    router.push(`/(logged-in)/(tabs)/(task)/task/${data.taskId}?categoryId=${data.categoryId}&name=${encodeURIComponent(data.taskName || '')}`);
                }
                return;
            }

            // Don't navigate during onboarding — user can get stuck
            if (pathnameRef.current?.includes("onboarding")) return;
            const route = getNotificationRoute(data);
            if (route) {
                router.navigate(route);
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

    // Auto-start live activities when task times arrive (foreground)
    useLiveActivityScheduler();

    // Sync task times to AsyncStorage for background fetch
    const { allTasks } = useTasks();
    useBackgroundTaskSync(allTasks);

    const handleAnimationComplete = () => {
        setCanTransition(true);
    };

    // Show splash while loading or waiting for animation
    if (isLoading || !canTransition) {
        return <EnhancedSplashScreen onAnimationComplete={handleAnimationComplete} />;
    }

    // If no user after loading, redirect based on onboarding status
    if (!user) {
        if (redirectPath) {
            return <Redirect href={redirectPath as any} />;
        }
        // Still determining redirect path (shouldn't happen, but fallback)
        return <EnhancedSplashScreen onAnimationComplete={handleAnimationComplete} />;
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
    const ThemedColor = useThemeColor();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <BlueprintCreationProvider>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        header: (props) => <BackButton {...props} />,
                        contentStyle: {
                            backgroundColor: ThemedColor.background,
                        },
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
                {visible && (
                    <CreateModal
                        key={`modal-${visible}-${modalConfig.categoryId || 'default'}`}
                        visible={true}
                        setVisible={setVisible}
                        {...modalConfig}
                    />
                )}
            </BlueprintCreationProvider>
        </Animated.View>
    );
};

export default layout;
