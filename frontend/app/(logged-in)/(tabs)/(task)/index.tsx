import { Dimensions, StyleSheet, View, TouchableOpacity } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/contexts/tasksContext";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import CreateWorkspaceBottomSheetModal from "@/components/modals/CreateWorkspaceBottomSheetModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import ConditionalView from "@/components/ui/ConditionalView";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { TodayContent } from "@/components/task/TodayContent";
import { WorkspaceContent } from "@/components/task/WorkspaceContent";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";
import { getEncouragementsAPI } from "@/api/encouragement";
import { getCongratulationsAPI } from "@/api/congratulation";
import WorkspaceSelectionBottomSheet from "@/components/modals/WorkspaceSelectionBottomSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusMode } from "@/contexts/focusModeContext";
import { useTutorial } from "@/hooks/useTutorial";
import { SpotlightTourProvider, TourStep, useSpotlightTour } from "react-native-spotlight-tour";
import { useSpotlight } from "@/contexts/SpotlightContext";
import { TourStepCard } from "@/components/spotlight/TourStepCard";
import { SPOTLIGHT_MOTION } from "@/constants/spotlightConfig";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { HomeScrollContent } from "@/components/dashboard/HomescrollContent";
import { AnimatedView } from "@/components/ui/AnimatedView";
import { List } from "phosphor-react-native";

type Props = {};

