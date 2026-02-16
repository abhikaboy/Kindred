import React, { useState, useRef, useEffect } from "react";
import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTasks } from "@/contexts/tasksContext";
import EditCategory from "@/components/modals/edit/EditCategory";
import EditWorkspace from "@/components/modals/edit/EditWorkspace";
import { useCreateModal } from "@/contexts/createModalContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Category } from "@/components/category";
import ConfettiCannon from "react-native-confetti-cannon";
import ConditionalView from "@/components/ui/ConditionalView";
import SlidingText from "@/components/ui/SlidingText";
import { Gear } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep } from "react-native-spotlight-tour";
import { useSpotlight } from "@/contexts/SpotlightContext";
import { TourStepCard } from "@/components/spotlight/TourStepCard";
import { SPOTLIGHT_MOTION } from "@/constants/spotlightConfig";
import { useWorkspaceFilters } from "@/hooks/useWorkspaceFilters";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";

interface WorkspaceContentProps {
    workspaceName?: string; // Optional: if not provided, uses global selected
}

/**
 * WorkspaceContent - Displays workspace categories and tasks
 * Extracted content component with/ drawer wrapper
 */
export const WorkspaceContent: React.FC<WorkspaceContentProps> = ({ workspaceName }) => {
    const ThemedColor = useThemeColor();
    const { categories, selected: globalSelected, showConfetti } = useTasks();
    // Use prop if provided, otherwise fall back to global selected
    const selected = workspaceName || globalSelected;
    const { applyFilters } = useWorkspaceFilters(selected);
    const { getStateDescription } = useWorkspaceState(selected);
    const insets = useSafeAreaInsets();
    const { openModal } = useCreateModal();
    const { spotlightState, setSpotlightShown } = useSpotlight();

    const [editing, setEditing] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState(false);
    const [focusedCategory, setFocusedCategory] = useState<string>("");

    const scrollViewRef = useRef<ScrollView>(null);
    const noCategories = categories.filter((category) => category.name !== "!-proxy-!").length == 0;

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

    const { start } = useSpotlightTour();
    const hasTriggeredRef = useRef(false);
    const workspaceSpotlightShown = spotlightState.workspaceSpotlight;
    const menuSpotlightShown = spotlightState.menuSpotlight;

    // Reset trigger ref when workspace changes
    useEffect(() => {
        hasTriggeredRef.current = false;
    }, [selected]);

    useEffect(() => {
        if (hasTriggeredRef.current) return;

        const shouldTrigger =
            selected === "🌺 Kindred Guide" && !workspaceSpotlightShown && menuSpotlightShown;

        if (shouldTrigger && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            // Increased delay to ensure drawer is fully closed and workspace is mounted
            setTimeout(() => {
                start();
            }, 1200);
        }
    }, [workspaceSpotlightShown, menuSpotlightShown, selected, start]);

    return (
        <SpotlightTourProvider steps={tourSteps} motion={SPOTLIGHT_MOTION}>
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
            {editingWorkspace && (
                <EditWorkspace editing={editingWorkspace} setEditing={setEditingWorkspace} id={selected} />
            )}

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
                                    <AttachStep index={0} style={{ width: "100%" }}>
                                        <SlidingText type="title" style={styles.title}>
                                            {selected || "Good Morning! ☀"}
                                        </SlidingText>
                                    </AttachStep>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                                        <TouchableOpacity onPress={() => setEditingWorkspace(true)}>
                                            <Gear size={24} color={ThemedColor.text} weight="regular" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                                    {getStateDescription()}
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
                                <PrimaryButton
                                    title="+"
                                    onPress={() => openModal()}
                                />
                            </View>
                        </ConditionalView>

                        <ConditionalView condition={selected !== "" && !noCategories} animated={true} triggerDep={selected}>
                            <View style={styles.categoriesContainer} key="category-container">
                                {categories
                                    .sort((a, b) => b.tasks.length - a.tasks.length)
                                    .filter((category) => category.name !== "!-proxy-!")
                                    .map((category, index) => {
                                        const isFirstCategory = index === 0 && category.tasks.length > 0;
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
                                                highlightFirstTask={isFirstCategory}
                                                highlightCategoryHeader={isFirstCategory}
                                            />
                                        );
                                    })}
                                <PrimaryButton
                                    title="+ Add Task"
                                    ghost
                                    onPress={() => {
                                        // Use the first available category if no category is focused
                                        const firstCategory = categories.filter((c) => c.name !== "!-proxy-!")[0];
                                        if (firstCategory) {
                                            openModal({ categoryId: firstCategory.id });
                                        } else {
                                            openModal();
                                        }
                                    }}
                                />
                            </View>
                        </ConditionalView>
                    </View>
                </ScrollView>
            </ThemedView>
        </SpotlightTourProvider>
    );
};

const styles = StyleSheet.create({
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
