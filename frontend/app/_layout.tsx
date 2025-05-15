import React, { useEffect, useState } from "react";
import { useColorScheme, View } from "react-native";
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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const ThemedColor = useThemeColor();
    const [loaded] = useFonts({
        Outfit: require("../assets/fonts/Outfit-Variable.ttf"),
        OutfitLight: require("../assets/fonts/Outfit-Light.ttf"),
        Fraunces: require("../assets/fonts/Fraunces-Variable.ttf"),
        SofiaSans: require("../assets/fonts/SofiaSans-Variable.ttf"),
    });
    const [shakeDetected, setShakeDetected] = useState(false);
    const [subscription, setSubscription] = useState(null);

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
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    if (!loaded) {
        return null;
    }

    return (
        <AuthProvider>
            <TasksProvider>
                <TaskCreationProvider>
                    <BlueprintCreationProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                            <BottomSheetModalProvider>
                                {/* In Expo Router v2 and SDK 53, we use Slot instead of NavigationContainer */}
                                <Stack
                                    screenOptions={{
                                        headerShown: true,
                                        headerTransparent: true,
                                        headerLeft: (tab) => <BackButton />,
                                        headerTintColor: ThemedColor.text,
                                        headerBackButtonDisplayMode: "minimal",
                                        headerTitleStyle: {
                                            fontFamily: "Outfit",
                                            fontWeight: 100,
                                            fontSize: 1,
                                            color: ThemedColor.primary,
                                        },
                                    }}
                                />
                                <StatusBar style="light" />
                            </BottomSheetModalProvider>
                        </GestureHandlerRootView>
                    </BlueprintCreationProvider>
                </TaskCreationProvider>
            </TasksProvider>
        </AuthProvider>
    );
}
