import React, { useState, useEffect, useRef } from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import * as PhosphorIcons from "phosphor-react-native";

type PhosphorComponent = React.ComponentType<{ size?: number; weight?: string; color?: string }>;
import { Skeleton } from "moti/skeleton";
import ConditionalView from "@/components/ui/ConditionalView";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { CaretRight, CaretDown } from "phosphor-react-native";
import { useTasks } from "@/contexts/tasksContext";
import { MotiView, AnimatePresence } from "moti";
import WorkspaceTaskPreview from "./WorkspaceTaskPreview";
import { pendingWorkspaceTaskCount } from "@/utils/workspaceCounts";

interface Workspace {
    name: string;
    icon?: string | null;
    color?: string | null;
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

    // Expand each workspace by default the first time it appears, while still
    // letting the user collapse it afterward.
    const defaultedWorkspaces = useRef<Set<string>>(new Set());
    useEffect(() => {
        const unseen = displayWorkspaces.filter((ws) => !defaultedWorkspaces.current.has(ws.name));
        if (unseen.length === 0) return;
        setExpandedWorkspaces((prev) => {
            const next = new Set(prev);
            unseen.forEach((ws) => next.add(ws.name));
            return next;
        });
        unseen.forEach((ws) => defaultedWorkspaces.current.add(ws.name));
    }, [displayWorkspaces]);

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
                            const colorAccent = workspace.color ?? null;
                            const validCategories = categories?.filter((cat: any) => cat.name !== "!-proxy-!") || [];

                            const pendingTaskCount = pendingWorkspaceTaskCount(categories);

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
                                            pendingTaskCount={pendingTaskCount}
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
                                                    style={[
                                                        styles.categoriesContainer,
                                                        { overflow: "hidden" },
                                                        // Same accent as the workspace, on the same left line, at half opacity.
                                                        colorAccent
                                                            ? {
                                                                  marginLeft: 0,
                                                                  paddingLeft: 21,
                                                                  borderLeftWidth: 3,
                                                                  borderLeftColor: colorAccent + "80",
                                                              }
                                                            : undefined,
                                                    ]}>
                                                    <WorkspaceTaskPreview
                                                        categories={validCategories}
                                                        onShowAll={() => onWorkspacePress(workspace.name)}
                                                        ThemedColor={ThemedColor}
                                                    />
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
    pendingTaskCount?: number;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace, isExpanded, onToggle, onPress, ThemedColor, pendingTaskCount }) => {
    const colorAccent = workspace.color ?? null;
    const IconComponent: PhosphorComponent | null = workspace.icon
        ? ((PhosphorIcons as any)[workspace.icon] as PhosphorComponent) ?? null
        : null;

    return (
        <View
            style={[
                styles.workspaceCard,
                colorAccent ? { borderLeftColor: colorAccent, borderLeftWidth: 3, paddingLeft: 8 } : {},
            ]}>
            <TouchableOpacity onPress={onToggle} style={styles.caretButton}>
                {isExpanded ? (
                    <CaretDown size={16} color={ThemedColor.caption} />
                ) : (
                    <CaretRight size={16} color={ThemedColor.caption} />
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onPress} style={styles.workspaceCardContent}>
                <View style={styles.workspaceNameRow}>
                    {IconComponent && colorAccent && (
                        <IconComponent size={16} color={colorAccent} weight="bold" />
                    )}
                    <ThemedText type="larger_default">{workspace.name}</ThemedText>
                </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={onPress} style={styles.workspaceCountButton}>
                {pendingTaskCount != null && (
                    <ThemedText
                        type="caption"
                        style={{ color: pendingTaskCount > 0 ? ThemedColor.primary : ThemedColor.caption }}>
                        {pendingTaskCount}
                    </ThemedText>
                )}
                <CaretRight size={14} color={ThemedColor.caption} style={{ opacity: 0.6 }} />
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
        marginBottom: 2,
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
    workspaceCountButton: {
        marginLeft: "auto",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    workspaceNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    categoriesContainer: {
        // Align category content under the workspace name (caret 16 + margin 8).
        marginLeft: 24,
    },
    previewContainer: {
        gap: 8,
        paddingVertical: 4,
    },
    stack: {
        alignItems: "center",
        gap: 3,
        marginTop: -2,
    },
    stackEdge: {
        height: 10,
        borderRadius: 10,
        borderWidth: 1,
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
});
