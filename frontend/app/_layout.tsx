import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import React from "react";
import View from "react-native";

import { useColorScheme } from "react-native";
import { AuthProvider } from "@/hooks/useAuth";
import { Colors } from "@/constants/Colors";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [loaded] = useFonts({
        Outfit: require("../assets/fonts/Outfit-Variable.ttf"),
        SofiaSans: require("../assets/fonts/SofiaSans-Variable.ttf"),
    });

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
                    <Stack
                        screenOptions={{
                            headerShown: true,
                            headerTransparent: true,
                            headerBackTitle: "Back",
                            headerTintColor: Colors.dark.text,
                            headerBackButtonDisplayMode: "minimal",
                            headerTitleStyle: {
                                fontFamily: "Outfit",
                                fontWeight: 100,
                                fontSize: 1,
                                color: Colors.dark.background,
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
                        <Stack.Screen name="+not-found" />
                    </Stack>
                    <StatusBar style="light" />
                </AuthProvider>
            </GestureHandlerRootView>
        </ThemeProvider>
    );
}
