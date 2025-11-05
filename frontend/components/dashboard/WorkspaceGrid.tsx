import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "moti/skeleton";
import ConditionalView from "@/components/ui/ConditionalView";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { CaretRight, CaretDown, ArrowRight } from "phosphor-react-native";
import { useTasks } from "@/contexts/tasksContext";
import { MotiView, AnimatePresence } from "moti";
import { useRouter } from "expo-router";

interface Workspace {
    name: string;
}

interface WorkspaceGridProps {
    workspaces: Workspace[];
    displayWorkspaces: Workspace[];
    fetchingWorkspaces: boolean;
    onWorkspacePress: (workspaceName: string) => void;
    onCategoryPress?: (workspaceName: string, categoryId: string) => void;
    ThemedColor: any;
}

export const WorkspaceGrid: React.FC<WorkspaceGridProps> = ({
    workspaces,
    displayWorkspaces,
    fetchingWorkspaces,
    onWorkspacePress,
    onCategoryPress,
    ThemedColor,
}) => {
    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const router = useRouter();

    const { workspaces: allWorkspaces } = useTasks();

    const toggleWorkspace = (workspaceName: string) => {
        const newExpanded = new Set(expandedWorkspaces);

        if (newExpanded.has(workspaceName)) {
            newExpanded.delete(workspaceName);
        } else {
            newExpanded.add(workspaceName);
        }

        setExpandedWorkspaces(newExpanded);
    };

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);

        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }

        setExpandedCategories(newExpanded);
    };

    const handleCategoryPress = (workspaceName: string, categoryId: string) => {
        onWorkspacePress(workspaceName);
        onCategoryPress?.(workspaceName, categoryId);
    };

    const handleTaskPress = (task: any, categoryId: string) => {
        router.push({
            pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
            params: {
                id: task.id,
                categoryId: categoryId,
                name: task.content,
            },
        });
    };

    const getWorkspaceData = (workspaceName: string) => {
        const workspace = allWorkspaces.find((ws) => ws.name === workspaceName);
        return workspace ? workspace.categories : [];
    };

    return (
        <>
            <ConditionalView condition={workspaces.length > 0} key="workspaces-container">
                <View style={styles.workspacesContainer}>
                    <Skeleton.Group key="workspaces-skeleton" show={fetchingWorkspaces}>
                        {displayWorkspaces.map((workspace) => {
                            const categories = getWorkspaceData(workspace.name);
                            const isExpanded = expandedWorkspaces.has(workspace.name);
                            const validCategories = categories?.filter((cat: any) => cat.name !== "!-proxy-!") || [];

                            return (
                                <Skeleton
                                    key={workspace.name}
                                    colors={[ThemedColor.lightened, ThemedColor.lightened + "50"]}>
                                    <View style={styles.workspaceWrapper}>
                                        <WorkspaceCard
                                            workspace={workspace}
                                            isExpanded={isExpanded}
                                            onToggle={() => toggleWorkspace(workspace.name)}
                                            onPress={() => onWorkspacePress(workspace.name)}
                                            ThemedColor={ThemedColor}
                                        />

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <MotiView
                                                    from={{
                                                        opacity: 0,
                                                        maxHeight: 0,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        maxHeight: 5000,
                                                    }}
                                                    exit={{
                                                        opacity: 0,
                                                        maxHeight: 0,
                                                    }}
                                                    transition={{
                                                        type: "timing",
                                                        duration: 200,
                                                    }}
                                                    style={[styles.categoriesContainer, { overflow: "hidden" }]}>
                                                    {categories && categories.length > 0 ? (
                                                        validCategories.length > 0 ? (
                                                            validCategories.map((category: any) => {
                                                                const hasTasks =
                                                                    category.tasks && category.tasks.length > 0;
                                                                const isCategoryExpanded = expandedCategories.has(
                                                                    category.id
                                                                );

                                                                return (
                                                                    <View key={category.id}>
                                                                        <View style={styles.categoryRow}>
                                                                            <TouchableOpacity
                                                                                onPress={() =>
                                                                                    toggleCategory(category.id)
                                                                                }
                                                                                style={styles.categoryCaretButton}>
                                                                                {isCategoryExpanded ? (
                                                                                    <CaretDown
                                                                                        size={16}
                                                                                        color={ThemedColor.caption}
                                                                                    />
                                                                                ) : (
                                                                                    <CaretRight
                                                                                        size={16}
                                                                                        color={ThemedColor.caption}
                                                                                    />
                                                                                )}
                                                                            </TouchableOpacity>

                                                                            <TouchableOpacity
                                                                                style={styles.categoryContent}
                                                                                onPress={() =>
                                                                                    handleCategoryPress(
                                                                                        workspace.name,
                                                                                        category.id
                                                                                    )
                                                                                }>
                                                                                <ThemedText type="larger_default">
                                                                                    {category.name}
                                                                                </ThemedText>
                                                                            </TouchableOpacity>
                                                                        </View>

                                                                        <AnimatePresence>
                                                                            {isCategoryExpanded && (
                                                                                <MotiView
                                                                                    from={{
                                                                                        opacity: 0,
                                                                                        maxHeight: 0,
                                                                                    }}
                                                                                    animate={{
                                                                                        opacity: 1,
                                                                                        maxHeight: 2000,
                                                                                    }}
                                                                                    exit={{
                                                                                        opacity: 0,
                                                                                        maxHeight: 0,
                                                                                    }}
                                                                                    transition={{
                                                                                        type: "timing",
                                                                                        duration: 150,
                                                                                    }}
                                                                                    style={{ overflow: "hidden" }}>
                                                                                    <View style={styles.tasksContainer}>
                                                                                        {hasTasks ? (
                                                                                            category.tasks.map(
                                                                                                (task: any) => (
                                                                                                    <TouchableOpacity
                                                                                                        key={task.id}
                                                                                                        style={
                                                                                                            styles.taskItem
                                                                                                        }
                                                                                                        onPress={() =>
                                                                                                            handleTaskPress(
                                                                                                                task,
                                                                                                                category.id
                                                                                                            )
                                                                                                        }>
                                                                                                        <ArrowRight
                                                                                                            size={12}
                                                                                                            color={
                                                                                                                ThemedColor.caption
                                                                                                            }
                                                                                                            style={
                                                                                                                styles.taskArrow
                                                                                                            }
                                                                                                        />
                                                                                                        <ThemedText
                                                                                                            type="larger_default_light"
                                                                                                            style={
                                                                                                                styles.taskText
                                                                                                            }
                                                                                                            numberOfLines={
                                                                                                                1
                                                                                                            }>
                                                                                                            {task.content ||
                                                                                                                "Untitled task"}
                                                                                                        </ThemedText>
                                                                                                    </TouchableOpacity>
                                                                                                )
                                                                                            )
                                                                                        ) : (
                                                                                            <View
                                                                                                style={
                                                                                                    styles.emptyTasksContainer
                                                                                                }>
                                                                                                <ThemedText
                                                                                                    type="larger_default"
                                                                                                    style={
                                                                                                        styles.emptyText
                                                                                                    }>
                                                                                                    No tasks in this
                                                                                                    category
                                                                                                </ThemedText>
                                                                                            </View>
                                                                                        )}
                                                                                    </View>
                                                                                </MotiView>
                                                                            )}
                                                                        </AnimatePresence>
                                                                    </View>
                                                                );
                                                            })
                                                        ) : // All categories are proxy, so don't show anything
                                                        null
                                                    ) : categories && categories.length === 0 ? (
                                                        // Only show this when there are truly NO categories
                                                        <View style={styles.emptyContainer}>
                                                            <ThemedText type="default" style={styles.emptyText}>
                                                                No categories in this workspace
                                                            </ThemedText>
                                                        </View>
                                                    ) : null}
                                                </MotiView>
                                            )}
                                        </AnimatePresence>
                                    </View>
                                </Skeleton>
                            );
                        })}
                    </Skeleton.Group>
                </View>
            </ConditionalView>
        </>
    );
};

