import { Tabs } from "expo-router";
import React, { useState } from "react";
import { Dimensions, Platform, TouchableOpacity } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import Octicons from "@expo/vector-icons/Octicons";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useAuth } from "@/hooks/useAuth";

export default function TabLayout() {
    const { user } = useAuth();
    const [modalVisible, setModalVisible] = useState(true);
    const toggleModal = () => {
        setModalVisible(!modalVisible);
    };
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
                headerShown: false,
                headerTitleStyle: {
                    fontFamily: "Outfit",
                },
                tabBarButton: HapticTab,
                tabBarBackground: TabBarBackground,
                tabBarStyle: Platform.select({
                    ios: {
                        position: "absolute",
                    },
                    default: {},
                }),
            }}>
            <Tabs.Screen
                name="playground"
                options={{
                    title: "Playground",
                    tabBarIcon: ({ color }) => <Entypo name="home" size={24} color="gray" />,
                    href: "playground",
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color }) => <Octicons name="person" size={24} color="gray" />,
                    href: "profile",
                }}
            />
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color }) => <Entypo name="home" size={24} color="gray" />,
                    href: "home",
                }}
            />
        </Tabs>
    );
}
