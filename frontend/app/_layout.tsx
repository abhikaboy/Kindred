import React, { useEffect, useState } from "react";
import { Dimensions, useColorScheme, View } from "react-native";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Slot, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Accelerometer } from "expo-sensors";

// Import components and contexts after the core modules
import { AuthProvider } from "@/hooks/useAuth";
import { OnboardingProvider } from "@/hooks/useOnboarding";
import { TasksProvider } from "@/contexts/tasksContext";
import { TaskCreationProvider } from "@/contexts/taskCreationContext";
import BackButton from "@/components/BackButton";
import { useThemeColor } from "@/hooks/useThemeColor";
// Import router after the components to avoid potential circular dependencies
import { router } from "expo-router";
import { BlueprintCreationProvider } from "@/contexts/blueprintContext";
import { DrawerProvider } from "@/contexts/drawerContext";
import { FocusModeProvider } from "@/contexts/focusModeContext";
import { SpotlightProvider } from "@/contexts/SpotlightContext";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import Toastable from "react-native-toastable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "moti";
import * as Sentry from "@sentry/react-native";
import { KudosProvider } from "@/contexts/kudosContext";

Sentry.init({
    dsn: "https://79c57b37386aecbee3cd34cd54469b8f@o4509699450470400.ingest.us.sentry.io/4509699452502016",

    // Adds more context data to events (IP address, cookies, user, etc.)
    // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: true,

    // Configure Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [
        Sentry.mobileReplayIntegration(),
        Sentry.feedbackIntegration({
            // Additional SDK configuration goes in here, for example:
            styles: {
                submitButton: {
                    backgroundColor: "#6a1b9a",
                },
            },
            namePlaceholder: "Fullname",
        }),
    ],

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default Sentry.wrap(function RootLayout() {
    const colorScheme = useColorScheme();
    const ThemedColor = useThemeColor();
    const [loaded] = useFonts({
        Outfit: require("../assets/fonts/Outfit-Variable.ttf"),
        OutfitLight: require("../assets/fonts/Outfit-Light.ttf"),
        Fraunces: require("../assets/fonts/Fraunces-Variable.ttf"),
        FrauncesItalic: require("../assets/fonts/Fraunces-Italic.ttf"),
        SofiaSans: require("../assets/fonts/SofiaSans-Variable.ttf"),
    });
    const [shakeDetected, setShakeDetected] = useState(false);
    const [subscription, setSubscription] = useState(null);
    const safeAsync = useSafeAsync();

    Accelerometer.setUpdateInterval(500); // Adjust update interval as needed

    // useEffect(() => {
    //     const subscription = Accelerometer.addListener((data) => {
    //         const totalForce = Math.abs(data.x) + Math.abs(data.y) + Math.abs(data.z);

    //         if (totalForce > 3) {
    //             // Adjust the threshold as needed
    //             setShakeDetected(true);
    //             // router.push("/AuditLog");
    //             setTimeout(() => {
    //                 setShakeDetected(false);
    //             }, 500); // Reset after a short period
    //         }
    //     });

    //     setSubscription(subscription);

    //     return () => {
    //         subscription.remove();
    //     };
    // }, []);

    useEffect(() => {
        const hideSplash = async () => {
            if (loaded) {
                const { error } = await safeAsync(async () => {
                    await SplashScreen.hideAsync();
                });

                if (error) {
                    console.error("Error hiding splash screen:", error);
                }
            }
        };

        hideSplash();
    }, [loaded]);

    const { top } = useSafeAreaInsets();
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                refetchOnMount: false,
                refetchOnReconnect: false,
                retry: false,
                staleTime: 1000 * 60 * 5, // 5 minutes
            },
        },
    });

    if (!loaded) {
        return null;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <AnimatePresence>
                <AuthProvider>
                    <OnboardingProvider>
                        <SpotlightProvider>
                            <FocusModeProvider>
                                <KudosProvider>
                                    <TasksProvider>
                                        <TaskCreationProvider>
                                            <BlueprintCreationProvider>
                                                <DrawerProvider>
                                                    <GestureHandlerRootView style={{ flex: 1 }}>
                                                        <BottomSheetModalProvider>
                                                            <Toastable
                                                                statusMap={{
                                                                    success: ThemedColor.success,
                                                                    danger: ThemedColor.error,
                                                                    warning: ThemedColor.warning,
                                                                    info: ThemedColor.primary,
                                                                }}
                                                                offset={top}
                                                            />
                                                            <Slot />
                                                            <StatusBar style="light" />
                                                        </BottomSheetModalProvider>
                                                    </GestureHandlerRootView>
                                                </DrawerProvider>
                                            </BlueprintCreationProvider>
                                        </TaskCreationProvider>
                                    </TasksProvider>
                                </KudosProvider>
                            </FocusModeProvider>
                        </SpotlightProvider>
                    </OnboardingProvider>
                </AuthProvider>
            </AnimatePresence>
        </QueryClientProvider>
    );
});
