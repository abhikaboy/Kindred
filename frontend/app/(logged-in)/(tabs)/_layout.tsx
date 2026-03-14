import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View, Animated } from "react-native";
import { usePathname } from "expo-router";

import { HapticTab } from "@/components/HapticTab";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useDrawer } from "@/contexts/drawerContext";
import { useNavigationState } from "@react-navigation/native";
import { useFocusMode } from "@/contexts/focusModeContext";
import { useTasks } from "@/contexts/tasksContext";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

// Import Phosphor icons
import {
    PencilSimple,
    PencilSimpleLine,
    Compass,
    CompassTool,
    MagnifyingGlass,
    User,
    Stack,
    StackSimple,
    Cards,
    SquaresFour,
    GridFour,
    Rows,
    TextColumns,
    Brain,
    House,
} from "phosphor-react-native";

// Narrow selector: only subscribe to the index, return -1 if state isn't ready yet
const useTabIndex = () => useNavigationState((state) => state?.index ?? -1);

// Custom tab button components
const TasksTabButton = (props: any) => {
    const currentIndex = useTabIndex();
    return <HapticTab {...props} isSelected={currentIndex === 0} />;
};

const FeedTabButton = (props: any) => {
    const { focusMode } = useFocusMode();
    const currentIndex = useTabIndex();
    if (focusMode) return null;
    return <HapticTab {...props} isSelected={currentIndex === 1} />;
};

const SearchTabButton = (props: any) => {
    const { focusMode } = useFocusMode();
    const currentIndex = useTabIndex();
    if (focusMode) return null;
    return <HapticTab {...props} isSelected={currentIndex === 2} />;
};

const ActivityTabButton = (props: any) => {
    const { focusMode } = useFocusMode();
    const currentIndex = useTabIndex();
    if (focusMode) return null;
    return <HapticTab {...props} isSelected={currentIndex === 3} />;
};

const ProfileTabButton = (props: any) => {
    const { focusMode } = useFocusMode();
    const currentIndex = useTabIndex();
    if (focusMode) return null;
    return <HapticTab {...props} isSelected={currentIndex === 4} />;
};

export const unstable_settings = {
    initialRouteName: "index",
};

export default function TabLayout() {
    let ThemedColor = useThemeColor();
    const pathname = usePathname();
    const router = useRouter();
    const { isDrawerOpen } = useDrawer();
    const { focusMode } = useFocusMode();
    const { startTodayTasks, dueTodayTasks, windowTasks, selected, setSelected } = useTasks();
    const currentIndex = useTabIndex();
    const insets = useSafeAreaInsets();

    const [modalVisible, setModalVisible] = useState(true);
    const toggleModal = () => {
        setModalVisible(!modalVisible);
    };

    // Calculate total tasks for today
    const todayTaskCount = useMemo(() => {
        return startTodayTasks.length + dueTodayTasks.length + windowTasks.length;
    }, [startTodayTasks, dueTodayTasks, windowTasks]);

    // Create animated value for tab bar visibility
    const tabBarOpacity = React.useRef(new Animated.Value(1)).current;
    const tabBarTranslateY = React.useRef(new Animated.Value(0)).current;

    // Define screens where you want to hide the tab bar
    const hideTabBarScreens = [
        // "/blueprint",
        "/blueprint/create",
        "/voice",
        "/review",
    ];

    // Define screens where you want to hide the FAB (but keep tab bar visible)
    const hideFABScreens = [
        "/daily",
        "/review",
        "/settings",
    ];

    const shouldHideTabBar =
        hideTabBarScreens.some((screen) => pathname.startsWith(screen)) || isDrawerOpen || focusMode;

    const shouldHideFAB =
        shouldHideTabBar || hideFABScreens.some((screen) => pathname.startsWith(screen));

    const isOnTaskTab = currentIndex === 0;
    const showHomeButton = isOnTaskTab && selected !== "" && !shouldHideFAB;

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
        <>
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
                    sceneStyle: {
                        backgroundColor: ThemedColor.background,
                    },
                    tabBarStyle: {
                        ...Platform.select({
                            ios: {
                                borderTopWidth: 1,
                                borderColor: ThemedColor.tertiary,
                                position: "absolute",
                                paddingTop: 12,
                                height: 90,
                                paddingBottom: 32,
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                width: "100%",
                                overflow: "hidden",
                            },
                            android: {
                                borderTopWidth: 1,
                                borderColor: ThemedColor.tertiary,
                                position: "absolute",
                                paddingTop: 12,
                                height: 90,
                                paddingBottom: 64,
                                borderRadius: 30,
                                width: "100%",
                                overflow: "hidden",
                                borderWidth: 1,
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
                        tabBarIcon: ({ color, focused }) =>
                            focused ? (
                                <PencilSimple size={24} color={color} weight="fill" />
                            ) : (
                                <PencilSimpleLine size={24} color={color} />
                            ),
                        tabBarBadge: todayTaskCount > 0 ? todayTaskCount : undefined,
                        tabBarButton: TasksTabButton,
                        tabBarAccessibilityLabel: "Tasks",
                    }}
                />
                <Tabs.Screen
                    name="(feed)"
                    options={{
                        title: "Feed",
                        tabBarIcon: ({ color, focused }) =>
                            focused ? (
                                <SquaresFour size={24} color={color} weight="fill" />
                            ) : (
                                <SquaresFour size={24} color={color} />
                            ),
                        tabBarButton: FeedTabButton,
                        tabBarAccessibilityLabel: "Feed",
                    }}
                />
                <Tabs.Screen
                    name="(search)"
                    options={{
                        title: "Search",
                        tabBarIcon: ({ color, focused }) =>
                            focused ? (
                                <MagnifyingGlass size={24} color={color} weight="bold" />
                            ) : (
                                <MagnifyingGlass size={24} color={color} />
                            ),
                        tabBarButton: SearchTabButton,
                        tabBarAccessibilityLabel: "Search",
                    }}
                />
                <Tabs.Screen
                    name="(activity)"
                    options={{
                        title: "Activity",
                        tabBarIcon: ({ color, focused }) =>
                            focused ? <Brain size={24} color={color} weight="fill" /> : <Brain size={24} color={color} />,
                        tabBarButton: ActivityTabButton,
                        tabBarAccessibilityLabel: "Activity",
                    }}
                />
                <Tabs.Screen
                    name="(profile)"
                    options={{
                        title: "Profile",
                        tabBarIcon: ({ color, focused }) =>
                            focused ? <User size={24} color={color} weight="fill" /> : <User size={24} color={color} />,
                        tabBarButton: ProfileTabButton,
                        tabBarAccessibilityLabel: "Profile",
                    }}
                />
            </Tabs>

            {/* Floating Home Button */}
            {showHomeButton && (
                <View style={[fabStyles.homeButton, { bottom: insets.bottom + TAB_BAR_HEIGHT, backgroundColor: ThemedColor.background, borderColor: ThemedColor.tertiary }]}>
                    <TouchableOpacity
                        style={fabStyles.homeButtonTouchable}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelected("");
                        }}
                        activeOpacity={0.6}
                    >
                        <House size={20} color={ThemedColor.text} weight="light" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Floating Action Button */}
            <FloatingActionButton visible={!shouldHideFAB} />
        </>
    );
}

const TAB_BAR_HEIGHT = 83;

const fabStyles = StyleSheet.create({
    homeButton: {
        position: "absolute",
        left: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 1000,
    },
    homeButtonTouchable: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 28,
    },
});
