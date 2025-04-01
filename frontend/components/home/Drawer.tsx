import { useTasks } from "@/contexts/tasksContext";
import React from "react";
import { View, TouchableOpacity } from "react-native";
import SelectedIndicator from "../SelectedIndicator";
import { ThemedText } from "../ThemedText";
import ThemedColor from "@/constants/Colors";
import { Dimensions, StyleSheet } from "react-native";
import NewWorkspace from "../modals/create/NewWorkspace";
import ConditionalView from "../ui/ConditionalView";
import Modal from "react-native-modal";
import ModalHead from "../modals/ModalHead";
import EditWorkspace from "../modals/edit/EditWorkspace";

export const Drawer = ({ close }) => {
    const { workspaces, selected, setSelected } = useTasks();
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [focusedWorkspace, setFocusedWorkspace] = React.useState<string>("");
    return (
        <View style={styles.drawerContainer}>
            <Modal
                onBackdropPress={() => setCreating(false)}
                onBackButtonPress={() => setCreating(false)}
                isVisible={creating}
                animationIn="slideInUp"
                animationOut="slideOutDown"
                avoidKeyboard>
                <View style={styles.container}>
                    <ModalHead style={{ marginBottom: 16 }} />
                    <NewWorkspace hide={() => setCreating(false)} />
                </View>
            </Modal>
            <EditWorkspace editing={editing} setEditing={setEditing} id={focusedWorkspace} />
            <View style={{ paddingTop: 16, paddingBottom: 16 }}>
                <ThemedText type="title">Workspaces</ThemedText>
            </View>
            <View style={{ width: " 100%" }}>
                {workspaces.map((workspace) => (
                    <TouchableOpacity
                        style={[
                            {
                                paddingVertical: 12,
                                flexDirection: "row",
                                width: "100%",
                                borderRadius: 16,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            },
                            selected == workspace.name ? { backgroundColor: ThemedColor.tertiary } : undefined,
                        ]}
                        onLongPress={() => {
                            setEditing(true);
                            setFocusedWorkspace(workspace.name);
                        }}
                        onPress={() => {
                            setSelected(workspace.name);
                            close();
                        }}
                        key={workspace.name}>
                        <SelectedIndicator selected={selected === workspace.name} />
                        <ThemedText type="default" key={workspace.name}>
                            {workspace.name}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity style={{ paddingTop: 16, paddingBottom: 16 }} onPress={() => setCreating(true)}>
                    <ThemedText type="defaultx">+ New Workspace</ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
};
const styles = StyleSheet.create({
    drawerContainer: {
        flex: 1,
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        paddingHorizontal: 24,
        paddingTop: 64,
        backgroundColor: ThemedColor.lightened,
        width: Dimensions.get("screen").width * 0.75,
        zIndex: 80,
    },
    container: {
        flex: 1,
        width: Dimensions.get("screen").width,
        backgroundColor: ThemedColor.background,
        padding: 24,
        gap: 8,
        borderTopRightRadius: 24,
        borderTopLeftRadius: 24,
        bottom: -16,
        left: -24,
        position: "absolute",
    },
});
