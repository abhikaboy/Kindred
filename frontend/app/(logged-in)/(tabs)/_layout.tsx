import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Dimensions, Platform, TouchableOpacity, View } from "react-native";

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
                tabBarActiveBackgroundColor: ThemedColor.lightened + "a0",
                tabBarButton: HapticTab,
                tabBarBackground: TabBarBackground,
                tabBarStyle: Platform.select({
                    ios: {
                        borderTopWidth: 1,
                        borderColor: ThemedColor.tertiary,
                        position: "absolute",
                        marginBottom: 32,
                        marginHorizontal: "5%",
                        paddingBottom: 0,
                        height: 80,
                        paddingTop: 10,
                        borderRadius: 500,
                        width: "90%",
                        overflow: "hidden",
                        alignItems: "center",
                        borderWidth: 1,
                    },
                    android: {
                        height: 80,
                        paddingTop: 0,
                        borderRadius: 500,
                        width: "90%",
                        overflow: "hidden",
                    },
                    default: {
                        height: 80,
                        paddingTop: 0,
                        borderRadius: 500,
                        width: "90%",
                        overflow: "hidden",
                    },
                }),
            }}>
            <Tabs.Screen
                name="(task)"
                options={{
                    title: "Tasks",
                    tabBarIcon: ({ color }) => <Entypo name="pencil" size={24} color={color} />,
                    href: "/",
                    tabBarBadge: 1,
                }}
            />
            <Tabs.Screen
                name="(feed)"
                options={{
                    title: "Feed",
                    tabBarIcon: ({ color }) => <Entypo name="home" size={24} color={color} />,
                    href: "/feed",
                }}
            />
            <Tabs.Screen
                name="(search)"
                options={{
                    title: "Search",
                    tabBarIcon: ({ color }) => <Octicons name="search" size={24} color={color} />,
                    href: "/search",
                }}
            />
            <Tabs.Screen
                name="(profile)"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color }) => <Octicons name="person" size={24} color={color} />,
                    href: "/profile",
                }}
            />
        </Tabs>
    );
}
