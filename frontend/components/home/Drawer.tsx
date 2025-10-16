import { useTasks } from "@/contexts/tasksContext";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, TouchableOpacity, ScrollView, Keyboard, Platform, Image } from "react-native";
import SelectedIndicator from "../SelectedIndicator";
import { ThemedText } from "../ThemedText";
import { Dimensions, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import EditWorkspace from "../modals/edit/EditWorkspace";
import CreateWorkspaceBottomSheetModal from "../modals/CreateWorkspaceBottomSheetModal";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import AntDesign from "@expo/vector-icons/AntDesign";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

export const Drawer = ({ close }) => {
    const ThemedColor = useThemeColor();
    const { workspaces, selected, setSelected } = useTasks();
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [focusedWorkspace, setFocusedWorkspace] = React.useState("");


    const handleCreateBlueprint = () => {
        close();
        router.push("/blueprint/create");
    };

    return (
        <View style={styles(ThemedColor).drawerContainer}>
            {/* CreateWorkspace Bottom Sheet Modal */}
            <CreateWorkspaceBottomSheetModal visible={creating} setVisible={setCreating} />

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
                    paddingTop: 12,
                    width: "100%",
                    paddingBottom: 16,
                    paddingHorizontal: HORIZONTAL_PADDING,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
                onPress={() => {
                    close();
                    router.push("/(logged-in)/(tabs)/(task)/settings");
                }}>
                <ThemedText type="default">Settings</ThemedText>
                <Ionicons name="settings-outline" size={20} color={ThemedColor.text} />
            </TouchableOpacity>
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
                showsVerticalScrollIndicator={false}
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
                        router.navigate("/(logged-in)/(tabs)/(task)");
                        close();
                    }}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Daily"
                    selected={selected}
                    onPress={() => {
                        router.navigate("/(logged-in)/(tabs)/(task)/daily");
                        close();
                    }}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Calendar"
                    selected={selected}
                    onPress={() => {
                        router.navigate("/(logged-in)/(tabs)/(task)/calendar");
                        close();
                    }}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Analytics"
                    selected={selected}
                    onPress={() => {
                        router.navigate("/(logged-in)/(tabs)/(task)/analytics");
                        close();
                    }}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Voice Dump"
                    selected={selected}
                    onPress={() => {
                        router.push("/voice");
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
                {workspaces.filter((workspace) => !workspace.isBlueprint).map((workspace) => (
                    <DrawerItem
                        onPress={() => {
                            setSelected(workspace.name);
                            router.navigate("/(logged-in)/(tabs)/(task)");
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
                {workspaces.filter((workspace) => workspace.isBlueprint).map((workspace) => (
                            <DrawerItem
                                title={workspace.name}
                                selected={selected}
                                onPress={() => {
                                    setSelected(workspace.name);
                                    router.navigate("/(logged-in)/(tabs)/(task)");
                                    close();
                                }}
                                onLongPress={() => {
                                    setFocusedWorkspace(workspace.name);
                                    setEditing(true);
                                }}
                                key={workspace.name}
                            />
                        ))}
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
                    onPress={handleCreateBlueprint}>
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
