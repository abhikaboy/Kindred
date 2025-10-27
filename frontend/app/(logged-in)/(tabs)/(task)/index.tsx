import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity, Switch } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/contexts/tasksContext";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import CreateWorkspaceBottomSheetModal from "@/components/modals/CreateWorkspaceBottomSheetModal";
import { useCreateModal } from "@/contexts/createModalContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import ConditionalView from "@/components/ui/ConditionalView";
import Ionicons from "@expo/vector-icons/Ionicons";
import Timeline from "@/components/home/Timeline";
import { Image } from "react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import Workspace from "./workspace";
import Today from "./today";
import { MotiView } from "moti";
import { Skeleton } from "moti/skeleton";
import { useNavigation, useRouter } from "expo-router";
import BasicCard from "@/components/cards/BasicCard";
import DashboardCards from "@/components/dashboard/DashboardCards";
import BottomDashboardCards from "@/components/dashboard/BottomDashboardCards";
// import Sparkle from "@/assets/icons/sparkle.svg";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import * as Sentry from "@sentry/react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Octicons from "@expo/vector-icons/Octicons";
import { getEncouragementsAPI } from "@/api/encouragement";
import { getCongratulationsAPI } from "@/api/congratulation";
import WorkspaceSelectionBottomSheet from "@/components/modals/WorkspaceSelectionBottomSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusMode } from "@/contexts/focusModeContext";
import { useTutorial } from "@/hooks/useTutorial";
import TutorialCard from "@/components/cards/TutorialCard";
import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep } from "react-native-spotlight-tour";
import { useSpotlight } from "@/contexts/SpotlightContext";
import { TourStepCard } from "@/components/spotlight/TourStepCard";
import { SPOTLIGHT_MOTION } from "@/constants/spotlightConfig";

type Props = {};

