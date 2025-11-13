import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity } from "react-native";
import React, { useRef, useState, useEffect, useMemo } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTasks } from "@/contexts/tasksContext";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import EditCategory from "@/components/modals/edit/EditCategory";
import { useCreateModal } from "@/contexts/createModalContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Category } from "../../../../components/category";
import ConfettiCannon from "react-native-confetti-cannon";
import ConditionalView from "@/components/ui/ConditionalView";
import SlidingText from "@/components/ui/SlidingText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EditWorkspace from "@/components/modals/edit/EditWorkspace";
import { useDrawer } from "@/contexts/drawerContext";
import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep } from "react-native-spotlight-tour";
import { useSpotlight } from "@/contexts/SpotlightContext";
import { TourStepCard } from "@/components/spotlight/TourStepCard";
import { SPOTLIGHT_MOTION } from "@/constants/spotlightConfig";
import { useWorkspaceFilters } from "@/hooks/useWorkspaceFilters";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { usePathname } from "expo-router";

type Props = {};

const Workspace = (props: Props) => {
    let ThemedColor = useThemeColor();
    const { categories, selected, showConfetti } = useTasks();
    const { applyFilters } = useWorkspaceFilters(selected);
    const { getStateDescription } = useWorkspaceState(selected);
    const insets = useSafeAreaInsets();
    const { openModal } = useCreateModal();
    const { spotlightState, setSpotlightShown } = useSpotlight();

    const [editing, setEditing] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState(false);
    const [focusedCategory, setFocusedCategory] = useState<string>("");
    const [isHeaderSticky, setIsHeaderSticky] = useState(false);

    const drawerRef = useRef<DrawerLayout>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const noCategories = categories.filter((category) => category.name !== "!-proxy-!").length == 0;
    const { setIsDrawerOpen } = useDrawer();

    const handleScroll = (event: any) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        // Adjust this threshold based on when you want the header to become sticky
        const stickyThreshold = 100; // Adjust this value as needed
        setIsHeaderSticky(scrollY > stickyThreshold);
    };

    // Tour steps for workspace
    const tourSteps: TourStep[] = [
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Workspace Settings ⚙️"
                    description="Tap the icon next to the workspace title to edit workspace settings, reorder categories, or delete the workspace."
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown("workspaceSpotlight");
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Tasks ✅"
                    description="This is a task! The colored bar on the left shows its priority. Tap on any task to view or edit its details."
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown("workspaceSpotlight");
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Categories 📂"
                    description="To make new tasks, click on a category name. Categories help you organize tasks by type or project!"
                    onNext={() => {
                        setSpotlightShown("workspaceSpotlight");
                        next();
                    }}
                    isLastStep
                />
            ),
        },
    ];

    return (
        <SpotlightTourProvider steps={tourSteps} motion={SPOTLIGHT_MOTION}>
            <WorkspaceContent
                drawerRef={drawerRef}
                scrollViewRef={scrollViewRef}
                ThemedColor={ThemedColor}
                categories={categories}
                selected={selected}
                showConfetti={showConfetti}
                insets={insets}
                openModal={openModal}
                editing={editing}
                setEditing={setEditing}
                editingWorkspace={editingWorkspace}
                setEditingWorkspace={setEditingWorkspace}
                focusedCategory={focusedCategory}
                setFocusedCategory={setFocusedCategory}
                isHeaderSticky={isHeaderSticky}
                noCategories={noCategories}
                setIsDrawerOpen={setIsDrawerOpen}
                handleScroll={handleScroll}
                spotlightState={spotlightState}
                applyFilters={applyFilters}
                workspaceStateDescription={getStateDescription()}
            />
        </SpotlightTourProvider>
    );
};

