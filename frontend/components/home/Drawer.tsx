import { useTasks } from "@/contexts/tasksContext";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, TouchableOpacity, ScrollView, Keyboard, Platform } from "react-native";
import SelectedIndicator from "../SelectedIndicator";
import { ThemedText } from "../ThemedText";
import { Dimensions, StyleSheet } from "react-native";
import NewWorkspace from "../modals/create/NewWorkspace";
import ModalHead from "../modals/ModalHead";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import BottomSheetKeyboardView from "@gorhom/bottom-sheet";
import EditWorkspace from "../modals/edit/EditWorkspace";
import { HORIZONTAL_PADDING } from "@/constants/layout";

export const Drawer = ({ close }) => {
    const ThemedColor = useThemeColor();
    const { workspaces, selected, setSelected } = useTasks();
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [focusedWorkspace, setFocusedWorkspace] = React.useState("");

    // References for bottom sheet modals
    const createWorkspaceSheetRef = useRef<BottomSheetModal>(null);
    const editWorkspaceSheetRef = useRef<BottomSheetModal>(null);

    // Define multiple snap points
    const snapPoints = useMemo(() => ["70%"], []);

    // Listen for keyboard events
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            () => {
                // Move to taller snap point when keyboard appears
                createWorkspaceSheetRef.current?.snapToIndex(1);
            }
        );

        const keyboardDidHideListener = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
            () => {
                // Move back to shorter snap point when keyboard hides
                createWorkspaceSheetRef.current?.snapToIndex(0);
            }
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    // Handle visibility changes for create workspace modal
    React.useEffect(() => {
        if (creating) {
            createWorkspaceSheetRef.current?.present();
        } else {
            createWorkspaceSheetRef.current?.dismiss();
        }
    }, [creating]);

    // Handle visibility changes for edit workspace modal
    React.useEffect(() => {
        if (editing) {
            editWorkspaceSheetRef.current?.present();
        } else {
            editWorkspaceSheetRef.current?.dismiss();
        }
    }, [editing]);

    // Handle sheet changes for create workspace modal
    const handleCreateSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && creating) {
                setCreating(false);
            }
        },
        [creating]
    );

    // Handle sheet changes for edit workspace modal
    const handleEditSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && editing) {
                setEditing(false);
            }
        },
        [editing]
    );

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.8} />
        ),
        []
    );

    return (
        <View style={styles(ThemedColor).drawerContainer}>
            {/* CreateWorkspace Bottom Sheet Modal */}
            <BottomSheetModal
                ref={createWorkspaceSheetRef}
                index={0}
                snapPoints={snapPoints}
                onChange={handleCreateSheetChanges}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}>
                <BottomSheetView
                    style={{
                        paddingHorizontal: 20,
                    }}>
                    <NewWorkspace
                        hide={() => {
                            setCreating(false);
                            createWorkspaceSheetRef.current.dismiss();
                        }}
                    />
                </BottomSheetView>
            </BottomSheetModal>

            <EditWorkspace editing={editing} setEditing={setEditing} id={focusedWorkspace} />

            <View style={{ paddingTop: 16, paddingBottom: 16 }}>
                <ThemedText type="title">Workspaces</ThemedText>
            </View>

            <ScrollView style={{ width: "100%" }}>
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
                            setFocusedWorkspace(workspace.name);
                            setEditing(true);
                        }}
                        onPress={() => {
                            setSelected(workspace.name);
                            close();
                        }}
                        key={workspace.name}>
                        <SelectedIndicator selected={selected === workspace.name} />
                        <ThemedText
                            type="default"
                            style={{ fontFamily: "Outfit", fontWeight: "medium" }}
                            key={workspace.name}>
                            {workspace.name}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    style={{ paddingTop: 16, paddingBottom: Dimensions.get("screen").height * 0.2 }}
                    onPress={() => setCreating(true)}>
                    <ThemedText type="default">+ New Workspace</ThemedText>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

// Convert styles to a function to properly access ThemedColor
const styles = (ThemedColor) =>
    StyleSheet.create({
        drawerContainer: {
            flex: 1,
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingTop: 64,
            backgroundColor: ThemedColor.lightened,
            width: Dimensions.get("screen").width * 0.75,
            zIndex: 80,
        },
        bottomSheetContent: {
            flex: 1,
            padding: 24,
            paddingTop: 8,
        },
    });