const Home = (props: Props) => {
    const { user } = useAuth();
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
    const { shouldShowTutorial, markTutorialAsSeen } = useTutorial(user?._id);
    const [refreshing, setRefreshing] = useState(false);

    const insets = useSafeAreaInsets();
    const safeAsync = useSafeAsync();
    const { setIsDrawerOpen } = useDrawer();
    const { spotlightState, setSpotlightShown, isLoading: spotlightLoading } = useSpotlight();

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

                if (!hasCompletedSetup && spotlightState.taskSpotlight && selected === "") {
                    setShowWorkspaceSelection(true);
                } else if (selected !== "") {
                    setShowWorkspaceSelection(false);
                }
            } catch (error) {
                console.error("Error checking quick setup status:", error);
            }
        };

        checkQuickSetup();
    }, [user?._id, spotlightState.taskSpotlight, selected]);

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
    }, [user]);

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

    // Refresh all data (for pull-to-refresh)
    const handleRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            console.log("Refreshing all data...");
            await Promise.all([
                fetchWorkspaces(true), // Force refresh workspaces
                fetchKudosCounts(true), // Force refresh kudos
            ]);
            console.log("Refresh complete");
        } catch (error) {
            console.error("Error refreshing data:", error);
        } finally {
            setRefreshing(false);
        }
    }, [fetchWorkspaces, fetchKudosCounts]);

    const drawerRef = useRef<DrawerLayout>(null);

    // Tour steps for home screen
    const tourSteps: TourStep[] = [
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Jump Back In 🚀"
                    description="Quick access to your most important features! Start your day here with daily views, voice dumps, and more."
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown("homeSpotlight");
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Kudos 🤝"
                    description="This is where encouragements and congratulations from your close friends live!"
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown("homeSpotlight");
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Menu"
                    description="Tap here to access your workspaces, settings, and more!"
                    onNext={() => {
                        // Mark home spotlight as shown
                        setSpotlightShown("homeSpotlight");

                        // Open drawer
                        drawerRef.current?.openDrawer();

                        // Stop this tour - the drawer tour will start automatically
                        stop();
                    }}
                    isLastStep
                />
            ),
        },
    ];

    return (
        <SpotlightTourProvider steps={tourSteps} motion={SPOTLIGHT_MOTION}>
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
                shouldShowTutorial={shouldShowTutorial}
                spotlightState={spotlightState}
                spotlightLoading={spotlightLoading}
                refreshing={refreshing}
                onRefresh={handleRefresh}
            />
        </SpotlightTourProvider>
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
    shouldShowTutorial,
    spotlightState,
    spotlightLoading,
    refreshing,
    onRefresh,
}: any) => {
    const { start } = useSpotlightTour();
    const { selected } = useTasks();
    const homeScrollRef = useRef<any>(null);
    const homeStep0Ref = useRef<View>(null);
    const homeStep1Ref = useRef<View>(null);
    const homeStep2Ref = useRef<View>(null);
    const homeLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});

    const registerHomeLayout = (key: "home_step_0" | "home_step_1", layout: { y: number; height: number }) => {
        homeLayoutsRef.current[key] = layout;
    };

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const isOnScreen = (ref: React.RefObject<View>) =>
        new Promise<boolean>((resolve) => {
            requestAnimationFrame(() => {
                if (!ref.current) return resolve(false);
                ref.current.measureInWindow((_x, y, _w, h) => {
                    const screenHeight = Dimensions.get("window").height;
                    resolve(y >= 0 && y + h <= screenHeight);
                });
            });
        });

    const ensureVisible = async (
        ref: React.RefObject<View>,
        scrollRef?: React.RefObject<any>,
        layout?: { y: number; height: number }
    ) => {
        if (await isOnScreen(ref)) return true;
        if (scrollRef?.current && layout) {
            scrollRef.current.scrollTo({ y: Math.max(layout.y - 20, 0), animated: true });
            await delay(300);
            return isOnScreen(ref);
        }
        return false;
    };

    // Track which workspaces have been visited for lazy mounting
    const [visitedWorkspaces, setVisitedWorkspaces] = React.useState<Set<string>>(new Set());

    useEffect(() => {
        if (!spotlightLoading && !spotlightState.homeSpotlight && selected === "") {
            const timer = setTimeout(async () => {
                const canStart = await ensureVisible(
                    homeStep0Ref,
                    homeScrollRef,
                    homeLayoutsRef.current.home_step_0
                );
                if (canStart) {
                    requestAnimationFrame(() => {
                        start();
                    });
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [start, spotlightLoading, spotlightState.homeSpotlight, selected]);

    // Add workspace to visited set when selected
    useEffect(() => {
        if (selected && selected !== "" && selected !== "Today") {
            setVisitedWorkspaces(prev => {
                const newSet = new Set(prev);
                newSet.add(selected);
                return newSet;
            });
        }
    }, [selected]);

    // Determine which view to show
    const isHome = selected === "";
    const isToday = selected === "Today";
    const isWorkspace = selected !== "" && selected !== "Today";

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={Dimensions.get("screen").width * 0.75}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front"
            onDrawerOpen={() => setIsDrawerOpen(true)}
            onDrawerClose={() => setIsDrawerOpen(false)}>
            {/* Shared modals */}
            <CreateWorkspaceBottomSheetModal visible={creatingWorkspace} setVisible={setCreatingWorkspace} />
            <WorkspaceSelectionBottomSheet
                isVisible={showWorkspaceSelection}
                onClose={() => setShowWorkspaceSelection(false)}
                onComplete={() => setShowWorkspaceSelection(false)}
            />

            <ThemedView style={styles.container}>
                {/* Menu button overlay - shown for Today and Workspace views */}
                <ConditionalView condition={!isHome}>
                    <View
                        style={[
                            styles.menuButtonContainer,
                            { paddingTop: insets.top + 10, paddingLeft: HORIZONTAL_PADDING },
                        ]}>
                        <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                            <List size={24} color={ThemedColor.caption} weight="regular" />
                        </TouchableOpacity>
                    </View>
                </ConditionalView>

                {/* Container for cross-fading views */}
                <View style={styles.viewsContainer}>
                    {/* Home View - Dashboard with workspaces */}
                    <AnimatedView visible={isHome}>
                        <ThemedView style={[styles.viewContainer, { paddingTop: insets.top }]}>
                            <View style={{ marginHorizontal: HORIZONTAL_PADDING }}>
                                <WelcomeHeader
                                    userName={user?.display_name}
                                    onMenuPress={() => drawerRef.current?.openDrawer()}
                                    ThemedColor={ThemedColor}
                                    menuRef={homeStep2Ref}
                                />
                            </View>

                            <HomeScrollContent
                                encouragementCount={encouragementCount}
                                congratulationCount={congratulationCount}
                                workspaces={workspaces}
                                displayWorkspaces={displayWorkspaces}
                                fetchingWorkspaces={fetchingWorkspaces}
                                onWorkspaceSelect={setSelected}
                                onCreateWorkspace={() => setCreatingWorkspace(true)}
                                shouldShowTutorial={shouldShowTutorial}
                                drawerRef={drawerRef}
                                ThemedColor={ThemedColor}
                                focusMode={focusMode}
                                toggleFocusMode={toggleFocusMode}
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                scrollRef={homeScrollRef}
                                jumpBackInRef={homeStep0Ref}
                                kudosRef={homeStep1Ref}
                                onSpotlightLayout={registerHomeLayout}
                            />
                        </ThemedView>
                    </AnimatedView>

                    {/* Today View - Tasks due/scheduled for today */}
                    <AnimatedView visible={isToday}>
                        <TodayContent />
                    </AnimatedView>

                    {/* Workspace Views - Lazy mount on first visit, then keep mounted for smooth transitions */}
                    {workspaces.map((workspace) => {
                        // Only render if this workspace has been visited
                        if (!visitedWorkspaces.has(workspace.name)) {
                            return null;
                        }

                        const isThisWorkspace = selected === workspace.name && isWorkspace;
                        return (
                            <AnimatedView key={workspace.name} visible={isThisWorkspace}>
                                <WorkspaceContent workspaceName={workspace.name} />
                            </AnimatedView>
                        );
                    })}
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
