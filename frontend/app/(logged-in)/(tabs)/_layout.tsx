import { Tabs, useRouter, useSegments } from "expo-router";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { usePathname } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useThemeColor } from "@/hooks/useThemeColor";
import { useDrawer } from "@/contexts/drawerContext";
import { useNavigationState } from "@react-navigation/native";
import { useFocusMode } from "@/contexts/focusModeContext";
import { useOnboardingV2Context } from "@/contexts/OnboardingV2Context";
import { isOnboardingV2Active } from "@/utils/onboardingV2/active";
import { useTaskActions, useTasksSelector } from "@/contexts/tasksContext";
import { useFriendRequestCount } from "@/hooks/useFriendRequests";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import ActiveTaskMiniBar from "@/components/dashboard/ActiveTaskMiniBar";
import { LiquidGlassTabBar } from "@/components/ui/LiquidGlassTabBar";
import { ProfileTabIcon } from "@/components/ui/ProfileTabIcon";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents, TabNames } from "@/utils/analytics";
import { feedScrollVisibilityEvents } from "@/utils/feedScrollVisibilityEvents";
import { homeTourVisibilityEvents, homePageVisibilityEvents, homePagerActiveEvents, scheduleSelectionEvents } from "@/utils/homeTourVisibilityEvents";

// Import Phosphor icons
import {
    PencilSimple,
    PencilSimpleLine,
    // MagnifyingGlass,
    Newspaper,
    Brain,
} from "phosphor-react-native";

// LiquidGlassTabBar emits tabPress with canPreventDefault, but the Tabs listener
// type doesn't carry that, so preventDefault isn't on the declared event.

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
    const { step: onboardingStep, isLoading: onboardingLoading } = useOnboardingV2Context();
    const { setSelected } = useTaskActions();
    // Narrow subscriptions: a swipe between workspaces shouldn't re-render the tab layout
    const isSelectedToday = useTasksSelector((s) => s.selected === "Today");
    const todayTaskCount = useTasksSelector(
        (s) => s.startTodayTasks.length + s.dueTodayTasks.length + s.windowTasks.length
    );
    const currentIndex = useTabIndex();
    const { capture } = useAnalytics();
    const isOnFeedTab = segments?.some((segment) => segment === "(feed)");
    const isOnTaskTab = segments?.some((segment) => segment === "(task)");
    const [scrollVisible, setScrollVisible] = useState(true);
    const [homeTourActive, setHomeTourActive] = useState(false);

    useEffect(() => {
        return feedScrollVisibilityEvents.subscribe(setScrollVisible);
    }, []);

    useEffect(() => {
        return homeTourVisibilityEvents.subscribe(setHomeTourActive);
    }, []);

    const [onHomePager, setOnHomePager] = useState(false);
    useEffect(() => homePagerActiveEvents.subscribe(setOnHomePager), []);
    const [homePageVisible, setHomePageVisible] = useState(false);
    useEffect(() => homePageVisibilityEvents.subscribe(setHomePageVisible), []);
    const [scheduling, setScheduling] = useState(false);
    useEffect(() => scheduleSelectionEvents.subscribe(setScheduling), []);

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

    // Pending friend requests: red dot on the Profile tab, where the requests list lives
    const friendRequestCount = useFriendRequestCount();

    // Screens where the whole tab bar hides
    const hideTabBarScreens = ["/blueprint/create", "/voice"];
    // Screens where only the FAB hides (tab bar stays visible)
    const hideFABScreens = ["/daily", "/settings"];
    // Reached the calendar/list page by swiping the home pager (not a route change,
    // so pathname stays put) — hide the tab bar but keep the FAB + home button up.
    const isSwipedToToday = isOnTaskTab && isSelectedToday;

    const baseHideTabBar =
        hideTabBarScreens.some((screen) => pathname.startsWith(screen)) ||
        isDrawerOpen ||
        homeTourActive ||
        isOnboardingV2Active(onboardingStep, onboardingLoading) ||
        (isOnFeedTab && !scrollVisible);

    // Focus mode hides the tab bar on the Home page only. Every other page keeps it so there is
    // always a way back Home. The FAB and home button stay put either way, same as isSwipedToToday.
    const focusHidesTabBar = focusMode && isOnTaskTab && onHomePager && pathname === "/";
    const shouldHideTabBar = baseHideTabBar || isSwipedToToday || focusHidesTabBar;

    const shouldHideFAB =
        baseHideTabBar ||
        hideFABScreens.some((screen) => pathname.startsWith(screen)) ||
        (isOnTaskTab && homePageVisible && pathname === "/") ||
        (isOnTaskTab && scheduling);

    const badges = useMemo(
        () => ({
            "(task)": todayTaskCount > 0 ? todayTaskCount : undefined,
            // "(search)": friendRequestCount > 0 ? friendRequestCount : undefined,
        }),
        [todayTaskCount]
    );
    const dots = useMemo(() => ({ "(profile)": friendRequestCount > 0 }), [friendRequestCount]);
    const renderTabBar = useCallback(
        (props: BottomTabBarProps) => (
            <LiquidGlassTabBar
                {...props}
                badges={badges}
                dots={dots}
                visible={!shouldHideTabBar}
                switcherTabName="(task)"
            />
        ),
        [badges, dots, shouldHideTabBar]
    );
    const screenOptions = useMemo(
        () => ({
            headerShown: false,
            tabBarHideOnKeyboard: true,
            animation: "fade" as const,
            sceneStyle: {
                backgroundColor: ThemedColor.background,
            },
        }),
        [ThemedColor.background]
    );

    return (
        <>
            <>
                <Tabs
                    tabBar={renderTabBar}
                    screenOptions={screenOptions}>
                    <Tabs.Screen
                        name="(task)"
                        // Re-tapping the Tasks tab while already on it drops back to home.
                        listeners={({ navigation }) => ({
                            tabPress: () => {
                                if (navigation.isFocused()) setSelected("");
                            },
                        })}
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
                            // hidden for now: friends search moved to the home Friends page. Keep href: null,
                            // since expo-router lists any route without it as a tab.
                            href: null,
                            // title: "Search",
                            // tabBarIcon: ({ color, focused }) => (
                            //     <MagnifyingGlass size={24} color={color} weight={focused ? "bold" : "regular"} />
                            // ),
                            // tabBarAccessibilityLabel: "Search",
                        }}
                    />
                    <Tabs.Screen
                        name="(activity)"
                        options={{
                            // hidden for now: route stays registered, just off the tab bar
                            href: null,
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

                {!baseHideTabBar && !pathname.startsWith("/task/") && <ActiveTaskMiniBar tabBarHidden={shouldHideTabBar} />}

                {/* Floating Action Button */}
                <FloatingActionButton visible={!shouldHideFAB} />
            </>
        </>
    );
}
