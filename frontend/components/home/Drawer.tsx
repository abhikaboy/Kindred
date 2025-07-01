import { useTasks } from "@/contexts/tasksContext";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, TouchableOpacity, ScrollView, Keyboard, Platform, Image } from "react-native";
import SelectedIndicator from "../SelectedIndicator";
import { ThemedText } from "../ThemedText";
import { Dimensions, StyleSheet } from "react-native";
import NewWorkspace from "../modals/create/NewWorkspace";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import EditWorkspace from "../modals/edit/EditWorkspace";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import AntDesign from "@expo/vector-icons/AntDesign";
import Ionicons from "@expo/vector-icons/Ionicons";

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

            <View
                style={{
                    paddingTop: 16,
                    paddingBottom: 16,
                    paddingHorizontal: HORIZONTAL_PADDING,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                }}>
                <TouchableOpacity
                    onPress={() => {
                        setSelected("");
                        close();
                    }}>
                    <ThemedText type="title">kindred</ThemedText>
                </TouchableOpacity>
                <ThemedText type="subtitle_subtle">v0.1.0</ThemedText>
                {/* <Image source={require("@/assets/images/Checkmark.png")} style={{ width: 32, height: 26 }} /> */}
            </View>
            <TouchableOpacity
                style={{
                    paddingTop: 4,
                    width: "100%",
                    paddingBottom: 16,
                    marginBottom: Dimensions.get("screen").height * 0.01,
                    paddingHorizontal: HORIZONTAL_PADDING,
                    borderTopWidth: 0,
                    borderWidth: 2,
                    borderColor: ThemedColor.tertiary,
                }}
                onPress={() => setCreating(true)}>
                <ThemedText type="default">+ New Workspace</ThemedText>
            </TouchableOpacity>

            <ScrollView
                style={{ width: "100%" }}
                contentContainerStyle={{ paddingBottom: Dimensions.get("screen").height * 0.2 }}>
                <View
                    style={{
                        paddingHorizontal: HORIZONTAL_PADDING,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}>
                    <Ionicons name="home" size={16} color={ThemedColor.caption} />
                    <ThemedText type="subtitle_subtle">HOME</ThemedText>
                </View>
                <DrawerItem
                    title="Home"
                    selected={selected == "" ? "Home" : selected}
                    onPress={() => {
                        setSelected("");
                        close();
                    }}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Today"
                    selected={selected}
                    onPress={() => {
                        setSelected("Today");
                        close();
                    }}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Upcoming"
                    selected={selected}
                    onPress={() => {
                        setSelected("");
                        close();
                    }}
                    onLongPress={() => {}}
                />
                <View
                    style={{
                        paddingHorizontal: HORIZONTAL_PADDING,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}>
                    <Ionicons name="person" size={16} color={ThemedColor.caption} />
                    <ThemedText type="subtitle_subtle">PERSONAL WORKSPACES</ThemedText>
                </View>
                {workspaces.map((workspace) => (
                    <DrawerItem
                        onPress={() => {
                            setSelected(workspace.name);
                            close();
                        }}
                        onLongPress={() => {
                            setFocusedWorkspace(workspace.name);
                            setEditing(true);
                        }}
                        key={workspace.name}
                        title={workspace.name}
                        selected={selected}
                    />
                ))}
                <TouchableOpacity onPress={() => {}}>
                    <View
                        style={{
                            paddingHorizontal: HORIZONTAL_PADDING,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Ionicons name="document-text" size={16} color={ThemedColor.caption} />
                            <ThemedText type="subtitle_subtle">BLUEPRINTS</ThemedText>
                        </View>
                        <AntDesign name="question" size={20} color={ThemedColor.caption} />
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{
                        paddingVertical: 12,
                        flexDirection: "row",
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        paddingHorizontal: HORIZONTAL_PADDING,
                        gap: 8,
                    }}
                    onPress={() => {}}>
                    <ThemedText type="default">+ Build a Blueprint</ThemedText>
                </TouchableOpacity>
                <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="archive" size={16} color={ThemedColor.caption} />
                        <ThemedText type="subtitle_subtle">ARCHIVE</ThemedText>
                    </View>
                </View>
                <View style={{}}>
                    <DrawerItem
                        title="Completed Tasks"
                        selected={selected}
                        onPress={() => setSelected("Completed Tasks")}
                        onLongPress={() => {}}
                    />
                </View>
            </ScrollView>
        </View>
    );
};

const DrawerItem = ({ title, selected, onPress, onLongPress }) => {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            style={[
                {
                    paddingVertical: 12,
                    flexDirection: "row",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    paddingHorizontal: HORIZONTAL_PADDING,
                    gap: 8,
                },
                selected == title ? { backgroundColor: ThemedColor.tertiary } : undefined,
            ]}
            onPress={onPress}
            onLongPress={onLongPress}
            key={title}>
            <SelectedIndicator selected={selected === title} />
            <ThemedText type="default" style={{ fontFamily: "Outfit", fontWeight: "medium" }} key={title}>
                {title}
            </ThemedText>
        </TouchableOpacity>
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
