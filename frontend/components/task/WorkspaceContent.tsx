import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTasks } from "@/contexts/tasksContext";
import EditCategory from "@/components/modals/edit/EditCategory";
import EditWorkspace from "@/components/modals/edit/EditWorkspace";
import { useCreateModal } from "@/contexts/createModalContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Category } from "@/components/category";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { Task } from "@/api/types";
import ConfettiCannon from "react-native-confetti-cannon";
import ConditionalView from "@/components/ui/ConditionalView";
import SlidingText from "@/components/ui/SlidingText";
import { Gear, FolderPlus, CheckSquare } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/modals/CreateModal";
import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep } from "react-native-spotlight-tour";
import { useSpotlight } from "@/contexts/SpotlightContext";
import { TourStepCard } from "@/components/spotlight/TourStepCard";
import { SPOTLIGHT_MOTION } from "@/constants/spotlightConfig";
import { useWorkspaceFilters } from "@/hooks/useWorkspaceFilters";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { FunnelSimple, SortAscending, CalendarBlank } from "phosphor-react-native";
import * as PhosphorIcons from "phosphor-react-native";
import Feather from "@expo/vector-icons/Feather";

interface WorkspaceContentProps {
    workspaceName?: string; // Optional: if not provided, uses global selected
}

/**
 * WorkspaceContent - Displays workspace categories and tasks
 * Extracted content component with/ drawer wrapper
 */
export const WorkspaceContent: React.FC<WorkspaceContentProps> = ({ workspaceName }) => {
    const { spotlightState, setSpotlightShown, isLoading: spotlightLoading } = useSpotlight();

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
            <WorkspaceContentBody
                workspaceName={workspaceName}
                spotlightState={spotlightState}
                spotlightLoading={spotlightLoading}
            />
        </SpotlightTourProvider>
    );
};

type WorkspaceContentBodyProps = WorkspaceContentProps & {
    spotlightState: any;
    spotlightLoading: boolean;
};

