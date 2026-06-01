import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity, LayoutAnimation, UIManager, Platform } from "react-native";
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
import ConditionalView from "@/components/ui/ConditionalView";
import SlidingText from "@/components/ui/SlidingText";
import { Gear, FolderPlus, CheckSquare } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/modals/CreateModal";
import { useWorkspaceFilters } from "@/hooks/useWorkspaceFilters";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { workspaceStateEvents } from "@/utils/workspaceStateEvents";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { FunnelSimple, SortAscending, CalendarBlank } from "phosphor-react-native";
import * as PhosphorIcons from "phosphor-react-native";
import Feather from "@expo/vector-icons/Feather";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import InlineCategoryCreator from "@/components/InlineCategoryCreator";
import { UpcomingCategory } from "@/components/UpcomingCategory";
import { OpenTasksCategory } from "@/components/OpenTasksCategory";
import { DragProvider, useDrag, useDragOptional } from "@/contexts/dragContext";

/**
 * While a task is being dragged, scroll the workspace when the finger nears the
 * top/bottom edge so off-screen categories can be reached. Mounted inside
 * DragProvider so it can read drag state. EDGE/STEP tuned for feel during QA.
 */
const DragAutoScroll = ({
    scrollViewRef,
    scrollOffsetRef,
}: {
    scrollViewRef: React.RefObject<ScrollView>;
    scrollOffsetRef: React.MutableRefObject<number>;
}) => {
    const { isDragging, fingerY } = useDrag();
    useEffect(() => {
        if (!isDragging) return;
        const screenH = Dimensions.get("window").height;
        const EDGE = 120;
        const STEP = 24;
        const interval = setInterval(() => {
            const y = fingerY.value;
            if (y < EDGE) {
                scrollViewRef.current?.scrollTo({ y: Math.max(0, scrollOffsetRef.current - STEP), animated: false });
            } else if (y > screenH - EDGE) {
                scrollViewRef.current?.scrollTo({ y: scrollOffsetRef.current + STEP, animated: false });
            }
        }, 16);
        return () => clearInterval(interval);
    }, [isDragging, fingerY, scrollViewRef, scrollOffsetRef]);
    return null;
};

interface WorkspaceContentProps {
    workspaceName?: string; // Optional: if not provided, uses global selected
}

/**
 * WorkspaceContent - Displays workspace categories and tasks
 * Extracted content component with/ drawer wrapper
 */
export const WorkspaceContent: React.FC<WorkspaceContentProps> = ({ workspaceName }) => {
    return (
        <DragProvider>
            <WorkspaceContentBody workspaceName={workspaceName} />
        </DragProvider>
    );
};

type WorkspaceContentBodyProps = WorkspaceContentProps;

