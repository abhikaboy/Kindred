import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Dimensions, Platform, TouchableOpacity, View } from "react-native";
import { usePathname } from "expo-router";

import { HapticTab } from "@/components/HapticTab";
import Octicons from "@expo/vector-icons/Octicons";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";

export const unstable_settings = {
    initialRouteName: "index",
};

export default function TabLayout() {
    let ThemedColor = useThemeColor();
    const pathname = usePathname();

    const [modalVisible, setModalVisible] = useState(true);
    const toggleModal = () => {
        setModalVisible(!modalVisible);
    };

    // Define screens where you want to hide the tab bar
    const hideTabBarScreens = [
        "/blueprint",
        "/blueprint/create",
        // Add other screen paths where you want to hide tabs
    ];

    const shouldHideTabBar = hideTabBarScreens.some((screen) => pathname.startsWith(screen));

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: ThemedColor.text,
                headerShown: false,
                tabBarHideOnKeyboard: true,
                headerTitleStyle: {
                    fontFamily: "Outfit",
                },
                tabBarActiveBackgroundColor: ThemedColor.tertiary + "80",
                tabBarBackground: TabBarBackground,
                animation: "fade",
                tabBarVariant: "uikit",
                tabBarPosition: "bottom",
                tabBarItemStyle: {
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                },
                tabBarStyle: shouldHideTabBar
                    ? { display: "none" }
                    : Platform.select({
                          ios: {
                              borderTopWidth: 1,
                              borderColor: ThemedColor.tertiary,
                              position: "absolute",
                              marginBottom: 32,
                              marginHorizontal: "3%",
                              paddingBottom: 0,
                              borderRadius: 30,
                              width: "94%",
                              overflow: "hidden",
                              borderWidth: 1,
                              alignItems: "center",
                              boxShadow: ThemedColor.shadowSmall,
                          },
                          android: {
                              height: 80,
                              paddingTop: 0,
                              borderRadius: 500,
                              width: "90%",
                              overflow: "hidden",
                              alignItems: "center",
                              boxShadow: ThemedColor.shadowSmall,
                          },
                      }),
                cardStyle: {
                    backgroundColor: ThemedColor.background, // Use theme background
                },
            }}>
            <Tabs.Screen
                name="(task)"
                options={{
                    title: "Tasks",
                    tabBarIcon: ({ color }) => <Entypo name="pencil" size={24} color={color} />,
                    tabBarBadge: 1,
                    tabBarButton: HapticTab,
                }}
            />
            <Tabs.Screen
                name="(feed)"
                options={{
                    title: "Feed",
                    tabBarIcon: ({ color }) => <Entypo name="home" size={24} color={color} />,
                    tabBarButton: HapticTab,
                }}
            />
            <Tabs.Screen
                name="(search)"
                options={{
                    title: "Search",
                    tabBarIcon: ({ color }) => <Octicons name="search" size={24} color={color} />,
                    tabBarButton: HapticTab,
                }}
            />
            <Tabs.Screen
                name="(profile)"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color }) => <Octicons name="person" size={24} color={color} />,
                    tabBarButton: HapticTab,
                }}
            />
        </Tabs>
    );
}
