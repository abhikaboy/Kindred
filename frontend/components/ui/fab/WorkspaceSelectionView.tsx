import React from "react";
import { Animated, View, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from "react-native";
import { ArrowLeft } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Workspace {
    name: string;
    isBlueprint?: boolean;
}

interface WorkspaceSelectionViewProps {
    workspaces: Workspace[];
    selectedWorkspace: string;
    opacity: Animated.Value;
    onBackPress: () => void;
    onWorkspaceSelect: (workspaceName: string) => void;
    onLayout: (event: any) => void;
}

export const WorkspaceSelectionView: React.FC<WorkspaceSelectionViewProps> = ({
    workspaces,
    selectedWorkspace,
    opacity,
    onBackPress,
    onWorkspaceSelect,
    onLayout,
}) => {
    const ThemedColor = useThemeColor();
    const filteredWorkspaces = workspaces.filter((workspace) => !workspace.isBlueprint);
    const hasWorkspaces = filteredWorkspaces.length > 0;

    return (
        <Animated.View
            style={[styles.menuSection, { opacity }]}
            onLayout={onLayout}
        >
            <View style={styles.workspaceHeader}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        onPress={onBackPress}
                        style={styles.backButton}
                    >
                        <ArrowLeft size={20} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>
                    <View style={styles.headerText}>
                        <ThemedText type="defaultSemiBold">
                            Select Workspace
                        </ThemedText>
                        <ThemedText type="caption" style={styles.headerCaption}>
                            Choose where to create your task
                        </ThemedText>
                    </View>
                </View>
            </View>

            {hasWorkspaces ? (
                <ScrollView
                    style={styles.workspaceList}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.workspaceListContent}
                >
                    {filteredWorkspaces.map((workspace) => (
                        <TouchableOpacity
                            key={workspace.name}
                            style={[
                                styles.workspaceItem,
                                {
                                    backgroundColor:
                                        selectedWorkspace === workspace.name
                                            ? ThemedColor.lightened
                                            : "transparent",
                                    borderWidth: 1,
                                    borderColor: ThemedColor.lightened,
                                },
                            ]}
                            onPress={() => onWorkspaceSelect(workspace.name)}
                        >
                            <ThemedText type="default">{workspace.name}</ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            ) : (
                <View style={styles.emptyState}>
                    <ThemedText type="default" style={styles.emptyText}>
                        No workspaces yet
                    </ThemedText>
                    <ThemedText type="caption" style={styles.emptyCaption}>
                        Create one to start organizing tasks
                    </ThemedText>
                </View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    menuSection: {
        padding: 8,
    },
    workspaceHeader: {
        padding: 16,
        paddingBottom: 12,
    },
    headerContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    backButton: {
        padding: 4,
    },
    headerText: {
        flex: 1,
    },
    headerCaption: {
        marginTop: 4,
        fontSize: 14,
    },
    workspaceList: {
        maxHeight: SCREEN_HEIGHT * 0.5,
        paddingHorizontal: 8,
    },
    workspaceListContent: {
        paddingBottom: 8,
    },
    emptyState: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 6,
    },
    emptyText: {
        opacity: 0.7,
    },
    emptyCaption: {
        opacity: 0.6,
    },
    workspaceItem: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 4,
        paddingVertical: 20,
        gap: 4,
    },
});
