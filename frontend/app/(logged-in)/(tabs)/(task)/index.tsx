import { Dimensions, StyleSheet, View } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/contexts/tasksContext";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import CreateWorkspaceBottomSheetModal from "@/components/modals/CreateWorkspaceBottomSheetModal";
import { useCreateModal } from "@/contexts/createModalContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import ConditionalView from "@/components/ui/ConditionalView";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import Workspace from "./workspace";
import Today from "./today";
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
import { SpinningDashedCircle } from "@/components/ui/SpinningDashedCircle";

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

    const { openModal } = useCreateModal();
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
    const { spotlightState, setSpotlightShown } = useSpotlight();
    
    // Cache keys and duration
    const KUDOS_CACHE_KEY = `kudos_cache_${user?._id || 'default'}`;
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

    if (selected == "Today") {
        return <Today />;
    }

    if (selected !== "") {
        return <Workspace />;
    }

    // Tour steps
    const tourSteps: TourStep[] = [
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Workspaces 📚"
                    description="Quick access to all your workspaces! Tap here to view and manage your workspaces."
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
                        drawerRef.current?.openDrawer();
                        setSpotlightShown("homeSpotlight");
                        setTimeout(next, 500);
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
    refreshing,
    onRefresh,
}: any) => {
    const { start } = useSpotlightTour();
    const { selected } = useTasks();

    useEffect(() => {
        if (!spotlightState.homeSpotlight) {
            const timer = setTimeout(() => {
                start();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [start, spotlightState.homeSpotlight]);

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
            <CreateWorkspaceBottomSheetModal visible={creatingWorkspace} setVisible={setCreatingWorkspace} />

            <WorkspaceSelectionBottomSheet
                isVisible={showWorkspaceSelection}
                onClose={() => setShowWorkspaceSelection(false)}
                onComplete={() => {
                    setShowWorkspaceSelection(false);
                }}
            />

            <ThemedView
                style={[
                    styles.container,
                    {
                        paddingTop: insets.top,
                    },
                ]}>
                {/* <SpinningDashedCircle /> */}
                <ConditionalView condition={selected === ""}>
                    <View style={{ marginHorizontal: HORIZONTAL_PADDING }}>
                        <WelcomeHeader
                            userName={user?.display_name}
                            onMenuPress={() => drawerRef.current?.openDrawer()}
                            ThemedColor={ThemedColor}
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
                    />
                </ConditionalView>
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
});
