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
import { TasksProvider } from "@/contexts/tasksContext";
import { TaskCreationProvider } from "@/contexts/taskCreationContext";
import BackButton from "@/components/BackButton";
import { useThemeColor } from "@/hooks/useThemeColor";
// Import router after the components to avoid potential circular dependencies
import { router } from "expo-router";
import { BlueprintCreationProvider } from "@/contexts/blueprintContext";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import Toastable from "react-native-toastable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "moti";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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

    useEffect(() => {
        const subscription = Accelerometer.addListener((data) => {
            const totalForce = Math.abs(data.x) + Math.abs(data.y) + Math.abs(data.z);

            if (totalForce > 3) {
                // Adjust the threshold as needed
                setShakeDetected(true);
                // router.push("/AuditLog");
                setTimeout(() => {
                    setShakeDetected(false);
                }, 500); // Reset after a short period
            }
        });

        setSubscription(subscription);

        return () => {
            subscription.remove();
        };
    }, []);

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
                    <TasksProvider>
                        <TaskCreationProvider>
                            <BlueprintCreationProvider>
                                <GestureHandlerRootView style={{ flex: 1 }}>
                                    <BottomSheetModalProvider>
                                        <Toastable
                                            statusMap={{
                                                success: ThemedColor.success,
                                                danger: ThemedColor.danger,
                                                warning: ThemedColor.warning,
                                                info: ThemedColor.primary,
                                            }}
                                            offset={top}
                                        />
                                        <Slot />
                                        <StatusBar style="light" />
                                    </BottomSheetModalProvider>
                                </GestureHandlerRootView>
                            </BlueprintCreationProvider>
                        </TaskCreationProvider>
                    </TasksProvider>
                </AuthProvider>
            </AnimatePresence>
        </QueryClientProvider>
    );
}
