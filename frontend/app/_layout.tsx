import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import React from "react";
import View, { Text } from "react-native";

import { useColorScheme } from "react-native";
import { AuthProvider } from "@/hooks/useAuth";
import { getThemedColor } from "@/constants/Colors";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TasksProvider } from "@/contexts/tasksContext";

import Back from "@/assets/images/back.svg";
import BackButton from "@/components/BackButton";
import { initTheme } from "@/constants/Colors";
import { color } from "bun";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Accelerometer } from "expo-sensors";

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
    useEffect(() => initTheme("light"), []);
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
            </GestureHandlerRootView>
        </ThemeProvider>
    );
}
