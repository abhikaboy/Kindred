// redirect to login if not logged in

import BackButton from "@/components/BackButton";
import OfflineBanner from "@/components/OfflineBanner";
import { useAuth, getAuthData, getCachedUser, getHasEverSignedIn } from "@/hooks/useAuth";
import { enterAsNewGuest, TABS_ROUTE } from "@/utils/guestEntry";
import { Redirect, Slot, Stack, router, usePathname, type Href } from "expo-router";
import React, { useCallback, useEffect, useState, useRef } from "react";

import { ScrollView, View, AppState, InteractionManager, LogBox, StyleSheet } from "react-native";
import { noteTaskCompleted, refreshCompletedToday, syncStreakWidgets } from "@/widgets/syncWidgets";
import { taskCompletionEvents } from "@/utils/taskCompletionEvents";
import PostCompletionNudgeSheet from "@/components/modals/PostCompletionNudgeSheet";
import { recordAppOpen } from "@/utils/lastOpen";

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
import { ThemedView } from "@/components/ThemedView";
import { Screen, useCreateModal } from "@/contexts/createModalContext";
import CategoryComposer from "@/components/modals/create/composer/CategoryComposer";
import CreateComposer, { type Panel } from "@/components/modals/create/composer/CreateComposer";
import BuildPlanSheet from "@/components/plan/BuildPlanSheet";
import DefaultToast from "@/components/ui/DefaultToast";
import { handleSilentPush, isSilentPush } from "@/utils/silentPushHandlers";
import { AccountOverlay } from "@/components/guest/AccountOverlay";
import { useKudos } from "@/contexts/kudosContext";
import { updateTimezone } from "@/api/profile";
import * as Localization from 'expo-localization';
import EnhancedSplashScreen from "@/components/ui/EnhancedSplashScreen";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { endActivity, tryStartActiveTaskActivity, tryStartDeadlineActivity } from '@/utils/liveActivityManager';
import { useLiveActivityScheduler } from '@/hooks/useLiveActivityScheduler';
import { useBackgroundTaskSync, registerBackgroundFetch } from '@/tasks/backgroundTaskSync';
import { registerBackgroundRefresh } from '@/tasks/backgroundRefresh';
import { useTaskActions, useTasksSelector } from '@/contexts/tasksContext';
import { useQueryClient } from '@tanstack/react-query';
import { notificationRefreshEvents } from '@/utils/notificationRefreshEvents';
import { getNotificationRefreshPlan } from '@/utils/notificationInvalidation';
import { logger } from '@/utils/logger';
import { useResumePendingOAuth } from '@/hooks/useAssistantConnections';

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
    | "post_tag"
    | "rings_closed"
    | "task_tagged"
    | "task_copied"
    | "task_completed_watcher"
    | "TASK_MISSED"
    | "TASK_REGENERATED"
    | "ABSOLUTE"
    | "RELATIVE"
    | "FOLLOW_UP"
    | "live_activity"
    | "contact_joined"
    | "kudos_reaction"
    | "kudos_suggestion"
    | "checkin";

