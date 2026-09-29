import React, { useEffect, useState } from "react";
import { AppState, Dimensions, Platform, useColorScheme, View } from "react-native";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Slot, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalProvider } from "@gorhom/portal";

// Import components and contexts after the core modules
import { AuthProvider } from "@/hooks/useAuth";
import { getNetStatus, isOffline, subscribeNetStatus } from "@/utils/netStatus";
import { OnboardingProvider } from "@/hooks/useOnboarding";
import { TasksProvider } from "@/contexts/tasksContext";
import { SelectedCategoryProvider } from "@/contexts/selectedCategoryContext";
import { TaskCreationProvider } from "@/contexts/taskCreationContext";
import BackButton from "@/components/BackButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { applyStoredThemePreference } from "@/hooks/useThemePreference";
import { BlueprintCreationProvider } from "@/contexts/blueprintContext";
// Import router after the components to avoid potential circular dependencies
import { router } from "expo-router";
import { DrawerProvider } from "@/contexts/drawerContext";
import { FocusModeProvider } from "@/contexts/focusModeContext";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import Toastable from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, persistOptions } from "@/utils/queryClient";
// Defines the background refresh task at module scope, before any headless run needs it
import "@/tasks/backgroundRefresh";
import { AnimatePresence } from "moti";
import * as Sentry from "@sentry/react-native";
import { KudosProvider } from "@/contexts/kudosContext";
import { SelectedGroupProvider } from "@/contexts/SelectedGroupContext";
import { AlertProvider } from "@/contexts/AlertContext";
import { useCacheCleanup } from "@/hooks/useCacheCleanup";
import { logger } from "@/utils/logger";
import { resetFirstLaunch } from "@/utils/resetFirstLaunch";
import { AnalyticsProvider } from "@/hooks/useAnalytics";
import { CreateModalProvider } from "@/contexts/createModalContext";
import { RingUpdateProvider } from "@/contexts/ringUpdateContext";
import { RingUpdateOverlay } from "@/components/ui/RingUpdateOverlay";
import { KudosSentProvider } from "@/contexts/kudosSentContext";
import { KudosSentOverlay } from "@/components/ui/KudosSentOverlay";

try {
    const previousHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: any, isFatal: any) => {
        logger.error(`[GlobalError] isFatal=${isFatal}`, error);
        previousHandler?.(error, isFatal);
    });
} catch (e) {
    // ErrorUtils may not be available during early bundle eval
}

try {
    Sentry.init({
        dsn: "https://79c57b37386aecbee3cd34cd54469b8f@o4509699450470400.ingest.us.sentry.io/4509699452502016",
        sendDefaultPii: true,
        integrations: [
            Sentry.feedbackIntegration({
                styles: {
                    submitButton: {
                        backgroundColor: "#6a1b9a",
                    },
                },
                namePlaceholder: "Fullname",
            }),
        ],
    });
} catch (e) {
    console.error("[Kindred] Sentry.init failed:", e);
}

try {
    SplashScreen.preventAutoHideAsync();
} catch (e) {
    console.error("[Kindred] SplashScreen.preventAutoHideAsync failed:", e);
}

// Restore theme preference while the splash screen is still up
applyStoredThemePreference();

// React Query's built-in reconnect detection doesn't work on React Native, so
// `refetchOnReconnect` would never fire. Drive it from our connectivity store
// instead — this is what makes the app repopulate itself when the user comes
// back into signal.
onlineManager.setEventListener((setOnline) => {
    setOnline(!isOffline(getNetStatus()));
    return subscribeNetStatus((status) => setOnline(!isOffline(status)));
});


// Dev only: "Reset to first launch" in the Expo dev menu (shake / Cmd+D), so the
// guest flow can be re-run without reinstalling. Not available in Expo Go.
if (__DEV__) {
    try {
        const { registerDevMenuItems } = require("expo-dev-menu");
        registerDevMenuItems([
            { name: "Reset to first launch", callback: () => void resetFirstLaunch({ queryClient }), shouldCollapse: true },
        ]).catch(() => {});
    } catch {
        // expo-dev-menu isn't linked in this build
    }
}

export default Sentry.wrap(function RootLayout() {
    const colorScheme = useColorScheme();
    const ThemedColor = useThemeColor();
    const [loaded] = useFonts({
        Outfit: require("../assets/fonts/Outfit-Variable.ttf"),
        OutfitLight: require("../assets/fonts/Outfit-Light.ttf"),
        Fraunces: require("../assets/fonts/Fraunces-Variable.ttf"),
    });
    const safeAsync = useSafeAsync();

    // Automatically clean up old cache entries to prevent unbounded growth
    useCacheCleanup({
        maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        patterns: ['cache_', 'workspaces_cache_', 'temp_'],
        enableLogging: __DEV__, // Only log in development
    });


    // Wire react-query's focusManager to AppState so refetchOnWindowFocus
    // actually fires when the app returns to the foreground.
    useEffect(() => {
        const sub = AppState.addEventListener("change", (status) => {
            if (Platform.OS !== "web") {
                focusManager.setFocused(status === "active");
            }
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        const hideSplash = async () => {
            if (loaded) {
                const { error } = await safeAsync(async () => {
                    await SplashScreen.hideAsync();
                });

                if (error) {
                    logger.error("Error hiding splash screen", error);
                }
            }
        };

        hideSplash();
    }, [loaded]);

    const { top } = useSafeAreaInsets();

    if (!loaded) {
        return null;
    }

    return (
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <RingUpdateProvider>
            <KudosSentProvider>
            <AnalyticsProvider>
            <AnimatePresence>
                <AuthProvider>
                    <CreateModalProvider>
                    <OnboardingProvider>
                        <FocusModeProvider>
                            <KudosProvider>
                                <TasksProvider>
                                  <SelectedCategoryProvider>
                                    <TaskCreationProvider>
                                            <SelectedGroupProvider>
                                                <DrawerProvider>
                                                    <GestureHandlerRootView style={{ flex: 1 }}>
                                                        {/* Must sit above PortalProvider/BottomSheetModalProvider:
                                                            gorhom sheets portal their content to those hosts, so
                                                            any provider below them is invisible to sheet content */}
                                                        <BlueprintCreationProvider>
                                                        <PortalProvider>
                                                            <BottomSheetModalProvider>
                                                                <AlertProvider>
                                                                    <Toastable
                                                                        statusMap={{
                                                                            success: ThemedColor.success,
                                                                            danger: ThemedColor.error,
                                                                            warning: ThemedColor.warning,
                                                                            info: ThemedColor.primary,
                                                                        }}
                                                                        offset={top}
                                                                        renderContent={(props) => <DefaultToast {...props} />}
                                                                    />
                                                                    <Slot />
                                                                    <RingUpdateOverlay />
                                                                    <KudosSentOverlay />
                                                                    <StatusBar style="light" />
                                                                </AlertProvider>
                                                            </BottomSheetModalProvider>
                                                        </PortalProvider>
                                                        </BlueprintCreationProvider>
                                                    </GestureHandlerRootView>
                                                </DrawerProvider>
                                            </SelectedGroupProvider>
                                    </TaskCreationProvider>
                                  </SelectedCategoryProvider>
                                </TasksProvider>
                            </KudosProvider>
                        </FocusModeProvider>
                    </OnboardingProvider>
                    </CreateModalProvider>
                </AuthProvider>
            </AnimatePresence>
            </AnalyticsProvider>
            </KudosSentProvider>
            </RingUpdateProvider>
        </PersistQueryClientProvider>
    );
});
