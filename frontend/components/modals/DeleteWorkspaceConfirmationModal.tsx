import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import PrimaryButton from "../inputs/PrimaryButton";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    workspaceName: string;
    onConfirm: () => void;
    onCancel: () => void;
};

const DeleteWorkspaceConfirmationModal = (props: Props) => {
    const { visible, setVisible, workspaceName, onConfirm, onCancel } = props;
    const ThemedColor = useThemeColor();

    const handleConfirm = () => {
        onConfirm();
        // Note: setVisible(false) is now handled in the parent component for optimistic updates
    };

    const handleCancel = () => {
        onCancel();
        setVisible(false);
    };

    return (
        <DefaultModal visible={visible} setVisible={setVisible} snapPoints={["40%"]}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <ThemedText type="title" style={{ marginBottom: 24, fontSize: 32 }}>Delete Workspace</ThemedText>
                    <ThemedText type="defaultSemiBold">
                        Are you sure you want to delete "{workspaceName}"?
                    </ThemedText>
                </View>

                <View style={styles.content}>
                    <ThemedText style={styles.warning}>
                        This action cannot be undone. All categories and tasks in this workspace will be permanently deleted.
                    </ThemedText>
                </View>

                <View style={styles.actions}>
                    <PrimaryButton
                        title="Cancel"
                        outline
                        onPress={handleCancel} />

                    <PrimaryButton
                        title="Delete Workspace"
                        onPress={handleConfirm}
                        style={styles.deleteButton}
                        textStyle={styles.deleteButtonText}
                    />
                </View>
            </View>
        </DefaultModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    header: {
        alignItems: "center",
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 8,
        textAlign: "center",
    },
    subtitle: {
        fontSize: 16,
        textAlign: "center",
        opacity: 0.8,
    },
    content: {
        marginBottom: 32,
    },
    warning: {
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
        opacity: 0.7,
    },
    actions: {
        flexDirection: "column",
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: "600",
    },
    deleteButton: {
        flex: 1,
        backgroundColor: "#ef4444", // Red color for delete action
    },
    deleteButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
    },
});

export default DeleteWorkspaceConfirmationModal; 