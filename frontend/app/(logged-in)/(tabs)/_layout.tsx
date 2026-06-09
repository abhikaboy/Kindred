import { Tabs, useRouter, useSegments } from "expo-router";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { usePathname } from "expo-router";

import { useThemeColor } from "@/hooks/useThemeColor";
import { useDrawer } from "@/contexts/drawerContext";
import { useNavigationState } from "@react-navigation/native";
import { useFocusMode } from "@/contexts/focusModeContext";
import { useTasks } from "@/contexts/tasksContext";
import { useFriendRequestCount } from "@/hooks/useFriendRequests";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import { LiquidGlassTabBar } from "@/components/ui/LiquidGlassTabBar";
import { ProfileTabIcon } from "@/components/ui/ProfileTabIcon";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents, TabNames } from "@/utils/analytics";
import { feedScrollVisibilityEvents } from "@/utils/feedScrollVisibilityEvents";

// Import Phosphor icons
import {
    PencilSimple,
    PencilSimpleLine,
    MagnifyingGlass,
    Newspaper,
    Brain,
} from "phosphor-react-native";

// Narrow selector: only subscribe to the index, return -1 if state isn't ready yet
const useTabIndex = () => useNavigationState((state) => state?.index ?? -1);

export const unstable_settings = {
    initialRouteName: "index",
};

export default function TabLayout() {
    const ThemedColor = useThemeColor();
    const pathname = usePathname();
    const segments = useSegments();
    const { isDrawerOpen } = useDrawer();
    const { focusMode } = useFocusMode();
    const { startTodayTasks, dueTodayTasks, windowTasks } = useTasks();
    const currentIndex = useTabIndex();
    const { capture } = useAnalytics();
    const isOnFeedTab = segments?.some((segment) => segment === "(feed)");
    const [scrollVisible, setScrollVisible] = useState(true);

    useEffect(() => {
        return feedScrollVisibilityEvents.subscribe(setScrollVisible);
    }, []);

    const prevTabIndex = useRef(currentIndex);

    useEffect(() => {
        if (currentIndex >= 0 && currentIndex !== prevTabIndex.current) {
            capture(AnalyticsEvents.TAB_SWITCHED, {
                from_tab: TabNames[prevTabIndex.current as keyof typeof TabNames] ?? "unknown",
                to_tab: TabNames[currentIndex as keyof typeof TabNames] ?? "unknown",
            });
            prevTabIndex.current = currentIndex;
        }
    }, [currentIndex]);

    // Calculate total tasks for today (shown as a badge on the Tasks tab)
    const todayTaskCount = useMemo(() => {
        return startTodayTasks.length + dueTodayTasks.length + windowTasks.length;
    }, [startTodayTasks, dueTodayTasks, windowTasks]);

    // Pending friend requests (red badge on the Search tab)
    const friendRequestCount = useFriendRequestCount();

    // Screens where the whole tab bar hides
    const hideTabBarScreens = ["/blueprint/create", "/voice", "/review"];
    // Screens where only the FAB hides (tab bar stays visible)
    const hideFABScreens = ["/daily", "/review", "/settings"];

    const shouldHideTabBar =
        hideTabBarScreens.some((screen) => pathname.startsWith(screen)) ||
        isDrawerOpen ||
        focusMode ||
        (isOnFeedTab && !scrollVisible);

    const shouldHideFAB =
        shouldHideTabBar || hideFABScreens.some((screen) => pathname.startsWith(screen));

    return (
        <>
            <Tabs
                tabBar={(props) => (
                    <LiquidGlassTabBar
                        {...props}
                        badges={{
                            "(task)": todayTaskCount > 0 ? todayTaskCount : undefined,
                            "(search)": friendRequestCount > 0 ? friendRequestCount : undefined,
                        }}
                        badgeColors={{ "(search)": ThemedColor.error }}
                        visible={!shouldHideTabBar}
                        switcherTabName="(task)"
                    />
                )}
                screenOptions={{
                    headerShown: false,
                    tabBarHideOnKeyboard: true,
                    animation: "fade",
                    sceneStyle: {
                        backgroundColor: ThemedColor.background,
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
                        tabBarAccessibilityLabel: "Tasks",
                    }}
                />
                <Tabs.Screen
                    name="(feed)"
                    options={{
                        title: "Feed",
                        tabBarIcon: ({ color, focused }) => (
                            <Newspaper size={24} color={color} weight={focused ? "fill" : "regular"} />
                        ),
                        tabBarAccessibilityLabel: "Feed",
                    }}
                />
                <Tabs.Screen
                    name="(search)"
                    options={{
                        title: "Search",
                        tabBarIcon: ({ color, focused }) => (
                            <MagnifyingGlass size={24} color={color} weight={focused ? "bold" : "regular"} />
                        ),
                        tabBarAccessibilityLabel: "Search",
                    }}
                />
                <Tabs.Screen
                    name="(activity)"
                    options={{
                        title: "Activity",
                        tabBarIcon: ({ color, focused }) => (
                            <Brain size={24} color={color} weight={focused ? "fill" : "regular"} />
                        ),
                        tabBarAccessibilityLabel: "Activity",
                    }}
                />
                <Tabs.Screen
                    name="(profile)"
                    options={{
                        title: "Profile",
                        tabBarIcon: ({ color, focused }) => <ProfileTabIcon focused={focused} color={color} />,
                        tabBarAccessibilityLabel: "Profile",
                    }}
                />
            </Tabs>

            {/* Floating Action Button */}
            <FloatingActionButton visible={!shouldHideFAB} />
        </>
    );
}
