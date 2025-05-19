import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Dimensions, Platform, TouchableOpacity } from "react-native";

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

    const [modalVisible, setModalVisible] = useState(true);
    const toggleModal = () => {
        setModalVisible(!modalVisible);
    };

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: ThemedColor.text,
                headerShown: false,
                tabBarHideOnKeyboard: true,
                headerTitleStyle: {
                    fontFamily: "Outfit",
                },
                tabBarActiveBackgroundColor: ThemedColor.lightened,
                tabBarButton: HapticTab,
                tabBarItemStyle: {},
                tabBarBackground: TabBarBackground,
                tabBarStyle: Platform.select({
                    ios: {
                        position: "absolute",
                        height: 83,
                        borderTopWidth: 1,
                        borderColor: ThemedColor.background,
                    },
                    default: {
                        height: 83,
                        borderTopWidth: 1,
                    },
                }),
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: "Tasks",
                    tabBarIcon: ({ color }) => <Entypo name="pencil" size={24} color={color} />,
                    href: "/",
                    tabBarBadge: 4,
                }}
            />
            <Tabs.Screen
                name="feed"
                options={{
                    title: "Feed",
                    tabBarIcon: ({ color }) => <Entypo name="home" size={24} color={color} />,
                    href: "/feed",
                }}
            />
            <Tabs.Screen
                name="playground"
                options={{
                    title: "Playground",
                    tabBarIcon: ({ color }) => <Entypo name="home" size={24} color={color} />,
                    href: "/playground",
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: "Search",
                    tabBarIcon: ({ color }) => <Octicons name="search" size={24} color={color} />,
                    href: "/search",
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color }) => <Octicons name="person" size={24} color={color} />,
                    href: "/profile",
                }}
            />
        </Tabs>
    );
}
