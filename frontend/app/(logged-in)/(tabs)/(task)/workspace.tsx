import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity } from "react-native";
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTasks } from "@/contexts/tasksContext";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import EditCategory from "@/components/modals/edit/EditCategory";
import { useCreateModal } from "@/contexts/createModalContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Category } from "@/components/category";
import ConfettiCannon from "react-native-confetti-cannon";
import ConditionalView from "@/components/ui/ConditionalView";
import SlidingText from "@/components/ui/SlidingText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EditWorkspace from "@/components/modals/edit/EditWorkspace";
import { useDrawer } from "@/contexts/drawerContext";
import { useWorkspaceFilters } from "@/hooks/useWorkspaceFilters";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { usePathname } from "expo-router";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import InlineCategoryCreator from "@/components/InlineCategoryCreator";
import { UpcomingCategory } from "@/components/UpcomingCategory";
import { OpenTasksCategory } from "@/components/OpenTasksCategory";
import { FunnelSimple, SortAscending, CalendarBlank } from "phosphor-react-native";
import * as PhosphorIcons from "phosphor-react-native";
import { DragProvider, useDrag, useDragOptional } from "@/contexts/dragContext";

type Props = {};

/**
 * While a task is being dragged, scroll the workspace when the finger nears the
 * top/bottom edge so off-screen categories can be reached. EDGE/STEP are tuned
 * for feel during QA. Mounted inside DragProvider so it can read drag state.
 */
const DragAutoScroll = ({
    scrollViewRef,
    scrollOffsetRef,
}: {
    scrollViewRef: React.RefObject<ScrollView>;
    scrollOffsetRef: React.MutableRefObject<number>;
}) => {
    const { isDragging, fingerX, fingerY, setScrollOffset, updateDrag } = useDrag();
    useEffect(() => {
        if (!isDragging) return;
        const screenH = Dimensions.get("window").height;
        const EDGE = 120;
        const STEP = 24;
        const interval = setInterval(() => {
            const y = fingerY.value;
            let next: number | null = null;
            if (y < EDGE) {
                next = Math.max(0, scrollOffsetRef.current - STEP);
            } else if (y > screenH - EDGE) {
                next = scrollOffsetRef.current + STEP;
            }
            if (next === null) return;
            scrollOffsetRef.current = next;
            // Keep hit-testing in sync with the programmatic scroll, and refresh
            // the hovered category even though the finger itself is stationary.
            setScrollOffset(next);
            scrollViewRef.current?.scrollTo({ y: next, animated: false });
            updateDrag(fingerX.value, fingerY.value);
        }, 16);
        return () => clearInterval(interval);
    }, [isDragging, fingerX, fingerY, scrollViewRef, scrollOffsetRef, setScrollOffset, updateDrag]);
    return null;
};