const WorkspaceContentBody: React.FC<WorkspaceContentBodyProps> = ({
    workspaceName,
    spotlightState,
    spotlightLoading,
}) => {
    const ThemedColor = useThemeColor();
    const { workspaces, categories: globalCategories, selected: globalSelected, showConfetti, getWorkspace } = useTasks();
    // Use prop if provided, otherwise fall back to global selected
    const selected = workspaceName || globalSelected;
    const currentWorkspace = selected ? getWorkspace(selected) : undefined;
    const WorkspaceIconComponent = currentWorkspace?.icon
        ? ((PhosphorIcons as any)[currentWorkspace.icon] as React.ComponentType<{ size?: number; color?: string; weight?: string }> | undefined)
        : undefined;
    // When workspaceName prop is provided, derive categories directly from workspaces
    // to avoid depending on the global categories state (which is tied to globalSelected).
    const categories = workspaceName
        ? (workspaces.find((ws) => ws.name === workspaceName)?.categories ?? globalCategories)
        : globalCategories;
    const { applyFilters } = useWorkspaceFilters(selected);
    const { getStateDescription, state } = useWorkspaceState(selected);
    const insets = useSafeAreaInsets();
    const { openModal } = useCreateModal();

    const [editing, setEditing] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState(false);
    const [focusedCategory, setFocusedCategory] = useState<string>("");
    const [workspaceAction, setWorkspaceAction] = useState<"sort" | "filter" | "group" | null>(null);
    const reopenWorkspaceSettings = () => {
        if (editingWorkspace) {
            setEditingWorkspace(false);
            setTimeout(() => setEditingWorkspace(true), 120);
        } else {
            setEditingWorkspace(true);
        }
    };
    const requestWorkspaceAction = (action: "sort" | "filter") => {
        setWorkspaceAction(action);
        if (editingWorkspace) {
            setEditingWorkspace(false);
            setTimeout(() => setEditingWorkspace(true), 120);
        } else {
            setEditingWorkspace(true);
        }
    };

    const toggleGroupByDay = async () => {
        const newValue = !state.groupByDay;
        try {
            await AsyncStorage.setItem(`workspace-group-${selected}`, newValue ? "day" : "none");
        } catch (error) {
            console.error("Error saving workspace grouping:", error);
        }
    };

    const scrollViewRef = useRef<ScrollView>(null);
    const workspaceStep0Ref = useRef<View>(null);
    const workspaceLayoutRef = useRef<{ y: number; height: number } | null>(null);
    const noCategories = categories.filter((category) => category.name !== "!-proxy-!").length == 0;

    const { start } = useSpotlightTour();
    const hasTriggeredRef = useRef(false);
    const workspaceSpotlightShown = spotlightState.workspaceSpotlight;
    const menuSpotlightShown = spotlightState.menuSpotlight;

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
        scrollRef?: React.RefObject<ScrollView>,
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

    // Reset trigger ref when workspace changes
    useEffect(() => {
        hasTriggeredRef.current = false;
    }, [selected]);

    useEffect(() => {
        if (hasTriggeredRef.current) return;

        const shouldTrigger =
            selected === "🌺 Kindred Guide" && !workspaceSpotlightShown && menuSpotlightShown;

        if (!spotlightLoading && shouldTrigger && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            // Increased delay to ensure drawer is fully closed and workspace is mounted
            setTimeout(async () => {
                const canStart = await ensureVisible(
                    workspaceStep0Ref,
                    scrollViewRef,
                    workspaceLayoutRef.current || undefined
                );
                if (canStart) {
                    requestAnimationFrame(() => {
                        start();
                    });
                }
            }, 1200);
        }
    }, [workspaceSpotlightShown, menuSpotlightShown, selected, start, spotlightLoading]);

    const visibleCategories = categories
        .filter((category) => category.name !== "!-proxy-!")
        .sort((a, b) => b.tasks.length - a.tasks.length);
    const firstCategory = visibleCategories[0];
    const firstCategoryWithTasks = visibleCategories.find((category) => category.tasks.length > 0);
    const groupByDay = state.groupByDay;

    const groupedByDay = useMemo(() => {
        if (!groupByDay) return [];

        const groups = new Map<
            string,
            {
                key: string;
                label: string;
                date: Date | null;
                tasks: { task: Task; categoryId: string; categoryName: string }[];
            }
        >();

        const getLabel = (date: Date) => {
            if (isToday(date)) return "Today";
            if (isTomorrow(date)) return "Tomorrow";
            return format(date, "EEE, MMM d");
        };

        visibleCategories.forEach((category) => {
            const filteredTasks = applyFilters(category.tasks);
            filteredTasks.forEach((task) => {
                const dateValue = task.startDate || task.deadline;
                let key = "no-date";
                let date: Date | null = null;
                let label = "No Date";

                if (dateValue) {
                    try {
                        const parsed = parseISO(dateValue);
                        key = format(parsed, "yyyy-MM-dd");
                        date = parsed;
                        label = getLabel(parsed);
                    } catch (error) {
                        console.error("Error parsing task date for grouping:", error);
                    }
                }

                if (!groups.has(key)) {
                    groups.set(key, { key, label, date, tasks: [] });
                }

                groups.get(key)!.tasks.push({
                    task,
                    categoryId: category.id,
                    categoryName: category.name,
                });
            });
        });

        const result = Array.from(groups.values());
        result.sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return a.date.getTime() - b.date.getTime();
        });

        return result;
    }, [applyFilters, groupByDay, visibleCategories]);

    return (
        <>
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
            {editing && (
                <EditCategory editing={editing} setEditing={setEditing} id={focusedCategory} />
            )}
            <EditWorkspace
                editing={editingWorkspace}
                setEditing={setEditingWorkspace}
                id={selected}
                actionRequest={workspaceAction}
                onActionHandled={() => setWorkspaceAction(null)}
                skipMenu={workspaceAction !== null}
            />

            <ThemedView style={{ flex: 1 }}>
                {/* Scrollable Content */}
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: Dimensions.get("screen").height * 0.12 }}>
                    {/* Header Section - Scrolls with content initially */}
                    <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: insets.top + 40 }}>
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
                                    <AttachStep index={0} style={{ flex: 1, alignItems: "flex-start" }}>
                                        <TouchableOpacity
                                            ref={workspaceStep0Ref}
                                            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                                            onLongPress={reopenWorkspaceSettings}
                                            activeOpacity={1}
                                        >
                                            <ThemedText type="title" style={styles.title}>
                                                {selected || "Good Morning! ☀"}
                                            </ThemedText>
                                        </TouchableOpacity>
                                    </AttachStep>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <ThemedText type="lightBody" style={{ color: ThemedColor.caption, flex: 1 }}>
                                        {getStateDescription()}
                                    </ThemedText>
                                    <View style={styles.quickActionsRow}>
                                        <TouchableOpacity
                                            onPress={() => requestWorkspaceAction("filter")}
                                        >
                                            <FunnelSimple size={20} color={state.filters !== null ? ThemedColor.primary : ThemedColor.caption} weight="regular" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => requestWorkspaceAction("sort")}
                                        >
                                            <SortAscending size={20} color={state.sort !== null ? ThemedColor.primary : ThemedColor.caption} weight="regular" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={toggleGroupByDay}
                                        >
                                            <CalendarBlank size={20} color={state.groupByDay ? ThemedColor.primary : ThemedColor.caption} weight="regular" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={reopenWorkspaceSettings}>
                                            <Gear size={24} color={ThemedColor.text} weight="regular" />
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
                            <View style={styles.emptyOnboarding}>
                                <ThemedText type="subheading" style={styles.emptyHeading}>
                                    Get Started
                                </ThemedText>
                                <ThemedText type="caption" style={styles.emptySubtitle}>
                                    This workspace is empty.{"\n"}Here's how to set it up:
                                </ThemedText>
                                <View style={[styles.emptyDivider, { backgroundColor: ThemedColor.tertiary }]} />

                                <View style={styles.emptyStep}>
                                    <View style={[styles.emptyStepBadge, { backgroundColor: ThemedColor.primary }]}>
                                        <ThemedText type="smallerDefault" style={{ color: "#fff" }}>1</ThemedText>
                                    </View>
                                    <ThemedText type="defaultSemiBold">Create a Category</ThemedText>
                                    <ThemedText type="captionLight" style={styles.emptyStepDesc}>
                                        Organize your tasks into categories like "Work", "Health", or "Personal".
                                    </ThemedText>
                                    <TouchableOpacity
                                        style={[styles.emptyStepBtn, { backgroundColor: ThemedColor.primary }]}
                                        onPress={() => openModal({ screen: Screen.NEW_CATEGORY })}
                                        activeOpacity={0.7}>
                                        <FolderPlus size={16} color="#fff" weight="regular" />
                                        <ThemedText type="smallerDefault" style={{ color: "#fff" }}>
                                            New Category
                                        </ThemedText>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.emptyStep}>
                                    <View style={[styles.emptyStepBadge, { backgroundColor: ThemedColor.primary }]}>
                                        <ThemedText type="smallerDefault" style={{ color: "#fff" }}>2</ThemedText>
                                    </View>
                                    <ThemedText type="defaultSemiBold">Add Your First Task</ThemedText>
                                    <ThemedText type="captionLight" style={styles.emptyStepDesc}>
                                        Tap on a category to start adding tasks and building your routine.
                                    </ThemedText>
                                    <TouchableOpacity
                                        style={[styles.emptyStepBtn, { borderColor: ThemedColor.tertiary, borderWidth: 1 }]}
                                        onPress={() => openModal()}
                                        activeOpacity={0.7}>
                                        <CheckSquare size={16} color={ThemedColor.text} weight="regular" />
                                        <ThemedText type="smallerDefault">
                                            New Task
                                        </ThemedText>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ConditionalView>

                        <ConditionalView condition={selected !== "" && !noCategories} animated={true} triggerDep={selected}>
                            {groupByDay ? (
                                <View style={styles.categoriesContainer} key="grouped-container">
                                    {groupedByDay.length === 0 ? (
                                        <View style={{ flex: 1, alignItems: "flex-start", gap: 16, marginTop: 8 }}>
                                            <ThemedText type="lightBody">No tasks match your filters.</ThemedText>
                                        </View>
                                    ) : (
                                        groupedByDay.map((group) => (
                                            <View key={group.key} style={styles.groupSection}>
                                                <ThemedText type="subtitle">{group.label}</ThemedText>
                                                <View style={{ gap: 12 }}>
                                                    {group.tasks.map(({ task, categoryId, categoryName }) => (
                                                        <SwipableTaskCard
                                                            key={`${task.id}-${categoryId}`}
                                                            redirect={true}
                                                            categoryId={categoryId}
                                                            categoryName={categoryName}
                                                            task={task}
                                                        />
                                                    ))}
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            ) : (
                                <View style={styles.categoriesContainer} key="category-container">
                                    {visibleCategories.map((category) => {
                                            const isFirstCategory = firstCategory?.id === category.id;
                                            const isFirstCategoryWithTasks = firstCategoryWithTasks?.id === category.id;
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
                                                        setFocusedCategory(categoryId);
                                                        openModal({ categoryId });
                                                    }}
                                                    highlightFirstTask={isFirstCategoryWithTasks}
                                                    highlightCategoryHeader={isFirstCategory}
                                                />
                                            );
                                        })}
                                </View>
                            )}
                        </ConditionalView>
                    </View>
                </ScrollView>
            </ThemedView>
        </>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
        // paddingRight: HORIZONTAL_PADDING,
    },
    title: {
        fontWeight: "600",
    },
    categoriesContainer: {
        gap: 16,
        marginTop: 0,
    },
    groupSection: {
        gap: 12,
    },
    quickActionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginLeft: 12,
    },
    addButton: {
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyOnboarding: {
        alignItems: "center",
        paddingTop: 16,
        paddingBottom: 8,
    },
    emptyHeading: {
        textAlign: "center",
    },
    emptySubtitle: {
        textAlign: "center",
        marginTop: 6,
    },
    emptyDivider: {
        height: StyleSheet.hairlineWidth,
        width: "80%",
        marginVertical: 24,
    },
    emptyStep: {
        alignItems: "center",
        marginBottom: 28,
        width: "100%",
    },
    emptyStepBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
    },
    emptyStepDesc: {
        textAlign: "center",
        maxWidth: 280,
        marginTop: 2,
        marginBottom: 14,
    },
    emptyStepBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 24,
    },
});
