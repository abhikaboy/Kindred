import { StyleSheet, View, InteractionManager } from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { SomedayList } from "@/components/task/SomedayList";
import { useAuth } from "@/hooks/useAuth";
import { useTaskActions, useTasksSelector } from "@/contexts/tasksContext";
import CreateWorkspaceBottomSheetModal from "@/components/modals/CreateWorkspaceBottomSheetModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WorkspaceSelectionBottomSheet from "@/components/modals/WorkspaceSelectionBottomSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusMode } from "@/contexts/focusModeContext";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { useIsGuest } from "@/hooks/useIsGuest";
import { promptAccountForSocial } from "@/hooks/useAccountOverlay";
import { HomeScrollContent } from "@/components/dashboard/HomescrollContent";
import { HomeTourOverlay } from "@/components/dashboard/HomeTourOverlay";
import { useHomeTour } from "@/hooks/useHomeTour";
import { IntroTourOverlay } from "@/components/dashboard/IntroTourOverlay";
import { useIntroTour } from "@/hooks/useIntroTour";
import { homeTourVisibilityEvents, homePageVisibilityEvents, scheduleSelectionEvents } from "@/utils/homeTourVisibilityEvents";
import HomeQuickAddDock from "@/components/dashboard/HomeQuickAddDock";
import { WorkspaceContent } from "@/components/task/WorkspaceContent";
import { PagerDots, type PagerKind } from "@/components/task/PagerDots";
import PagerView from "react-native-pager-view";
import { useSharedValue } from "react-native-reanimated";
import Confetti from "@/components/ui/Confetti";
import { MemoDaily } from "./daily";
import WorkspaceGlow from "@/components/task/WorkspaceGlow";
import FriendsContent from "@/components/dashboard/FriendsContent";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { useKudos } from "@/contexts/kudosContext";
import { hapticSelect } from "@/utils/haptics";

// Memoized at the usage site so a swipe (which re-renders the pager) doesn't
// re-render every mounted workspace page.
const MemoWorkspaceContent = React.memo(WorkspaceContent);

type Page = { key: "today" } | { key: "home" } | { key: "friends" } | { key: "workspace"; name: string } | { key: "someday" };
const TODAY_INDEX = 0;
const HOME_INDEX = 1;
const FRIENDS_INDEX = 2;
const WORKSPACE_OFFSET = 3;
// Besides the active page ±1, keep this many recently active pages mounted so
// jumping back (workspace → home) doesn't pay a full remount.
const EXTRA_RECENT_PAGES = 2;
const pageKeyOf = (page: Page) => (page.key === "workspace" ? `ws-${page.name}` : page.key);

type Props = {};

