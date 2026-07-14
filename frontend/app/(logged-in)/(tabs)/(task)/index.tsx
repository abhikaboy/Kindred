import { StyleSheet, View, TouchableOpacity, Animated } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/contexts/tasksContext";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import CreateWorkspaceBottomSheetModal from "@/components/modals/CreateWorkspaceBottomSheetModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import ConditionalView from "@/components/ui/ConditionalView";
import { DRAWER_WIDTH, HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { TodayContent } from "@/components/task/TodayContent";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";
import { getEncouragementsAPI } from "@/api/encouragement";
import { getCongratulationsAPI } from "@/api/congratulation";
import { notificationRefreshEvents } from "@/utils/notificationRefreshEvents";
import WorkspaceSelectionBottomSheet from "@/components/modals/WorkspaceSelectionBottomSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusMode } from "@/contexts/focusModeContext";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { useFirstTouchHint } from "@/hooks/useFirstTouchHint";
import HintBubble from "@/components/ui/HintBubble";
import { HomeScrollContent } from "@/components/dashboard/HomescrollContent";
import { HomeTourOverlay } from "@/components/dashboard/HomeTourOverlay";
import { useHomeTour } from "@/hooks/useHomeTour";
import { homeTourVisibilityEvents } from "@/utils/homeTourVisibilityEvents";
import { ThemedText } from "@/components/ThemedText";
import { AnimatedView } from "@/components/ui/AnimatedView";
import { WorkspaceContent } from "@/components/task/WorkspaceContent";
import { PagerDots } from "@/components/task/PagerDots";
import PagerView from "react-native-pager-view";
import Confetti from "@/components/ui/Confetti";
import Daily from "./daily";
import WorkspaceGlow from "@/components/task/WorkspaceGlow";
import AnimatedTabs, { AnimatedTabContent } from "@/components/inputs/AnimatedTabs";
import FriendsContent from "@/components/dashboard/FriendsContent";
import { List } from "phosphor-react-native";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { useKudos } from "@/contexts/kudosContext";

type Props = {};

const Home = (props: Props) => {
    const { user, refresh } = useAuth();
    let ThemedColor = useThemeColor();

    const {
        fetchWorkspaces,
        selected,
        workspaces,
        setSelected,
        dueTodayTasks,
        fetchingWorkspaces,
        getRecentWorkspaces,
    } = useTasks();

    const [creatingWorkspace, setCreatingWorkspace] = useState(false);
    const [encouragementCount, setEncouragementCount] = useState(0);
    const [congratulationCount, setCongratulationCount] = useState(0);
    const [showWorkspaceSelection, setShowWorkspaceSelection] = useState(false);
    const { focusMode, toggleFocusMode } = useFocusMode();
    const [refreshing, setRefreshing] = useState(false);
    const queryClient = useQueryClient();
    const { capture } = useAnalytics();
    const { fetchKudosData } = useKudos();

    const insets = useSafeAreaInsets();
    const safeAsync = useSafeAsync();
    const { setIsDrawerOpen } = useDrawer();

    // Cache keys and duration
    const KUDOS_CACHE_KEY = `kudos_cache_${user?._id || 'default'}`;
    const CACHE_DURATION = 1 * 60 * 1000; // 1 minute

    // Get recent workspaces and create a display list
    const recentWorkspaceNames = getRecentWorkspaces();

    // Create a display list: recent workspaces first, then other workspaces up to 6 total
    const displayWorkspaces = React.useMemo(() => {
        if (!workspaces || workspaces.length === 0) return [];

        const recentWorkspaces = recentWorkspaceNames
            .map((name) => workspaces.find((ws) => ws.name === name))
            .filter(Boolean);

        const otherWorkspaces = workspaces.filter((ws) => !recentWorkspaceNames.includes(ws.name));
        const combined = [...recentWorkspaces, ...otherWorkspaces];
        return combined.slice(0, 6);
    }, [workspaces, recentWorkspaceNames]);

    // Check if user has completed quick setup
    useEffect(() => {
        const checkQuickSetup = async () => {
            if (!user?._id) return;

            try {
                const key = `${user._id}-quicksetup`;
                const hasCompletedSetup = await AsyncStorage.getItem(key);

                if (!hasCompletedSetup && selected === "") {
                    setShowWorkspaceSelection(true);
                } else if (selected !== "") {
                    setShowWorkspaceSelection(false);
                }
            } catch (error) {
                console.error("Error checking quick setup status:", error);
            }
        };

        checkQuickSetup();
    }, [user?._id, selected]);

    useEffect(() => {
        if (!user || !workspaces) return;
        if (user._id === "") return;
        const loadWorkspaces = async () => {
            const { error } = await safeAsync(async () => {
                await fetchWorkspaces();
            });

            if (error) {
                console.error("Error fetching workspaces:", error);
            }
        };
        console.log("loading workspaces");
        loadWorkspaces();
        // Keyed to the id, not the object — user identity churns on every auth
        // refresh and was re-fetching workspaces (and re-rendering home) while idle
    }, [user?._id]);

    // Fetch encouragement and congratulation counts with caching
    const fetchKudosCounts = React.useCallback(async (forceRefresh: boolean = false) => {
        if (!user?._id) return;

        // Check cache first if not forcing refresh
        if (!forceRefresh) {
            try {
                const cached = await AsyncStorage.getItem(KUDOS_CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    const now = Date.now();

                    // Use cache if it's less than 5 minutes old
                    if ((now - timestamp) < CACHE_DURATION) {
                        console.log("Using cached kudos (age: " + Math.floor((now - timestamp) / 1000) + "s)");
                        setEncouragementCount(data.encouragementCount);
                        setCongratulationCount(data.congratulationCount);
                        return;
                    }
                }
            } catch (error) {
                console.error("Error reading kudos cache:", error);
            }
        }

        // Fetch fresh data
        try {
            console.log("Fetching kudos via API");
            const [encouragements, congratulations] = await Promise.all([
                getEncouragementsAPI(),
                getCongratulationsAPI(),
            ]);

            const unreadEncouragements = encouragements.filter((item) => !item.read).length;
            const unreadCongratulations = congratulations.filter((item) => !item.read).length;

            setEncouragementCount(unreadEncouragements);
            setCongratulationCount(unreadCongratulations);

            // Save to cache
            try {
                await AsyncStorage.setItem(KUDOS_CACHE_KEY, JSON.stringify({
                    data: {
                        encouragementCount: unreadEncouragements,
                        congratulationCount: unreadCongratulations,
                    },
                    timestamp: Date.now()
                }));
                console.log("Kudos cached successfully");
            } catch (error) {
                console.error("Error caching kudos:", error);
            }
        } catch (error) {
            console.error("Error fetching encouragement/congratulation counts:", error);
        }
    }, [user?._id, KUDOS_CACHE_KEY, CACHE_DURATION]);

    // Invalidate kudos cache and trigger a fresh fetch
    const invalidateKudosCache = React.useCallback(async () => {
        try {
            console.log("Invalidating kudos cache...");
            await AsyncStorage.removeItem(KUDOS_CACHE_KEY);
            // Immediately fetch fresh data after invalidation
            await fetchKudosCounts(true);
        } catch (error) {
            console.error("Error invalidating kudos cache:", error);
        }
    }, [KUDOS_CACHE_KEY, fetchKudosCounts]);

    useEffect(() => {
        fetchKudosCounts();
    }, [fetchKudosCounts]);

    // Push notifications force-refresh these counts past the AsyncStorage TTL.
    useEffect(
        () => notificationRefreshEvents.subscribe(() => fetchKudosCounts(true)),
        [fetchKudosCounts]
    );

    // Refresh all data (for pull-to-refresh)
    const handleRefresh = React.useCallback(async () => {
        capture(AnalyticsEvents.PULL_TO_REFRESH, {
            screen_name: "task_home",
        });
        setRefreshing(true);
        try {
            await Promise.all([
                fetchWorkspaces(true),
                fetchKudosCounts(true),
                fetchKudosData(),
                // refresh() re-pulls the user so friends/kudos/rings counts (and the
                // onboarding checks that read them) reflect actions taken elsewhere.
                refresh(),
                queryClient.invalidateQueries(),
            ]);
        } catch (error) {
            console.error("Error refreshing data:", error);
        } finally {
            setRefreshing(false);
        }
    }, [fetchWorkspaces, fetchKudosCounts, fetchKudosData, refresh, queryClient, capture]);

    const drawerRef = useRef<DrawerLayout>(null);

    return (
        <HomeContent
            drawerRef={drawerRef}
            setIsDrawerOpen={setIsDrawerOpen}
            creatingWorkspace={creatingWorkspace}
            setCreatingWorkspace={setCreatingWorkspace}
            showWorkspaceSelection={showWorkspaceSelection}
            setShowWorkspaceSelection={setShowWorkspaceSelection}
            user={user}
            ThemedColor={ThemedColor}
            insets={insets}
            focusMode={focusMode}
            toggleFocusMode={toggleFocusMode}
            encouragementCount={encouragementCount}
            congratulationCount={congratulationCount}
            displayWorkspaces={displayWorkspaces}
            fetchingWorkspaces={fetchingWorkspaces}
            workspaces={workspaces}
            setSelected={setSelected}
            refreshing={refreshing}
            onRefresh={handleRefresh}
        />
    );
};

const HomeContent = ({
    drawerRef,
    setIsDrawerOpen,
    creatingWorkspace,
    setCreatingWorkspace,
    showWorkspaceSelection,
    setShowWorkspaceSelection,
    user,
    ThemedColor,
    insets,
    focusMode,
    toggleFocusMode,
    encouragementCount,
    congratulationCount,
    displayWorkspaces,
    fetchingWorkspaces,
    workspaces,
    setSelected,
    refreshing,
    onRefresh,
}: any) => {
    const { selected, showConfetti } = useTasks();
    const [statsExpanded, setStatsExpanded] = useState(false);
    const headerDimAnim = useRef(new Animated.Value(1)).current;
    // First-touch: the drawer (workspace switcher/creator) hides behind the menu icon
    const { ready: drawerHintReady, done: drawerHintDone } = useFirstTouchHint("drawer_workspaces");

    useEffect(() => {
        Animated.timing(headerDimAnim, {
            toValue: statsExpanded ? 0.15 : 1,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [statsExpanded]);

    const homeScrollRef = useRef<any>(null);
    const kudosRef = useRef<View>(null);
    const menuRef = useRef<View>(null);
    const kudosOffsetRef = useRef<number>(0);

    // Guided first-touch home tour. Lives here (not in HomeScrollContent) so the
    // overlay can cover the whole home view — header included — and so the tabs
    // layout can hide the tab bar + FAB while it runs.
    const tour = useHomeTour(homeScrollRef);
    useEffect(() => {
        homeTourVisibilityEvents.emit(tour.active);
    }, [tour.active]);
    useEffect(() => () => homeTourVisibilityEvents.emit(false), []);

    // ── Unified pager: [Today, Home, Friends, ...workspaces] ──────────────
    // Page index is the source of truth; `selected` is kept in sync as the
    // external API. Home + Friends both map to selected "" (Friends is swipe-only).
    type Page = { key: "today" } | { key: "home" } | { key: "friends" } | { key: "workspace"; name: string };
    const HOME_INDEX = 1;
    const wsPages = React.useMemo(() => (workspaces as any[]).filter((w) => !w.isBlueprint), [workspaces]);
    const pages = React.useMemo<Page[]>(
        () => [{ key: "today" }, { key: "home" }, { key: "friends" }, ...wsPages.map((w) => ({ key: "workspace" as const, name: w.name }))],
        [wsPages]
    );
    const selectedToIndex = React.useCallback(
        (sel: string) => {
            if (sel === "Today") return 0;
            if (sel === "") return HOME_INDEX;
            const wi = wsPages.findIndex((w) => w.name === sel);
            return wi >= 0 ? 3 + wi : HOME_INDEX;
        },
        [wsPages]
    );
    const indexToSelected = React.useCallback(
        (index: number) => (index === 0 ? "Today" : index <= 2 ? "" : wsPages[index - 3]?.name ?? ""),
        [wsPages]
    );

    const pagerRef = useRef<PagerView>(null);
    const isExternalChange = useRef(false);
    const [activeIndex, setActiveIndex] = useState(() => selectedToIndex(selected));
    const [mountedIndices, setMountedIndices] = useState<Set<number>>(() => {
        const idx = selectedToIndex(selected);
        const s = new Set<number>();
        for (let i = Math.max(0, idx - 1); i <= idx + 1; i++) s.add(i);
        return s;
    });

    // Keep adjacent pages mounted once visited.
    useEffect(() => {
        setMountedIndices((prev) => {
            const next = new Set(prev);
            for (let i = Math.max(0, activeIndex - 1); i <= Math.min(pages.length - 1, activeIndex + 1); i++) next.add(i);
            return next.size !== prev.size ? next : prev;
        });
    }, [activeIndex, pages.length]);

    // External setSelected → move the pager. Skip when the current page already
    // represents `selected` (home + friends both are ""), so friends isn't yanked.
    useEffect(() => {
        if (indexToSelected(activeIndex) === selected) return;
        const target = selectedToIndex(selected);
        isExternalChange.current = true;
        setActiveIndex(target);
        pagerRef.current?.setPage(target);
    }, [selected, activeIndex, indexToSelected, selectedToIndex]);

    const onPageSelected = React.useCallback(
        (e: { nativeEvent: { position: number } }) => {
            const pos = e.nativeEvent.position;
            setActiveIndex(pos);
            if (isExternalChange.current) {
                isExternalChange.current = false;
                return;
            }
            const sel = indexToSelected(pos);
            if (sel !== selected) setSelected(sel);
        },
        [indexToSelected, selected, setSelected]
    );

    const isHome = activeIndex === HOME_INDEX;
    const onHomeOrFriends = activeIndex === HOME_INDEX || activeIndex === 2;

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={DRAWER_WIDTH}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front"
            onDrawerOpen={() => {
                setIsDrawerOpen(true);
                drawerHintDone();
            }}
            onDrawerClose={() => setIsDrawerOpen(false)}>
            {/* Shared modals */}
            <CreateWorkspaceBottomSheetModal visible={creatingWorkspace} setVisible={setCreatingWorkspace} />
            <WorkspaceSelectionBottomSheet
                isVisible={showWorkspaceSelection}
                onClose={() => setShowWorkspaceSelection(false)}
                onComplete={() => setShowWorkspaceSelection(false)}
            />

            <ThemedView style={styles.container}>
                {/* One swipeable surface: Today · Home · Friends · workspaces */}
                <View style={styles.viewsContainer}>
                    {/* One glow for the whole tab — blobs shift per view */}
                    <WorkspaceGlow variant={onHomeOrFriends ? "home" : "workspace"} />

                    {showConfetti && (
                        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} pointerEvents="none">
                            <Confetti />
                        </View>
                    )}

                    <PagerView
                        ref={pagerRef}
                        style={{ flex: 1 }}
                        initialPage={activeIndex}
                        offscreenPageLimit={1}
                        scrollEnabled={!tour.active}
                        onPageSelected={onPageSelected}>
                        {pages.map((page, index) => {
                            const key = page.key === "workspace" ? `ws-${page.name}` : page.key;
                            const mounted = mountedIndices.has(index);
                            return (
                                <View key={key} style={{ flex: 1 }} collapsable={false}>
                                    {!mounted ? null : page.key === "home" ? (
                                        <View style={[styles.viewContainer, { paddingTop: insets.top }]}>
                                            <Animated.View style={{ marginHorizontal: HORIZONTAL_PADDING, opacity: headerDimAnim }}>
                                                <WelcomeHeader
                                                    userName={user?.display_name}
                                                    ThemedColor={ThemedColor}
                                                    onSettingsPress={() => router.push("/(logged-in)/(tabs)/(profile)/settings")}
                                                />
                                            </Animated.View>
                                            <View style={{ height: 8 }} />
                                            <HomeScrollContent
                                                encouragementCount={encouragementCount}
                                                congratulationCount={congratulationCount}
                                                workspaces={workspaces}
                                                displayWorkspaces={displayWorkspaces}
                                                fetchingWorkspaces={fetchingWorkspaces}
                                                onWorkspaceSelect={setSelected}
                                                onCreateWorkspace={() => setCreatingWorkspace(true)}
                                                drawerRef={drawerRef}
                                                ThemedColor={ThemedColor}
                                                focusMode={focusMode}
                                                toggleFocusMode={toggleFocusMode}
                                                refreshing={refreshing}
                                                onRefresh={onRefresh}
                                                scrollRef={homeScrollRef}
                                                tour={tour}
                                                kudosRef={kudosRef}
                                                kudosOffsetRef={kudosOffsetRef}
                                                onKudosLayout={(layout) => {
                                                    kudosOffsetRef.current = layout.y;
                                                }}
                                                onStatsExpandChange={setStatsExpanded}
                                            />
                                        </View>
                                    ) : page.key === "today" ? (
                                        <Daily embedded />
                                    ) : page.key === "friends" ? (
                                        <FriendsContent />
                                    ) : (
                                        <WorkspaceContent workspaceName={page.name} />
                                    )}
                                </View>
                            );
                        })}
                    </PagerView>

                    <PagerDots count={pages.length} activeIndex={activeIndex} onDotPress={(i) => pagerRef.current?.setPage(i)} />

                    {/* Guided tour overlay — covers the whole home view (header included) */}
                    {isHome && (
                        <HomeTourOverlay
                            active={tour.active}
                            activeSectionTop={tour.activeSectionTop}
                            copy={tour.step?.copy ?? ""}
                            stepIndex={tour.stepIndex}
                            totalSteps={tour.totalSteps}
                            isCreateStep={tour.isCreateStep}
                            onNext={tour.next}
                            onSkip={tour.skip}
                            onCreate={() => {
                                tour.skip();
                                setCreatingWorkspace(true);
                            }}
                        />
                    )}
                </View>
            </ThemedView>
        </DrawerLayout>
    );
};

export default Home;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: "visible",
    },
    viewsContainer: {
        flex: 1,
        position: "relative",
    },
    viewContainer: {
        flex: 1,
    },
    menuButtonContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 100,
    },
});