const WorkspaceContentBody: React.FC<WorkspaceContentBodyProps> = ({
    workspaceName,
}) => {
    const ThemedColor = useThemeColor();
    const { workspaces, categories: globalCategories, selected: globalSelected, getWorkspace } = useTasks();
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
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const startCreatingCategory = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsCreatingCategory(true);
        setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 50);
    };
    const stopCreatingCategory = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsCreatingCategory(false);
    };
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
            workspaceStateEvents.emit(selected);
        } catch (error) {
            console.error("Error saving workspace grouping:", error);
        }
    };

    const scrollViewRef = useRef<ScrollView>(null);
    const scrollOffsetRef = useRef(0);
    const isDragging = useDragOptional()?.isDragging ?? false;
    const noCategories = categories.filter((category) => category.name !== "!-proxy-!").length == 0;

    useEffect(() => {
        setIsCreatingCategory(false);
    }, [selected]);

    const upcomingCategory = categories.find((c) => c.id.startsWith("upcoming-"));
    const visibleCategories = categories
        .filter((category) => category.name !== "!-proxy-!" && !category.id.startsWith("upcoming-"))
        .sort((a, b) => b.tasks.length - a.tasks.length);
    const firstCategory = visibleCategories[0];
    const firstCategoryWithTasks = visibleCategories.find((category) => category.tasks.length > 0);
    const groupByDay = state.groupByDay;

    const openTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const result: { task: any; categoryId: string }[] = [];
        visibleCategories.forEach((category) => {
            category.tasks.forEach((task) => {
                if (!task.startDate) return;
                const taskStartDate = new Date(task.startDate);
                taskStartDate.setHours(0, 0, 0, 0);
                if (taskStartDate < today && !task.deadline) {
                    result.push({ task, categoryId: category.id });
                }
            });
        });
        return result;
    }, [visibleCategories]);

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
            <EditCategory editing={editing} setEditing={setEditing} id={focusedCategory} />
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
                    onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
                    scrollEventThrottle={16}
                    scrollEnabled={!isDragging}
                    contentContainerStyle={{ paddingBottom: Dimensions.get("screen").height * 0.12 }}>
                    {/* Header Section - Scrolls with content initially */}
                    <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: insets.top + 40 }}>
                        <ConditionalView condition={selected !== ""} animated={true}>
                            <View style={styles.headerContainer}>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        paddingBottom: 16,
                                        width: "100%",
                                    }}>
                                    <TouchableOpacity
                                        style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, alignSelf: "flex-start" }}
                                        onLongPress={reopenWorkspaceSettings}
                                        activeOpacity={1}
                                    >
                                        <ThemedText type="title" style={styles.title}>
                                            {selected || "Good Morning! ☀"}
                                        </ThemedText>
                                    </TouchableOpacity>
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
                            style={{ height: "100%", marginTop: 8 }}>
                            <View style={styles.emptyOnboarding}>
                                <ThemedText type="subheading" style={styles.emptyHeading}>
                                    Get Started
                                </ThemedText>
                                <ThemedText type="caption" style={styles.emptySubtitle}>
                                    This workspace is empty. Here's how to set it up:
                                </ThemedText>

                                <View style={styles.timeline}>
                                    {/* Step 1 */}
                                    <View style={styles.timelineStep}>
                                        <View style={styles.timelineTrack}>
                                            <View style={[styles.emptyStepBadge, { backgroundColor: ThemedColor.primary }]}>
                                                <ThemedText type="smallerDefault" style={{ color: "#fff" }}>1</ThemedText>
                                            </View>
                                            <View style={[styles.timelineConnector, { backgroundColor: ThemedColor.tertiary }]} />
                                        </View>
                                        <View style={styles.timelineContent}>
                                            <ThemedText type="defaultSemiBold">Create a Category</ThemedText>
                                            <ThemedText type="captionLight" style={styles.emptyStepDesc}>
                                                Organize your tasks into categories like "Work", "Health", or "Personal".
                                            </ThemedText>
                                            <TouchableOpacity
                                                style={[styles.emptyStepBtn, { backgroundColor: ThemedColor.primary, alignSelf: "flex-start" }]}
                                                onPress={() => openModal({ screen: Screen.NEW_CATEGORY })}
                                                activeOpacity={0.7}>
                                                <FolderPlus size={16} color="#fff" weight="regular" />
                                                <ThemedText type="smallerDefault" style={{ color: "#fff" }}>
                                                    New Category
                                                </ThemedText>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Step 2 */}
                                    <View style={styles.timelineStep}>
                                        <View style={styles.timelineTrack}>
                                            <View style={[styles.emptyStepBadge, { backgroundColor: ThemedColor.primary }]}>
                                                <ThemedText type="smallerDefault" style={{ color: "#fff" }}>2</ThemedText>
                                            </View>
                                        </View>
                                        <View style={styles.timelineContent}>
                                            <ThemedText type="defaultSemiBold">Add Your First Task</ThemedText>
                                            <ThemedText type="captionLight" style={styles.emptyStepDesc}>
                                                Tap on a category to start adding tasks and building your routine.
                                            </ThemedText>
                                            <TouchableOpacity
                                                style={[styles.emptyStepBtn, { borderColor: ThemedColor.tertiary, borderWidth: 1, alignSelf: "flex-start" }]}
                                                onPress={() => openModal()}
                                                activeOpacity={0.7}>
                                                <CheckSquare size={16} color={ThemedColor.text} weight="regular" />
                                                <ThemedText type="smallerDefault">
                                                    New Task
                                                </ThemedText>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </ConditionalView>

                        <ConditionalView condition={selected !== "" && !noCategories} animated={true}>
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
                                    {isCreatingCategory && (
                                        <InlineCategoryCreator
                                            onCreated={() => stopCreatingCategory()}
                                            onCancel={() => stopCreatingCategory()}
                                        />
                                    )}
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
                                                    tags={category.tags}
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
                                    {openTasks.length > 0 && (
                                        <OpenTasksCategory tasks={openTasks} />
                                    )}
                                    {upcomingCategory && upcomingCategory.tasks.length > 0 && (
                                        <UpcomingCategory
                                            tasks={upcomingCategory.tasks}
                                            categoryId={upcomingCategory.id}
                                        />
                                    )}
                                    {!isCreatingCategory && (
                                        <TouchableOpacity
                                            onPress={startCreatingCategory}
                                            style={{ alignSelf: "center", paddingVertical: 8}}
                                            activeOpacity={0.6}
                                        >
                                            <ThemedText type="default" style={{ color: ThemedColor.caption}}>
                                                + Add Category
                                            </ThemedText>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </ConditionalView>
                    </View>
                </ScrollView>
            </ThemedView>
            <DragAutoScroll scrollViewRef={scrollViewRef} scrollOffsetRef={scrollOffsetRef} />
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
        paddingTop: 16,
        paddingBottom: 8,
    },
    emptyHeading: {
        textAlign: "left",
    },
    emptySubtitle: {
        textAlign: "left",
        marginTop: 6,
        marginBottom: 28,
    },
    timeline: {
        gap: 12,
    },
    timelineStep: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    timelineTrack: {
        alignItems: "center",
        width: 30,
        marginRight: 16,
    },
    timelineConnector: {
        width: 2,
        flex: 1,
        marginTop: 8,
        marginBottom: 0,
        borderRadius: 1,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 32,
        paddingTop: 4,
        alignItems: "flex-start",
    },
    emptyStepBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyStepDesc: {
        marginTop: 4,
        marginBottom: 16,
    },
    emptyStepBtn: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 24,
    },
});