const Home = (props: Props) => {
    const { user, refresh } = useAuth();
    const isGuest = useIsGuest();
    let ThemedColor = useThemeColor();

    const { fetchWorkspaces, setSelected } = useTaskActions();
    const workspaces = useTasksSelector((s) => s.workspaces);
    const selectedIsEmpty = useTasksSelector((s) => s.selected === "");

    const [creatingWorkspace, setCreatingWorkspace] = useState(false);
    const [showWorkspaceSelection, setShowWorkspaceSelection] = useState(false);
    const { focusMode, toggleFocusMode } = useFocusMode();
    const [refreshing, setRefreshing] = useState(false);
    const queryClient = useQueryClient();
    const { capture } = useAnalytics();
    const { fetchKudosData } = useKudos();

    const insets = useSafeAreaInsets();

    // Check if user has completed quick setup
    useEffect(() => {
        const checkQuickSetup = async () => {
            if (!user?._id) return;

            try {
                const key = `${user._id}-quicksetup`;
                const hasCompletedSetup = await AsyncStorage.getItem(key);

                if (!hasCompletedSetup && selectedIsEmpty) {
                    setShowWorkspaceSelection(true);
                } else if (!selectedIsEmpty) {
                    setShowWorkspaceSelection(false);
                }
            } catch (error) {
                console.error("Error checking quick setup status:", error);
            }
        };

        checkQuickSetup();
    }, [user?._id, selectedIsEmpty]);

    // Initial workspace load is kicked off by TasksProvider once the user id is known.

    // Refresh all data (for pull-to-refresh)
    const handleRefresh = React.useCallback(async () => {
        capture(AnalyticsEvents.PULL_TO_REFRESH, {
            screen_name: "task_home",
        });
        setRefreshing(true);
        try {
            await Promise.all([
                fetchWorkspaces(true),
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
    }, [fetchWorkspaces, fetchKudosData, refresh, queryClient, capture]);

    return (
        <HomeContent
            creatingWorkspace={creatingWorkspace}
            setCreatingWorkspace={setCreatingWorkspace}
            showWorkspaceSelection={showWorkspaceSelection}
            setShowWorkspaceSelection={setShowWorkspaceSelection}
            userName={user?.display_name}
            isGuest={isGuest}
            ThemedColor={ThemedColor}
            insets={insets}
            focusMode={focusMode}
            toggleFocusMode={toggleFocusMode}
            workspaces={workspaces}
            setSelected={setSelected}
            refreshing={refreshing}
            onRefresh={handleRefresh}
        />
    );
};

const HomeContent = React.memo(function HomeContent({
    creatingWorkspace,
    setCreatingWorkspace,
    showWorkspaceSelection,
    setShowWorkspaceSelection,
    userName,
    isGuest,
    ThemedColor,
    insets,
    focusMode,
    toggleFocusMode,
    workspaces,
    setSelected,
    refreshing,
    onRefresh,
}: any) {
    const selected = useTasksSelector((s) => s.selected);
    const showConfetti = useTasksSelector((s) => s.showConfetti);
    // home pull-to-refresh drives the tab glow: pull lifts the wash, release replays its opening
    const glowPull = useSharedValue(0);
    const glowReplay = useSharedValue(0);

    const homeScrollRef = useRef<any>(null);

    // Guided first-touch home tour. Lives here (not in HomeScrollContent) so the
    // overlay can cover the whole home view — header included — and so the tabs
    // layout can hide the tab bar + FAB while it runs.
    const rawTour = useHomeTour(homeScrollRef);
    // useHomeTour returns a fresh object every render; pin it so the memoized home page can bail out
    const tour = useMemo(
        () => rawTour,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            rawTour.active,
            rawTour.stepIndex,
            rawTour.activeSectionTop,
            rawTour.start,
            rawTour.next,
            rawTour.skip,
            rawTour.visibleUpTo,
            rawTour.registerSection,
            rawTour.onScrollY,
        ]
    );

    // ── Unified pager: [Today, Home, Friends, ...workspaces] ──────────────
    // Page index is the source of truth; `selected` is kept in sync as the
    // external API. Home + Friends both map to selected "" (Friends is swipe-only).
    const wsPages = React.useMemo(() => (workspaces as any[]).filter((w) => !w.isBlueprint), [workspaces]);
    const somedayIndex = WORKSPACE_OFFSET + wsPages.length;
    const pages = React.useMemo<Page[]>(
        () => [
            { key: "today" },
            { key: "home" },
            { key: "friends" },
            ...wsPages.map((w) => ({ key: "workspace" as const, name: w.name })),
            { key: "someday" },
        ],
        [wsPages]
    );
    const pageKeys = React.useMemo(() => pages.map(pageKeyOf), [pages]);
    const pageKinds = React.useMemo<PagerKind[]>(() => pages.map((p) => p.key), [pages]);
    const pageColors = React.useMemo(() => [undefined, undefined, undefined, ...wsPages.map((w) => w.color), undefined], [wsPages]);
    const selectedToIndex = React.useCallback(
        (sel: string) => {
            if (sel === "Today") return 0;
            if (sel === "Someday") return somedayIndex;
            if (sel === "") return HOME_INDEX;
            const wi = wsPages.findIndex((w) => w.name === sel);
            return wi >= 0 ? WORKSPACE_OFFSET + wi : HOME_INDEX;
        },
        [wsPages, somedayIndex]
    );
    const indexToSelected = React.useCallback(
        (index: number) =>
            index === 0 ? "Today" : index === somedayIndex ? "Someday" : index < WORKSPACE_OFFSET ? "" : wsPages[index - WORKSPACE_OFFSET]?.name ?? "",
        [wsPages, somedayIndex]
    );

    const pagerRef = useRef<PagerView>(null);
    const [activeIndex, setActiveIndex] = useState(() => selectedToIndex(selected));
    const activeKey = pageKeys[activeIndex];

    // Mount window, tracked by page key so adding/removing workspaces doesn't shift it:
    // the active page ±1 plus a couple of recently active pages. On first launch only
    // the active page mounts; neighbours follow once the launch interactions settle.
    const [neighboursReady, setNeighboursReady] = useState(false);
    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => setNeighboursReady(true));
        return () => task.cancel();
    }, []);
    const [recentKeys, setRecentKeys] = useState<string[]>(() => (activeKey ? [activeKey] : []));
    useEffect(() => {
        if (!activeKey) return;
        setRecentKeys((prev) =>
            prev[0] === activeKey ? prev : [activeKey, ...prev.filter((k) => k !== activeKey)].slice(0, 1 + EXTRA_RECENT_PAGES)
        );
    }, [activeKey]);
    const mountedKeys = useMemo(() => {
        const keys = new Set(recentKeys);
        if (activeKey) keys.add(activeKey);
        if (neighboursReady) {
            if (activeIndex > 0) keys.add(pageKeys[activeIndex - 1]);
            if (activeIndex < pageKeys.length - 1) keys.add(pageKeys[activeIndex + 1]);
        }
        return keys;
    }, [recentKeys, activeKey, activeIndex, pageKeys, neighboursReady]);

    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    // External setSelected → move the pager. Compares against getSelected(), not the
    // `selected` snapshot: the store publishes a render late, so right after a swipe or
    // tap the snapshot still holds the old workspace and would drag the pager back to
    // it (and, since Home + Friends share "", land a Friends tap on Home).
    const { getSelected } = useTaskActions();
    useEffect(() => {
        const latest = getSelected();
        // Home + Friends both are "", so friends isn't yanked.
        if (indexToSelected(activeIndex) === latest) return;
        const target = selectedToIndex(latest);
        if (target === activeIndex) return;
        activeIndexRef.current = target;
        setActiveIndex(target);
        pagerRef.current?.setPage(target);
    }, [selected, activeIndex, indexToSelected, selectedToIndex, getSelected]);

    const goToPage = useCallback(
        (pos: number) => {
            activeIndexRef.current = pos;
            setActiveIndex(pos);
            const sel = indexToSelected(pos);
            if (sel !== getSelected()) setSelected(sel);
        },
        [indexToSelected, getSelected, setSelected]
    );

    // The native page is the source of truth: follow it immediately.
    const onPageSelected = React.useCallback(
        (e: { nativeEvent: { position: number } }) => {
            const pos = e.nativeEvent.position;
            if (pos === activeIndexRef.current) return;
            // Dot taps and external changes set the index up front, so this only ticks on swipes.
            hapticSelect();
            goToPage(pos);
        },
        [goToPage]
    );

    // Update the index + selection directly rather than waiting on onPageSelected:
    // setPage alone didn't always emit it, so a first tap could be dropped.
    const onDotPress = useCallback(
        (i: number) => {
            if (i === activeIndexRef.current) return;
            goToPage(i);
            pagerRef.current?.setPage(i);
        },
        [goToPage]
    );

    // Full-screen swipe + focus-mode intro tour. Waits out both the scroll
    // tour and the quick-setup sheet before it ever starts.
    const introTour = useIntroTour({
        activeIndex,
        homeIndex: HOME_INDEX,
        todayIndex: 0,
        setSelected,
        blocked: tour.active || showWorkspaceSelection,
    });
    useEffect(() => {
        homeTourVisibilityEvents.emit(tour.active || introTour.active);
    }, [tour.active, introTour.active]);
    useEffect(() => () => homeTourVisibilityEvents.emit(false), []);

    // Friends needs an account. The first time per session a guest lands there,
    // show the account overlay over it; "Not now" settles them back on Home.
    useEffect(() => {
        if (activeIndex !== FRIENDS_INDEX || !isGuest || tour.active || introTour.active) return;
        promptAccountForSocial("friends", () => onDotPress(HOME_INDEX));
    }, [activeIndex, isGuest, tour.active, introTour.active, onDotPress]);

    const isHome = activeIndex === HOME_INDEX;
    const [scheduling, setScheduling] = useState(false);
    useEffect(() => scheduleSelectionEvents.subscribe(setScheduling), []);
    const onHomeOrFriends = activeIndex === HOME_INDEX || activeIndex === FRIENDS_INDEX;
    // The FAB stays off the Today, Home and Friends pages
    const fabHidden = activeIndex === TODAY_INDEX || onHomeOrFriends;
    useEffect(() => {
        homePageVisibilityEvents.emit(fabHidden);
    }, [fabHidden]);
    useEffect(() => () => homePageVisibilityEvents.emit(false), []);

    const closeWorkspaceSelection = useCallback(() => setShowWorkspaceSelection(false), [setShowWorkspaceSelection]);

    const onSettingsPress = useCallback(() => router.push("/(logged-in)/(tabs)/(profile)/settings"), []);
    const onCreateWorkspace = useCallback(() => setCreatingWorkspace(true), [setCreatingWorkspace]);

    const homePage = useMemo(
        () => (
            <View style={[styles.viewContainer, { paddingTop: insets.top }]}>
                <View style={{ marginHorizontal: HORIZONTAL_PADDING }}>
                    <WelcomeHeader
                        ThemedColor={ThemedColor}
                        onSettingsPress={onSettingsPress}
                        focusMode={focusMode}
                        onToggleFocusMode={toggleFocusMode}
                    />
                </View>
                <HomeScrollContent
                    userName={userName}
                    workspaces={workspaces}
                    onWorkspaceSelect={setSelected}
                    onCreateWorkspace={onCreateWorkspace}
                    ThemedColor={ThemedColor}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    scrollRef={homeScrollRef}
                    tour={tour}
                    glowPull={glowPull}
                    glowReplay={glowReplay}
                />
                {tour.visibleUpTo("quickadd") && (
                    <HomeQuickAddDock sectionRef={(node) => tour.registerSection("quickadd", node)} />
                )}
            </View>
        ),
        [
            insets.top,
            userName,
            isGuest,
            ThemedColor,
            onSettingsPress,
            focusMode,
            toggleFocusMode,
            workspaces,
            setSelected,
            onCreateWorkspace,
            refreshing,
            onRefresh,
            tour,
        ]
    );

    return (
        <>
            {/* Shared modals */}
            <CreateWorkspaceBottomSheetModal visible={creatingWorkspace} setVisible={setCreatingWorkspace} />
            <WorkspaceSelectionBottomSheet
                isVisible={showWorkspaceSelection}
                onClose={closeWorkspaceSelection}
                onComplete={closeWorkspaceSelection}
            />

            <ThemedView style={styles.container}>
                {/* One swipeable surface: Today · Home · Friends · workspaces */}
                <View style={styles.viewsContainer}>
                    {/* One glow for the whole tab — blobs shift per view */}
                    <WorkspaceGlow variant={onHomeOrFriends ? "home" : "workspace"} pull={glowPull} replay={glowReplay} />

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
                            const key = pageKeys[index];
                            const mounted = mountedKeys.has(key);
                            return (
                                <View key={key} style={{ flex: 1 }} collapsable={false}>
                                    {!mounted ? null : page.key === "home" ? (
                                        homePage
                                    ) : page.key === "today" ? (
                                        <MemoDaily embedded />
                                    ) : page.key === "friends" ? (
                                        <FriendsContent isActive={index === activeIndex} />
                                    ) : page.key === "someday" ? (
                                        <View style={[styles.viewContainer, { paddingTop: insets.top }]}>
                                            <View style={styles.somedayHeader}>
                                                <ThemedText type="title" style={{ fontWeight: "600" }}>
                                                    Someday
                                                </ThemedText>
                                            </View>
                                            <View style={{ flex: 1, paddingHorizontal: HORIZONTAL_PADDING }}>
                                                <SomedayList />
                                            </View>
                                        </View>
                                    ) : (
                                        <MemoWorkspaceContent workspaceName={page.name} />
                                    )}
                                </View>
                            );
                        })}
                    </PagerView>

                    {/* Home docks its own quick add; the stage switcher + workspace list navigate instead */}
                    {!isHome && !(scheduling && activeIndex === 0) && <PagerDots kinds={pageKinds} colors={pageColors} activeIndex={activeIndex} onDotPress={onDotPress} />}

                    {/* Guided tour overlay — covers the whole home view (header included) */}
                    {isHome && (
                        <HomeTourOverlay
                            active={tour.active}
                            activeSectionTop={tour.activeSectionTop}
                            copy={tour.step?.copy ?? ""}
                            stepIndex={tour.stepIndex}
                            totalSteps={tour.totalSteps}
                            onNext={tour.next}
                            onSkip={tour.skip}
                            cardAt={tour.step?.cardAt}
                        />
                    )}

                    {/* Full-screen swipe/focus-mode intro — spans pages, not gated on isHome */}
                    <IntroTourOverlay
                        active={introTour.active}
                        step={introTour.step}
                        stepIndex={introTour.stepIndex}
                        totalSteps={introTour.totalSteps}
                        onFocusModePress={introTour.onFocusModePress}
                        onSkip={introTour.skip}
                    />
                </View>
            </ThemedView>
        </>
    );
});

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
    somedayHeader: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 20,
        paddingBottom: 24,
    },
    menuButtonContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 100,
    },
});