const Home = (props: Props) => {
    // get tasks via api call
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    const { fetchWorkspaces, selected, workspaces, setSelected, dueTodayTasks, fetchingWorkspaces } = useTasks();
    const { startTodayTasks, pastStartTasks, pastDueTasks, futureTasks, allTasks, getRecentWorkspaces } = useTasks();
    const { openModal } = useCreateModal();
    const [creatingWorkspace, setCreatingWorkspace] = useState(false);
    const [encouragementCount, setEncouragementCount] = useState(0);
    const [congratulationCount, setCongratulationCount] = useState(0);
    const [showWorkspaceSelection, setShowWorkspaceSelection] = useState(false);
    const { focusMode, toggleFocusMode } = useFocusMode();
    const { shouldShowTutorial, markTutorialAsSeen } = useTutorial(user?._id);

    const insets = useSafeAreaInsets();
    const safeAsync = useSafeAsync();
    const { setIsDrawerOpen } = useDrawer();

    // Spotlight state management from context
    const { spotlightState, setSpotlightShown } = useSpotlight();


    // Get recent workspaces and create a display list
    const recentWorkspaceNames = getRecentWorkspaces();
    
    // Create a display list: recent workspaces first, then other workspaces up to 6 total
    const displayWorkspaces = React.useMemo(() => {
        if (!workspaces || workspaces.length === 0) return [];
        
        // Get recent workspaces that still exist
        const recentWorkspaces = recentWorkspaceNames
            .map(name => workspaces.find(ws => ws.name === name))
            .filter(Boolean);
        
        // Get non-recent workspaces
        const otherWorkspaces = workspaces.filter(
            ws => !recentWorkspaceNames.includes(ws.name)
        );
        
        // Combine and limit to 6
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
                
                // Show modal only if:
                // 1. They haven't completed setup
                // 2. They've completed the task spotlight (finished all tours)
                // 3. They're on the home page (selected === "")
                if (!hasCompletedSetup && spotlightState.taskSpotlight && selected === "") {
                    setShowWorkspaceSelection(true);
                } else if (selected !== "") {
                    // Close modal if user navigates away from home page
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

    // Fetch encouragement and congratulation counts
    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const [encouragements, congratulations] = await Promise.all([
                    getEncouragementsAPI(),
                    getCongratulationsAPI()
                ]);
                
                // Count unread items
                const unreadEncouragements = encouragements.filter(item => !item.read).length;
                const unreadCongratulations = congratulations.filter(item => !item.read).length;
                
                setEncouragementCount(unreadEncouragements);
                setCongratulationCount(unreadCongratulations);
            } catch (error) {
                console.error("Error fetching encouragement/congratulation counts:", error);
            }
        };

        fetchCounts();
    }, []);

    const drawerRef = useRef<DrawerLayout>(null);

    if (selected == "Today") {
        return <Today />;
    }

    // If a workspace is selected, show the workspace component
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
                        setSpotlightShown('homeSpotlight');
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Community 🤝"
                    description="This is where encouragements and congratulations from your close friends live!"
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown('homeSpotlight');
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
                        setSpotlightShown('homeSpotlight');
                        // Increased delay to allow drawer to open before starting next tour
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
                tourSteps={tourSteps}
                spotlightState={spotlightState}
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
    tourSteps,
    spotlightState
}: any) => {
    const { start } = useSpotlightTour();
    const router = useRouter();
    const { selected } = useTasks();

    useEffect(() => {
        // Only start the tour if we haven't shown the home spotlight
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
                    // Optionally refresh the workspace list or navigate somewhere
                }}
            />
            
            <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: focusMode ? 0 : Dimensions.get("screen").height * 0.12 }]}>
                    <AttachStep index={2}>
                        <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                            <Feather name="menu" size={24} color={ThemedColor.caption} />
                        </TouchableOpacity>
                    </AttachStep>

                <ConditionalView condition={selected === ""}>
                    <View style={styles.headerContainer}>
                        <View style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}>
                            <ThemedText type="title" style={styles.title}>
                                Welcome {user?.display_name}! ☀️
                            </ThemedText>
                        </View>

                        <ScrollView style={{ gap: 16 }} contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
                            <MotiView style={{ gap: 16, marginTop: 24 }}>
                                {/* Focus - always visible at the top */}
                                <BasicCard>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <ThemedText type="default">Focus</ThemedText>
                                        <Switch
                                            value={focusMode}
                                            onValueChange={toggleFocusMode}
                                            trackColor={{ false: ThemedColor.caption + "40", true: ThemedColor.primary }}
                                            thumbColor={focusMode ? ThemedColor.tint : "#f4f3f4"}
                                            ios_backgroundColor={ThemedColor.caption + "40"}
                                        />
                                    </View>
                                </BasicCard>

                                {/* Unread Encouragements - show right under Focus if unread */}
                                <AttachStep index={1}>
                                    <View style={{ width: '100%', gap: 16 }}>
                                        {encouragementCount > 0 && (
                                            <TouchableOpacity
                                                onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/encouragements")}>
                                                <BasicCard>
                                                    <View
                                                        style={{
                                                            width: 12,
                                                            height: 12,
                                                            backgroundColor: ThemedColor.error,
                                                            borderRadius: 12,
                                                            position: "absolute",
                                                            right: 0,
                                                            top: 0,
                                                        }}
                                                    />
                                                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                                        <ThemedText type="default">Encouragements</ThemedText>
                                                        <ThemedText type="default">{encouragementCount}</ThemedText>
                                                    </View>
                                                </BasicCard>
                                            </TouchableOpacity>
                                        )}

                                        {/* Unread Congratulations - show right under Focus if unread */}
                                        {congratulationCount > 0 && (
                                            <TouchableOpacity
                                                onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/congratulations")}>
                                                <BasicCard>
                                                    <View
                                                        style={{
                                                            width: 12,
                                                            height: 12,
                                                            backgroundColor: ThemedColor.error,
                                                            borderRadius: 12,
                                                            position: "absolute",
                                                            right: 0,
                                                            top: 0,
                                                        }}
                                                    />
                                                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                                        <ThemedText type="default">Congratulations</ThemedText>
                                                        <ThemedText type="default">{congratulationCount}</ThemedText>
                                                    </View>
                                                </BasicCard>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </AttachStep>

                                <DashboardCards drawerRef={drawerRef} />
                                
                                {/* Encouragements and Congratulations - show after Today if no unread */}
                                {(encouragementCount === 0 || congratulationCount === 0) && (
                                    <AttachStep index={1} style={{ width: '100%', gap: 16 }}>
                                        <View style={{ width: '100%', gap: 16 }}>
                                            <ThemedText type="subtitle">Community</ThemedText>
                                            <View style={{ width: '100%', gap: 12 }}>
                                                {encouragementCount === 0 && (
                                                    <TouchableOpacity
                                                        onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/encouragements")}>
                                                        <BasicCard>
                                                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                                                <ThemedText type="default">Encouragements</ThemedText>
                                                                <ThemedText type="default">{encouragementCount}</ThemedText>
                                                            </View>
                                                        </BasicCard>
                                                    </TouchableOpacity>
                                                )}
                                                {congratulationCount === 0 && (
                                                    <TouchableOpacity
                                                        onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/congratulations")}>
                                                        <BasicCard>
                                                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                                                <ThemedText type="default">Congratulations</ThemedText>
                                                                <ThemedText type="default">{congratulationCount}</ThemedText>
                                                            </View>
                                                        </BasicCard>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    </AttachStep>
                                )}

                                <ThemedText type="subtitle">Recent Workspaces</ThemedText>
                                <ScrollView 
                                    horizontal={false}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 108 }}>
                                    <ConditionalView condition={workspaces.length > 0} key="workspaces-container">
                                        <View style={styles.workspacesGrid}>
                                            <Skeleton.Group key="workspaces-skeleton" show={fetchingWorkspaces}>
                                                {displayWorkspaces.map((workspace, index) => (
                                                    <Skeleton
                                                        key={workspace.name}
                                                        colors={[ThemedColor.lightened, ThemedColor.lightened + "50"]}>
                                                        <TouchableOpacity
                                                            key={workspace.name}
                                                            onPress={() => {
                                                                setSelected(workspace.name);
                                                            }}
                                                            style={[
                                                                styles.workspaceCard,
                                                                {
                                                                    backgroundColor: ThemedColor.lightened,
                                                                    borderColor: "#ffffff08",
                                                                    boxShadow: ThemedColor.shadowSmall,
                                                                }
                                                            ]}>
                                                            <View style={styles.workspaceCardContent}>
                                                                <View style={styles.workspaceCardText}>
                                                                    <ThemedText type="default">{workspace.name}</ThemedText>
                                                                    <ThemedText type="defaultSemiBold">{"→"}</ThemedText>
                                                                </View>
                                                            </View>
                                                        </TouchableOpacity>
                                                    </Skeleton>
                                                ))}
                                            </Skeleton.Group>
                                        </View>
                                    </ConditionalView>
                                    <TouchableOpacity
                                        onPress={() => setCreatingWorkspace(true)}
                                        style={[
                                            styles.createWorkspaceCard,
                                            {
                                                backgroundColor: ThemedColor.lightened,
                                            }
                                        ]}>
                                        <ThemedText type="lightBody">+ Create Workspace</ThemedText>
                                    </TouchableOpacity>

                                    <View style={{ paddingBottom: 64, paddingTop: 16 }}>
                                        <BottomDashboardCards />
                                    </View>

                                    {/* Tutorial Card at bottom */}
                                    <TutorialCard 
                                        onPress={() => {
                                            router.push('/(logged-in)/(tutorial)');
                                        }}
                                        showBadge={shouldShowTutorial}
                                    />

                                </ScrollView>
                            </MotiView>
                        </ScrollView>
                    </View>
                </ConditionalView>
            </ThemedView>
        </DrawerLayout>
    );
};

export default Home;

const AllClear = () => {
    return (
        <View>
            <View
                style={{
                    width: "100%",
                    marginTop: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                }}>
                <Image
                    source={require("@/assets/images/Checkmark.png")}
                    style={{ width: "25%", resizeMode: "contain" }}
                />
                <ThemedText type="subtitle">Woohoo! All Clear!</ThemedText>
            </View>
        </View>
    );
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
    },
    title: {
        fontWeight: "600",
    },
    workspacesGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        justifyContent: "space-between",
        width: "100%",
    },
    workspaceCard: {
        borderRadius: 12,
        padding: 16,
        minHeight: 100,
        justifyContent: "flex-end",
        width: (Dimensions.get("window").width - HORIZONTAL_PADDING * 2) / 2.1,
        borderWidth: 1,
    },
    workspaceCardContent: {
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        width: "100%",
    },
    workspaceCardText: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
    },
    createWorkspaceCard: {
        padding: 16,
        borderRadius: 12,
        width: "100%",
        alignItems: "center",
        marginTop: 12,
    },
});