const Workspace = (props: Props) => {
    let ThemedColor = useThemeColor();
    const { categories, selected, showConfetti, getWorkspace } = useTasks();
    const { applyFilters } = useWorkspaceFilters(selected);
    const { getStateDescription, state: workspaceState } = useWorkspaceState(selected);
    const insets = useSafeAreaInsets();
    const { openModal } = useCreateModal();

    const [editing, setEditing] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState(false);
    const [focusedCategory, setFocusedCategory] = useState<string>("");
    const [workspaceAction, setWorkspaceAction] = useState<"sort" | "filter" | "group" | null>(null);
    const reopenWorkspaceSettings = useCallback(() => {
        if (editingWorkspace) {
            setEditingWorkspace(false);
            setTimeout(() => setEditingWorkspace(true), 120);
        } else {
            setEditingWorkspace(true);
        }
    }, [editingWorkspace]);
    const requestWorkspaceAction = useCallback((action: "sort" | "filter" | "group") => {
        setWorkspaceAction(action);
        if (editingWorkspace) {
            setEditingWorkspace(false);
            setTimeout(() => setEditingWorkspace(true), 120);
        } else {
            setEditingWorkspace(true);
        }
    }, [editingWorkspace]);
    const [isHeaderSticky, setIsHeaderSticky] = useState(false);

    const drawerRef = useRef<DrawerLayout>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const scrollOffsetRef = useRef(0);
    const noCategories = categories.filter((category) => category.name !== "!-proxy-!").length == 0;
    const { setIsDrawerOpen } = useDrawer();

    const handleScroll = (event: any) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        scrollOffsetRef.current = scrollY;
        // Adjust this threshold based on when you want the header to become sticky
        const stickyThreshold = 100; // Adjust this value as needed
        setIsHeaderSticky(scrollY > stickyThreshold);
    };

    const currentWorkspace = selected ? getWorkspace(selected) : null;
    const workspaceIcon = currentWorkspace?.icon ?? undefined;
    const workspaceColor = currentWorkspace?.color ?? undefined;

    return (
        <DragProvider>
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
            applyFilters={applyFilters}
            workspaceStateDescription={getStateDescription()}
            workspaceState={workspaceState}
            workspaceIcon={workspaceIcon}
            workspaceColor={workspaceColor}
            reopenWorkspaceSettings={reopenWorkspaceSettings}
            requestWorkspaceAction={requestWorkspaceAction}
            workspaceAction={workspaceAction}
            setWorkspaceAction={setWorkspaceAction}
            />
            <DragAutoScroll scrollViewRef={scrollViewRef} scrollOffsetRef={scrollOffsetRef} />
        </DragProvider>
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
    applyFilters,
    workspaceStateDescription,
    workspaceState,
    workspaceIcon,
    workspaceColor,
    reopenWorkspaceSettings,
    requestWorkspaceAction,
    workspaceAction,
    setWorkspaceAction,
}: any) => {
    const pathname = usePathname();
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const drag = useDragOptional();

    const { getWorkspace } = useTasks();
    const currentWorkspace = selected ? getWorkspace(selected) : undefined;
    const resolvedIcon = currentWorkspace?.icon ?? workspaceIcon;
    const resolvedColor = currentWorkspace?.color ?? workspaceColor;

    const WorkspaceIconComponent = resolvedIcon
        ? ((PhosphorIcons as any)[resolvedIcon] as React.ComponentType<{ size?: number; color?: string; weight?: string }> | undefined)
        : undefined;

    useEffect(() => {
        setIsCreatingCategory(false);
    }, [selected]);

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
            {editingWorkspace && (
                <EditWorkspace
                    editing={editingWorkspace}
                    setEditing={setEditingWorkspace}
                    id={selected}
                    actionRequest={workspaceAction}
                    onActionHandled={() => setWorkspaceAction(null)}
                />
            )}

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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                            {WorkspaceIconComponent ? (
                                <WorkspaceIconComponent size={24} color={resolvedColor ?? ThemedColor.primary} weight="regular" />
                            ) : (
                                <Feather name="grid" size={24} color={ThemedColor.caption} />
                            )}
                            <View style={{ flex: 1 }}>
                                <SlidingText type="title" style={styles.title}>
                                    {selected}
                                </SlidingText>
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                            <TouchableOpacity onPress={reopenWorkspaceSettings}>
                                <Ionicons name="settings-outline" size={24} color={ThemedColor.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.quickActionsRow}>
                        <TouchableOpacity
                            onPress={() => requestWorkspaceAction("filter")}
                            style={styles.quickActionButton}
                        >
                            <FunnelSimple size={12} color={workspaceState?.filters !== null ? ThemedColor.primary : ThemedColor.caption} weight={workspaceState?.filters !== null ? "fill" : "regular"} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => requestWorkspaceAction("sort")}
                            style={styles.quickActionButton}
                        >
                            <SortAscending size={12} color={workspaceState?.sort !== null ? ThemedColor.primary : ThemedColor.caption} weight={workspaceState?.sort !== null ? "fill" : "regular"} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => requestWorkspaceAction("group")}
                            style={styles.quickActionButton}
                        >
                            <CalendarBlank size={12} color={workspaceState?.groupByDay ? ThemedColor.primary : ThemedColor.caption} weight={workspaceState?.groupByDay ? "fill" : "regular"} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ConditionalView>

            <ThemedView style={{ flex: 1 }}>
                {/* Scrollable Content */}
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    onScroll={(e) => {
                        handleScroll(e);
                        drag?.setScrollOffset(e.nativeEvent.contentOffset.y);
                    }}
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
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                                        {WorkspaceIconComponent ? (
                                            <WorkspaceIconComponent size={28} color={resolvedColor ?? ThemedColor.primary} weight="regular" />
                                        ) : (
                                            <Feather name="grid" size={28} color={ThemedColor.caption} />
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <SlidingText type="title" style={styles.title}>
                                                {selected || "Good Morning! ☀"}
                                            </SlidingText>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                                        <TouchableOpacity onPress={reopenWorkspaceSettings}>
                                            <Ionicons
                                                name="settings-outline"
                                                size={24}
                                                color={ThemedColor.text}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <ThemedText type="lightBody" style={{ color: ThemedColor.caption, flex: 1 }}>
                                        {workspaceStateDescription}
                                    </ThemedText>
                                    <View style={styles.quickActionsRow}>
                                        <TouchableOpacity
                                            onPress={() => requestWorkspaceAction("filter")}
                                            style={styles.quickActionButton}
                                        >
                                            <FunnelSimple size={12} color={workspaceState?.filters !== null ? ThemedColor.primary : ThemedColor.caption} weight={workspaceState?.filters !== null ? "fill" : "regular"} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => requestWorkspaceAction("sort")}
                                            style={styles.quickActionButton}
                                        >
                                            <SortAscending size={12} color={workspaceState?.sort !== null ? ThemedColor.primary : ThemedColor.caption} weight={workspaceState?.sort !== null ? "fill" : "regular"} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => requestWorkspaceAction("group")}
                                            style={styles.quickActionButton}
                                        >
                                            <CalendarBlank size={12} color={workspaceState?.groupByDay ? ThemedColor.primary : ThemedColor.caption} weight={workspaceState?.groupByDay ? "fill" : "regular"} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
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
                                {isCreatingCategory ? (
                                    <InlineCategoryCreator
                                        onCreated={() => setIsCreatingCategory(false)}
                                        onCancel={() => setIsCreatingCategory(false)}
                                    />
                                ) : (
                                    <>
                                        <ThemedText type="lightBody">This workspace is empty!</ThemedText>
                                        <PrimaryButton
                                            title="+ Add Category"
                                            lightened
                                            onPress={() => setIsCreatingCategory(true)}
                                        />
                                    </>
                                )}
                            </View>
                        </ConditionalView>

                        <ConditionalView
                            condition={selected !== "" && !noCategories}
                            animated={true}
                            triggerDep={selected}>
                            <View style={styles.categoriesContainer} key="category-container">
                                {isCreatingCategory && (
                                    <InlineCategoryCreator
                                        onCreated={() => setIsCreatingCategory(false)}
                                        onCancel={() => setIsCreatingCategory(false)}
                                    />
                                )}
                                {(() => {
                                    const upcomingCat = categories.find((c) => c.id.startsWith("upcoming-"));
                                    const visible = [...categories]
                                        .filter((c) => c.name !== "!-proxy-!" && !c.id.startsWith("upcoming-"))
                                        .sort((a, b) => b.tasks.length - a.tasks.length);
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const openTasksList: { task: any; categoryId: string }[] = [];
                                    visible.forEach((category) => {
                                        category.tasks.forEach((task) => {
                                            if (!task.startDate) return;
                                            const taskStartDate = new Date(task.startDate);
                                            taskStartDate.setHours(0, 0, 0, 0);
                                            if (taskStartDate < today && !task.deadline) {
                                                openTasksList.push({ task, categoryId: category.id });
                                            }
                                        });
                                    });
                                    return (
                                        <>
                                            {visible.map((category, index) => {
                                                const isFirstCategory = index === 0 && category.tasks.length > 0;
                                                const filteredTasks = applyFilters(category.tasks);
                                                return (
                                                    <Category
                                                        key={category.id + category.name}
                                                        id={category.id}
                                                        name={category.name}
                                                        tasks={filteredTasks}
                                                        tags={category.tags}
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
                                            {openTasksList.length > 0 && (
                                                <OpenTasksCategory tasks={openTasksList} />
                                            )}
                                            {upcomingCat && upcomingCat.tasks.length > 0 && (
                                                <UpcomingCategory
                                                    tasks={upcomingCat.tasks}
                                                    categoryId={upcomingCat.id}
                                                />
                                            )}
                                        </>
                                    );
                                })()}
                                {!isCreatingCategory && (
                                    <PrimaryButton
                                        title="+ Add Category"
                                        lightened
                                        onPress={() => setIsCreatingCategory(true)}
                                        style={{ alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 }}
                                        textStyle={{ fontSize: 13 }}
                                    />
                                )}
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
        flex: 1,
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
    quickActionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginLeft: 12,
    },
    quickActionButton: {
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
});