interface WorkspaceCardProps {
    workspace: Workspace;
    isExpanded: boolean;
    onToggle: () => void;
    onPress: () => void;
    ThemedColor: any;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace, isExpanded, onToggle, onPress, ThemedColor }) => {
    return (
        <View style={styles.workspaceCard}>
            <TouchableOpacity onPress={onToggle} style={styles.caretButton}>
                {isExpanded ? (
                    <CaretDown size={16} color={ThemedColor.caption} />
                ) : (
                    <CaretRight size={16} color={ThemedColor.caption} />
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onPress} style={styles.workspaceCardContent}>
                <ThemedText type="larger_default">{workspace.name}</ThemedText>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    workspacesContainer: {
        flexDirection: "column",
        width: "100%",
    },
    workspaceWrapper: {
        width: "100%",
        marginBottom: 4,
    },
    workspaceCard: {
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
    },
    caretButton: {
        marginRight: 8,
    },
    workspaceCardContent: {
        flex: 1,
    },
    categoriesContainer: {
        marginLeft: 15,
    },
    categoryRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
    },
    categoryCaretButton: {
        width: 20,
        marginRight: 4,
    },
    categoryContent: {
        flex: 1,
    },
    tasksContainer: {
        marginLeft: 15,
    },
    taskItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
        paddingLeft: 8,
    },
    taskArrow: {
        marginRight: 8,
    },
    taskText: {
        flex: 1,
    },
    emptyContainer: {
        paddingVertical: 8,
        paddingLeft: 24,
    },
    emptyText: {
        opacity: 0.5,
        fontSize: 13,
    },
    createWorkspaceCard: {
        padding: 16,
        borderRadius: 12,
        width: "100%",
        alignItems: "center",
        marginTop: 12,
    },
    emptyTasksContainer: {
        paddingVertical: 4,
        paddingLeft: 8,
    },
});