interface NotificationData {
    type?: NotificationType;
    url?: string;
    // Social
    accepter_id?: string;
    requester_id?: string;
    user_id?: string;
    // Task
    taskId?: string;
    task_id?: string;
    categoryId?: string;
    taskName?: string;
    // Post
    post_id?: string;
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
            // Task-scope encouragements deep-link to the task; profile-scope open notifications.
            if (data.task_id) {
                return `/(logged-in)/(tabs)/(task)/task/${data.task_id}`;
            }
            return "/(logged-in)/(tabs)/(feed)/feed?page=notifications";
        case "congratulation":
            // If the congratulation references a post, open it; otherwise open notifications.
            if (data.post_id) {
                return `/(logged-in)/posting/${data.post_id}`;
            }
            return "/(logged-in)/(tabs)/(feed)/feed?page=notifications";
        case "task_completion":
            if (data.task_id) {
                return `/(logged-in)/(tabs)/(task)/task/${data.task_id}`;
            }
            return "/(logged-in)/(tabs)/(feed)/feed?page=notifications";
        case "friend_request":
            return "/(logged-in)/(tabs)/(activity)";
        case "friend_request_accepted":
            if (data.accepter_id) {
                return `/(logged-in)/(tabs)/(feed,search,profile)/account/${data.accepter_id}`;
            }
            return "/(logged-in)/(tabs)/(activity)";
        case "new_post":
            if (data.post_id) {
                return `/(logged-in)/posting/${data.post_id}`;
            }
            return "/(logged-in)/(tabs)/(feed)/feed";
        case "comment":
            if (data.post_id) {
                return `/(logged-in)/posting/${data.post_id}`;
            }
            return "/(logged-in)/(tabs)/(feed)/feed";
        case "post_tag":
            if (data.post_id) {
                return `/(logged-in)/posting/${data.post_id}`;
            }
            return "/(logged-in)/(tabs)/(feed)/feed";
        case "contact_joined":
            // Open the profile of the person who joined so the obvious next
            // action is following them.
            if (data.user_id) {
                return `/(logged-in)/(tabs)/(feed,search,profile)/account/${data.user_id}`;
            }
            return "/(logged-in)/(tabs)/(feed)/feed?page=notifications";
        case "rings_closed":
            if (data.user_id) {
                return `/(logged-in)/(tabs)/(feed,search,profile)/account/${data.user_id}`;
            }
            return "/(logged-in)/(tabs)/(profile)/profile";
        case "task_tagged":
            // Response banner lives on the home screen
            return "/(logged-in)/(tabs)/(task)";
        case "task_copied":
            if (data.task_id) {
                return `/(logged-in)/(tabs)/(task)/task/${data.task_id}`;
            }
            return "/(logged-in)/(tabs)/(task)";
        case "task_completed_watcher":
            if (data.user_id) {
                return `/(logged-in)/(tabs)/(feed,search,profile)/account/${data.user_id}`;
            }
            return "/(logged-in)/(tabs)/(task)";
        case "TASK_MISSED":
        case "TASK_REGENERATED":
        case "ABSOLUTE":
        case "RELATIVE":
        case "FOLLOW_UP":
            if (data.taskId) {
                return `/(logged-in)/(tabs)/(task)/task/${data.taskId}`;
            }
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
    const { user, setUser, fetchAuthData, startGuestSession } = useAuth();
    const { fetchKudosData } = useKudos();
    const { fetchWorkspaces } = useTaskActions();
    const queryClient = useQueryClient();
    const lastCacheRefresh = useRef<Record<string, number>>({});
    const { identify, capture } = useAnalytics();
    const [isLoading, setIsLoading] = useState(true);
    const [redirectPath, setRedirectPath] = useState<Href | null>(null);
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);
    const authInitialized = useRef(false);
    const [splashDone, setSplashDone] = useState(false);
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
                // Warm start: render from the cached profile right away and verify
                // the token in the background; a rejection below still redirects.
                const [tokens, cached] = await Promise.all([getAuthData(), getCachedUser()]);
                if (tokens && cached) {
                    setUser(cached);
                    setIsLoading(false);
                }
                const result = await fetchAuthData();

                if (result.status === "unauthenticated") {
                    if (!(await getHasEverSignedIn())) {
                        // Never signed in on this device: continue as a fresh guest
                        // (no intro video). Hold the splash while it is created.
                        setIsLoading(true);
                        const guestRoute = await enterAsNewGuest(startGuestSession);
                        // Guest already done with the tutorial: just render the app.
                        if (guestRoute !== TABS_ROUTE) setRedirectPath(guestRoute);
                        return;
                    }
                    // First open ever: intro video precedes login. (Old pre-login
                    // onboarding cluster removed — after intro, straight to login.)
                    const hasSeenIntro = await AsyncStorage.getItem('hasSeenIntroVideo');
                    setRedirectPath(hasSeenIntro ? "/login" : "/intro");
                } else if (result.status === "unverified-offline" && !result.user) {
                    // We hold tokens but couldn't verify them and have no cached
                    // profile to render, so there is nothing to show. Still don't
                    // treat it as a logout — the tokens survive and the next
                    // launch with a connection will resolve it.
                    console.warn("Offline with no cached profile; staying on the loading state");
                } else if (result.status === "unverified-offline") {
                    // Offline with a cached profile: render the app from cache
                    // rather than bouncing the user to /login. Skip the network
                    // side-effects (PostHog identify, timezone sync) — they'd
                    // just fail — and let them run on the next successful verify.
                    console.warn("Running from cached session while offline");
                } else {
                    const userData = result.user;

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
                            updateTimezone(deviceTimezone).catch((tzError) => {
                                console.error("Failed to update timezone:", tzError);
                            });
                        }
                    } catch (tzError) {
                        console.error("Failed to update timezone:", tzError);
                        // Don't block auth flow for timezone update failure
                    }
                }
            } catch (error) {
                // fetchAuthData already distinguishes offline from rejected and
                // never throws for connectivity, so reaching here means something
                // genuinely unexpected went wrong.
                console.error("Authentication failed with error:", error);
                setRedirectPath("/login");
            } finally {
                setIsLoading(false);
                authInitialized.current = true;
            }
        };

        initializeAuth();
    }, []);

    // Every completion path (detail page, swipe, review, calendar) funnels here
    useEffect(() => {
        return taskCompletionEvents.subscribe(({ taskId, newStreak }) => {
            endActivity(taskId).catch(() => {});
            noteTaskCompleted(taskId, newStreak);
        });
    }, []);

    // Update streak widget on app foreground.
    // Initial update deferred via InteractionManager to avoid Hermes GC pressure during startup.
    useEffect(() => {
        if (!user?._id) return;

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                recordAppOpen().catch(() => {});
                syncStreakWidgets(user._id, user.streak || 0).catch(() => {});
                refreshCompletedToday().catch(() => {});
            }
        });

        recordAppOpen().catch(() => {});
        const handle = InteractionManager.runAfterInteractions(() => {
            syncStreakWidgets(user._id, user.streak || 0).catch(() => {});
            refreshCompletedToday().catch(() => {});
        });

        return () => {
            subscription.remove();
            handle.cancel();
        };
    }, [user?._id]);

    useEffect(() => {
        if (!user) return;

        // Prompt for push a few seconds after the user lands in-app (never during
        // onboarding) so it doesn't interrupt the first-touch home tour.
        const t = setTimeout(() => {
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
        }, 4000);
        return () => clearTimeout(t);
    }, [user]);

    useEffect(() => {
        registerBackgroundFetch();
        void registerBackgroundRefresh();
        initNotificationHandler();

        // A push means server state changed — refresh what that notification type
        // could have touched so it shows without an app restart. Unknown types
        // refresh everything. Throttled per type.
        const refreshCachesFor = (data: NotificationData | undefined) => {
            const type = data?.type ?? "unknown";
            const now = Date.now();
            if (now - (lastCacheRefresh.current[type] ?? 0) < 2000) return;
            lastCacheRefresh.current[type] = now;

            const plan = getNotificationRefreshPlan(data?.type);
            if (plan.all) {
                queryClient.invalidateQueries();
                fetchKudosData();
                fetchWorkspaces(true);
                notificationRefreshEvents.emit();
                return;
            }
            if (plan.queryRoots.length > 0) {
                queryClient.invalidateQueries({
                    predicate: (query) => plan.queryRoots.includes(String(query.queryKey[0])),
                });
            }
            if (plan.kudos) {
                fetchKudosData();
                notificationRefreshEvents.emit();
            }
            if (plan.workspaces) fetchWorkspaces(true);
        };

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
            });
        };

        notificationListener.current = addNotificationListener((notification) => {
            const data = notification.request.content.data as NotificationData | undefined;

            refreshCachesFor(data);

            // Handle live activity triggers from push notifications
            if (data?.type === 'live_activity') {
                if (data.liveActivityType === 'activeTask') {
                    startActiveTaskActivityFromPush(data);
                } else if (data.liveActivityType === 'deadlineCountdown') {
                    startDeadlineActivityFromPush(data);
                }
                return; // Don't show toast for live activity pushes
            }

            // Data-only pushes report finished background work; they have nothing to display
            if (isSilentPush(notification.request.content)) {
                handleSilentPush(data as any);
                return;
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

            // Tapped pushes can arrive with the app backgrounded, where the
            // received-listener never fired — refresh here too.
            refreshCachesFor(data);

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
            } else {
                // No route for this notification type — log it so we catch new backend types that
                // weren't wired up on the frontend. The user already saw the system notification banner,
                // so this is mostly an engineering signal.
                logger.warn("Push notification has no matching route", { type: data?.type, data });
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

    const handleAnimationComplete = useCallback(() => {
        setSplashDone(true);
    }, []);

    // A guest's redirect (to the tutorial) is one-shot. Left set, it fires again
    // on the next re-render of this layout, e.g. any route change, which bounced
    // guests from Home back to the start of the tutorial once they finished it.
    const guestRedirectPending = !isLoading && !!redirectPath && !!user?.isGuest;
    useEffect(() => {
        if (guestRedirectPending) setRedirectPath(null);
    }, [guestRedirectPending]);

    // If no user after loading, redirect based on onboarding status. A just-created
    // guest has a user but still needs to leave for the tutorial.
    if (!isLoading && redirectPath && (!user || user.isGuest)) {
        return <Redirect href={redirectPath} />;
    }

    const showContent = !isLoading && !!user;

    // No user and nowhere to go (offline without a cached profile, or mid-logout): hold the splash
    if (!isLoading && !user && splashDone) {
        return <EnhancedSplashScreen ready={false} />;
    }

    // CreateModalProvider is hoisted to app/_layout.tsx so the FAB in the tabs
    // layout keeps a valid context across auth-driven route transitions, when
    // this layout briefly renders a Redirect instead of its children.
    // The splash overlays the content and fades out once auth resolves, so the
    // tabs mount underneath during the fade.
    return (
        <View style={{ flex: 1 }}>
            {showContent && <LayoutContent />}
            {!splashDone && (
                <View style={StyleSheet.absoluteFill} pointerEvents={showContent ? "none" : "auto"}>
                    <EnhancedSplashScreen ready={showContent} onAnimationComplete={handleAnimationComplete} />
                </View>
            )}
        </View>
    );
};

// Old sheet screens that open straight onto a composer panel
const SCREEN_PANEL: Partial<Record<Screen, Panel>> = {
    [Screen.DEADLINE]: "due",
    [Screen.STARTDATE]: "start",
    [Screen.RECURRING]: "repeat",
    [Screen.REMINDER]: "reminder",
    [Screen.COLLABORATORS]: "tag",
    [Screen.INTEGRATION]: "integration",
};

// Separate component to use the CreateModal context
const LayoutContent = () => {
    const { visible, setVisible, modalConfig } = useCreateModal();
    const ThemedColor = useThemeColor();
    // Don't pay for the composers until it's first opened; keep it mounted afterwards
    const [createModalMounted, setCreateModalMounted] = useState(visible);
    if (visible && !createModalMounted) setCreateModalMounted(true);
    // New categories get their own composer; everything else goes to the task composer
    const composerRoute = modalConfig.screen !== Screen.NEW_CATEGORY;
    const composerPanel = modalConfig.screen !== undefined ? SCREEN_PANEL[modalConfig.screen] : undefined;

    // Auto-start live activities when task times arrive (foreground)
    useLiveActivityScheduler();

    // Reopen an assistant consent request that was waiting on login
    useResumePendingOAuth();

    // Sync task times to AsyncStorage for background fetch
    const allTasks = useTasksSelector((s) => s.allTasks);
    useBackgroundTaskSync(allTasks);

    return (
        <View style={{ flex: 1 }}>
                <OfflineBanner />
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
                {createModalMounted && (
                    <CategoryComposer visible={visible && !composerRoute} setVisible={setVisible} />
                )}
                {createModalMounted && (
                    <CreateComposer
                        visible={visible && composerRoute}
                        setVisible={setVisible}
                        categoryId={modalConfig.categoryId}
                        edit={modalConfig.edit}
                        editTask={modalConfig.task}
                        isBlueprint={modalConfig.isBlueprint}
                        initialPanel={composerPanel}
                    />
                )}
                <BuildPlanSheet />
                <PostCompletionNudgeSheet />
                {/* Guest account prompt: above the tabs and the composer */}
                <AccountOverlay />
        </View>
    );
};

export default layout;
