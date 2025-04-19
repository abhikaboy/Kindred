import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import React from "react";

import { useColorScheme } from "react-native";
import { AuthProvider } from "@/hooks/useAuth";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TasksProvider } from "@/contexts/tasksContext";

import BackButton from "@/components/BackButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Accelerometer } from "expo-sensors";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    let colorScheme = useColorScheme();
    let ThemedColor = useThemeColor();
    const [loaded] = useFonts({
        Outfit: require("../assets/fonts/Outfit-Variable.ttf"),
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
                router.push("/AuditLog");
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
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <GestureHandlerRootView>
                <BottomSheetModalProvider>
                    <AuthProvider>
                        <TasksProvider>
                            <Stack
                                screenOptions={{
                                    headerShown: true,
                                    headerTransparent: true,
                                    headerBackTitle: "bbb",
                                    headerLeft: () => <BackButton />,
                                    headerTintColor: ThemedColor.text,
                                    headerBackButtonDisplayMode: "minimal",
                                    headerTitleStyle: {
                                        fontFamily: "Outfit",
                                        fontWeight: 100,
                                        fontSize: 1,
                                        color: ThemedColor.primary,
                                    },
                                }}>
                                <Stack.Screen
                                    name="(tabs)"
                                    options={{
                                        headerShown: false,
                                    }}
                                />
                                <Stack.Screen name="Dev1" />
                                <Stack.Screen options={{}} name="Dev2" />
                                <Stack.Screen options={{}} name="Activity" />
                                <Stack.Screen options={{}} name="AuditLog" />
                                <Stack.Screen options={{}} name="task/[id]" />
                                <Stack.Screen name="+not-found" />
                            </Stack>
                            <StatusBar style="light" />
                        </TasksProvider>
                    </AuthProvider>
                </BottomSheetModalProvider>
            </GestureHandlerRootView>
        </ThemeProvider>
    );
}