const WorkspaceContent = ({
    drawerRef,
    scrollViewRef,
    ThemedColor,
    categories,
    selected,
    showConfetti,
    insets,
    openModal,
    editing,
    setEditing,
    editingWorkspace,
    setEditingWorkspace,
    focusedCategory,
    setFocusedCategory,
    isHeaderSticky,
    noCategories,
    setIsDrawerOpen,
    handleScroll,
    spotlightState,
    applyFilters,
    workspaceStateDescription,
}: any) => {
    const { start } = useSpotlightTour();
    const pathname = usePathname();

    useEffect(() => {
        // Only trigger workspace spotlight if:
        // 1. We're in the Kindred Guide workspace
        // 2. Haven't shown workspace spotlight yet
        // 3. Menu spotlight is complete
        // 4. We're on the correct route (not feed or other screens)
        const isWorkspaceRoute = pathname === "/(logged-in)/(tabs)/(task)" || 
                                pathname.includes("/(logged-in)/(tabs)/(task)/workspace");
        
        if (selected === "🌺 Kindred Guide" && 
            !spotlightState.workspaceSpotlight && 
            spotlightState.menuSpotlight &&
            isWorkspaceRoute) {
            // 1 second delay to ensure:
            // - Page has fully loaded and rendered
            // - Drawer close animation is complete
            // - AsyncStorage state has been saved
            const timer = setTimeout(() => {
                start();
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [start, selected, spotlightState.workspaceSpotlight, spotlightState.menuSpotlight, pathname]);

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
            <ConditionalView condition={showConfetti}>
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10,
                        height: Dimensions.get("screen").height,
                    }}>
                    <ConfettiCannon
                        count={50}
                        origin={{
                            x: Dimensions.get("screen").width / 2,
                            y: (Dimensions.get("screen").height / 4) * 3.7,
                        }}
                        fallSpeed={1200}
                        explosionSpeed={300}
                        fadeOut={true}
                    />
                </View>
            </ConditionalView>
            <EditCategory editing={editing} setEditing={setEditing} id={focusedCategory} />
            <EditWorkspace 
                editing={editingWorkspace} 
                setEditing={setEditingWorkspace} 
                id={selected} 
            />

            {/* Sticky Header - Only shows when scrolled */}
            <ConditionalView condition={isHeaderSticky && selected !== ""}>
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        backgroundColor: ThemedColor.background,
                        paddingHorizontal: HORIZONTAL_PADDING,
                        paddingTop: insets.top,
                        paddingBottom: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: ThemedColor.lightened,
                    }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <SlidingText type="title" style={styles.title}>
                            {selected}
                        </SlidingText>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                            <TouchableOpacity onPress={() => setEditingWorkspace(true)}>
                                <Ionicons name="settings-outline" size={24} color={ThemedColor.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ConditionalView>

            <ThemedView style={{ flex: 1 }}>
                {/* Scrollable Content */}
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingBottom: Dimensions.get("screen").height * 0.12 }}>
                    {/* Header Section - Scrolls with content initially */}
                    <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: insets.top }}>
                        <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                            <Feather name="menu" size={24} color={ThemedColor.caption} />
                        </TouchableOpacity>

                        <ConditionalView condition={selected !== ""} animated={true} triggerDep={selected}>
                            <View style={styles.headerContainer}>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        paddingBottom: 16,
                                        width: "100%",
                                    }}>
                                    <AttachStep index={0} style={{ width: "100%" }}>
                                        <SlidingText type="title" style={styles.title}>
                                            {selected || "Good Morning! ☀"}
                                        </SlidingText>
                                    </AttachStep>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                                        <TouchableOpacity onPress={() => setEditingWorkspace(true)}>
                                            <Ionicons
                                                name="settings-outline"
                                                size={24}
                                                color={ThemedColor.text}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                                    {workspaceStateDescription}
                                </ThemedText>
                            </View>
                        </ConditionalView>
                    </View>

                    {/* Content */}
                    <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
                        <ConditionalView
                            condition={selected !== "" && noCategories}
                            animated={true}
                            triggerDep={selected}
                            style={{ height: "100%", marginTop: 8 }}>
                            <View style={{ flex: 1, alignItems: "flex-start", gap: 16, marginTop: 8 }}>
                                <ThemedText type="lightBody">This workspace is empty!</ThemedText>
                                <TouchableOpacity
                                    onPress={() => openModal()}
                                    style={[styles.addButton, { backgroundColor: ThemedColor.lightened }]}>
                                    <ThemedText type="defaultSemiBold">+</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </ConditionalView>

                        <ConditionalView
                            condition={selected !== "" && !noCategories}
                            animated={true}
                            triggerDep={selected}>
                            <View style={styles.categoriesContainer} key="cateogry-container">
                                {categories
                                    .sort((a, b) => b.tasks.length - a.tasks.length)
                                    .filter((category) => category.name !== "!-proxy-!")
                                    .map((category, index) => {
                                        // Highlight first category header (step 2) and first task (step 1)
                                        const isFirstCategory = index === 0 && category.tasks.length > 0;

                                        // Apply filters to category tasks
                                        const filteredTasks = applyFilters(category.tasks);

                                        return (
                                            <Category
                                                key={category.id + category.name}
                                                id={category.id}
                                                name={category.name}
                                                tasks={filteredTasks}
                                                onLongPress={(categoryId) => {
                                                    setEditing(true);
                                                    setFocusedCategory(categoryId);
                                                }}
                                                onPress={(categoryId) => {
                                                    openModal();
                                                    setFocusedCategory(categoryId);
                                                }}
                                                highlightFirstTask={isFirstCategory}
                                                highlightCategoryHeader={isFirstCategory}
                                            />
                                        );
                                    })}
                                <TouchableOpacity
                                    onPress={() => openModal()}
                                    style={[styles.addButton, { backgroundColor: ThemedColor.lightened }]}>
                                    <ThemedText type="defaultSemiBold">+</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </ConditionalView>
                    </View>
                </ScrollView>
            </ThemedView>
        </DrawerLayout>
    );
};

export default Workspace;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: Dimensions.get("screen").height * 0.12,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
        paddingRight: HORIZONTAL_PADDING,
    },
    title: {
        fontWeight: "600",
        width: "100%",
    },
    categoriesContainer: {
        gap: 16,
        marginTop: 0,
    },
    addButton: {
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        paddingVertical: 12,
        borderRadius: 12,
    },
});
