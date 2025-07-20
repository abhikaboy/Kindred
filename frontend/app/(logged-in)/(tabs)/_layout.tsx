import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Dimensions, Platform, TouchableOpacity, View, Animated } from "react-native";
import { usePathname } from "expo-router";

import { HapticTab } from "@/components/HapticTab";
import Octicons from "@expo/vector-icons/Octicons";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useDrawer } from "@/contexts/drawerContext";
import { useNavigationState } from "@react-navigation/native";

// Custom tab button components
const TasksTabButton = (props: any) => {
    const navigationState = useNavigationState((state) => state);
    const currentIndex = navigationState?.index || 0;
    const isSelected = currentIndex === 0; // Tasks is the first tab
    return <HapticTab {...props} isSelected={isSelected} />;
};

const FeedTabButton = (props: any) => {
    const navigationState = useNavigationState((state) => state);
    const currentIndex = navigationState?.index || 0;
    const isSelected = currentIndex === 1; // Feed is the second tab
    return <HapticTab {...props} isSelected={isSelected} />;
};

const SearchTabButton = (props: any) => {
    const navigationState = useNavigationState((state) => state);
    const currentIndex = navigationState?.index || 0;
    const isSelected = currentIndex === 2; // Search is the third tab
    return <HapticTab {...props} isSelected={isSelected} />;
};

const ProfileTabButton = (props: any) => {
    const navigationState = useNavigationState((state) => state);
    const currentIndex = navigationState?.index || 0;
    const isSelected = currentIndex === 3; // Profile is the fourth tab
    return <HapticTab {...props} isSelected={isSelected} />;
};

export const unstable_settings = {
    initialRouteName: "index",
};

export default function TabLayout() {
    let ThemedColor = useThemeColor();
    const pathname = usePathname();
    const { isDrawerOpen } = useDrawer();

    const [modalVisible, setModalVisible] = useState(true);
    const toggleModal = () => {
        setModalVisible(!modalVisible);
    };

    // Create animated value for tab bar visibility
    const tabBarOpacity = React.useRef(new Animated.Value(1)).current;
    const tabBarTranslateY = React.useRef(new Animated.Value(0)).current;

    // Define screens where you want to hide the tab bar
    const hideTabBarScreens = [
        "/blueprint",
        "/blueprint/create",
        // Add other screen paths where you want to hide tabs
    ];

    const shouldHideTabBar = hideTabBarScreens.some((screen) => pathname.startsWith(screen)) || isDrawerOpen;

    // Animate tab bar visibility
    useEffect(() => {
        const animationDuration = 300; // 300ms for smooth animation

        if (shouldHideTabBar) {
            // Animate out
            Animated.parallel([
                Animated.timing(tabBarOpacity, {
                    toValue: 0,
                    duration: animationDuration,
                    useNativeDriver: true,
                }),
                Animated.timing(tabBarTranslateY, {
                    toValue: 100, // Move down to hide
                    duration: animationDuration,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Animate in
            Animated.parallel([
                Animated.timing(tabBarOpacity, {
                    toValue: 1,
                    duration: animationDuration,
                    useNativeDriver: true,
                }),
                Animated.timing(tabBarTranslateY, {
                    toValue: 0, // Move back to original position
                    duration: animationDuration,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [shouldHideTabBar, tabBarOpacity, tabBarTranslateY]);

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: "#854DFF", // Purple color for selected state
                tabBarInactiveTintColor: ThemedColor.text, // Default text color for inactive state
                tabBarShowLabel: false, // Hide default labels
                headerShown: false,
                tabBarHideOnKeyboard: true,
                headerTitleStyle: {
                    fontFamily: "Outfit",
                },
                tabBarBackground: TabBarBackground,
                animation: "fade",
                tabBarVariant: "uikit",
                tabBarPosition: "bottom",
                tabBarItemStyle: {
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "flex-start", // Keep this for top alignment
                },
                tabBarStyle: {
                    ...Platform.select({
                        ios: {
                            borderTopWidth: 1,
                            borderColor: ThemedColor.tertiary,
                            position: "absolute",
                            paddingTop: 16,
                            height: 96,
                            paddingBottom: 64,
                            borderRadius: 30,
                            width: "100%",
                            overflow: "hidden",
                            borderWidth: 1,
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
                    opacity: tabBarOpacity,
                    transform: [{ translateY: tabBarTranslateY }],
                },
            }}>
            <Tabs.Screen
                name="(task)"
                options={{
                    title: "Tasks",
                    tabBarIcon: ({ color }) => <Entypo name="pencil" size={24} color={color} />,
                    tabBarBadge: 1,
                    tabBarButton: TasksTabButton,
                    tabBarAccessibilityLabel: "Tasks",
                }}
            />
            <Tabs.Screen
                name="(feed)"
                options={{
                    title: "Feed",
                    tabBarIcon: ({ color }) => <Entypo name="home" size={24} color={color} />,
                    tabBarButton: FeedTabButton,
                    tabBarAccessibilityLabel: "Feed",
                }}
            />
            <Tabs.Screen
                name="(search)"
                options={{
                    title: "Search",
                    tabBarIcon: ({ color }) => <Octicons name="search" size={24} color={color} />,
                    tabBarButton: SearchTabButton,
                    tabBarAccessibilityLabel: "Search",
                }}
            />
            <Tabs.Screen
                name="(profile)"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color }) => <Octicons name="person" size={24} color={color} />,
                    tabBarButton: ProfileTabButton,
                    tabBarAccessibilityLabel: "Profile",
                }}
            />
        </Tabs>
    );
}
