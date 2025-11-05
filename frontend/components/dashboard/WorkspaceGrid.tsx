import React from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "moti/skeleton";
import ConditionalView from "@/components/ui/ConditionalView";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

interface Workspace {
    name: string;
    // Add other workspace properties as needed
}

interface WorkspaceGridProps {
    workspaces: Workspace[];
    displayWorkspaces: Workspace[];
    fetchingWorkspaces: boolean;
    onWorkspacePress: (workspaceName: string) => void;
    onCreatePress: () => void;
    ThemedColor: any;
}

export const WorkspaceGrid: React.FC<WorkspaceGridProps> = ({
    workspaces,
    displayWorkspaces,
    fetchingWorkspaces,
    onWorkspacePress,
    onCreatePress,
    ThemedColor,
}) => {
    return (
        <>
            <ConditionalView condition={workspaces.length > 0} key="workspaces-container">
                <View style={styles.workspacesGrid}>
                    <Skeleton.Group key="workspaces-skeleton" show={fetchingWorkspaces}>
                        {displayWorkspaces.map((workspace) => (
                            <Skeleton
                                key={workspace.name}
                                colors={[ThemedColor.lightened, ThemedColor.lightened + "50"]}>
                                <WorkspaceCard
                                    workspace={workspace}
                                    onPress={() => onWorkspacePress(workspace.name)}
                                    ThemedColor={ThemedColor}
                                />
                            </Skeleton>
                        ))}
                    </Skeleton.Group>
                </View>
            </ConditionalView>

            <TouchableOpacity
                onPress={onCreatePress}
                style={[
                    styles.createWorkspaceCard,
                    {
                        backgroundColor: ThemedColor.lightened,
                    },
                ]}>
                <ThemedText type="lightBody">+ Create Workspace</ThemedText>
            </TouchableOpacity>
        </>
    );
};

interface WorkspaceCardProps {
    workspace: Workspace;
    onPress: () => void;
    ThemedColor: any;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace, onPress, ThemedColor }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.workspaceCard,
                {
                    backgroundColor: ThemedColor.lightened,
                    borderColor: "#ffffff08",
                    boxShadow: ThemedColor.shadowSmall,
                },
            ]}>
            <View style={styles.workspaceCardContent}>
                <View style={styles.workspaceCardText}>
                    <ThemedText type="default">{workspace.name}</ThemedText>
                    <ThemedText type="defaultSemiBold">{"→"}</ThemedText>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
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
