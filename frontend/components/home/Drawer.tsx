import { useTasks } from "@/contexts/tasksContext";
import React, { useCallback, useRef } from "react";
import { View, TouchableOpacity, ScrollView, Keyboard, Platform, Image, StyleProp, ViewStyle } from "react-native";
import SelectedIndicator from "../SelectedIndicator";
import { ThemedText } from "../ThemedText";
import { Dimensions, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import EditWorkspace from "../modals/edit/EditWorkspace";
import CreateWorkspaceBottomSheetModal from "../modals/CreateWorkspaceBottomSheetModal";
import QuickImportBottomSheet from "../modals/QuickImportBottomSheet";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import {
    Gear,
    User,
    FileText,
    Archive,
    Plus,
} from "phosphor-react-native";
import { router, usePathname, type Href } from "expo-router";
import { WorkspaceDrawerItem } from "./WorkspaceDrawerItem";
import {
    House,
    Calendar,
    ChartLine,
    Microphone,
    ChatTeardropText,
    BookOpen,
    CalendarBlank,
    DownloadSimple,
    CheckCircle
} from "phosphor-react-native";

export const Drawer = ({ close }) => {
    const ThemedColor = useThemeColor();
    const { workspaces, selected, setSelected } = useTasks();
    const pathname = usePathname();
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [focusedWorkspace, setFocusedWorkspace] = React.useState("");
    const [showQuickImport, setShowQuickImport] = React.useState(false);

    const handleCreateBlueprint = () => {
        close();
        router.push("/blueprint/create");
    };

    return (
        <DrawerContent
            close={close}
            ThemedColor={ThemedColor}
            workspaces={workspaces}
            selected={selected}
            setSelected={setSelected}
            pathname={pathname}
            creating={creating}
            setCreating={setCreating}
            editing={editing}
            setEditing={setEditing}
            focusedWorkspace={focusedWorkspace}
            setFocusedWorkspace={setFocusedWorkspace}
            showQuickImport={showQuickImport}
            setShowQuickImport={setShowQuickImport}
            handleCreateBlueprint={handleCreateBlueprint}
        />
    );
};

const DrawerContent = ({
    close,
    ThemedColor,
    workspaces,
    selected,
    setSelected,
    pathname,
    creating,
    setCreating,
    editing,
    setEditing,
    focusedWorkspace,
    setFocusedWorkspace,
    showQuickImport,
    setShowQuickImport,
    handleCreateBlueprint,
}: any) => {
    const drawerScrollRef = useRef<ScrollView>(null);

    const reopenWorkspaceSettings = useCallback(() => {
        if (editing) {
            setEditing(false);
            setTimeout(() => setEditing(true), 120);
        } else {
            setEditing(true);
        }
    }, [editing, setEditing]);

    // Helper function to determine which drawer item should be selected based on current route
    const getSelectedItem = () => {
        if (pathname.includes("/daily")) return "Today";
        if (pathname.includes("/calendar")) return "Calendar";
        if (pathname.includes("/analytics")) return "Analytics";
        if (pathname.includes("/completed")) return "Completed Tasks";
        if (pathname.includes("/voice")) return "Voice Dump";
        if (pathname === "/(logged-in)/(tabs)/(task)" || pathname === "/") {
            // On home route, use workspace selection
            return selected === "" ? "Home" : selected;
        }
        // For other routes (like workspace view), use workspace selection
        return selected;
    };

    // Helper function to handle smooth navigation
    const handleNavigate = useCallback((route: Href, workspaceName?: string) => {
        close();
        requestAnimationFrame(() => {
            if (workspaceName !== undefined) {
                setSelected(workspaceName);
            }
            router.navigate(route);
        });
    }, [close, setSelected]);

    // Helper for router.push instead of navigate
    const handlePush = useCallback((route: Href) => {
        close();
        requestAnimationFrame(() => {
            router.push(route);
        });
    }, [close]);

    const currentSelected = getSelectedItem();

    return (
        <View style={styles(ThemedColor).drawerContainer}>
            {/* CreateWorkspace Bottom Sheet Modal */}
            <CreateWorkspaceBottomSheetModal visible={creating} setVisible={setCreating} />

            <EditWorkspace editing={editing} setEditing={setEditing} id={focusedWorkspace} />

            {/* Quick Import Bottom Sheet */}
            <QuickImportBottomSheet isVisible={showQuickImport} onClose={() => setShowQuickImport(false)} />

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
                <ThemedText type="subtitle_subtle">v1.0.4</ThemedText>
                {/* <Image source={require("@/assets/images/Checkmark.png")} style={{ width: 32, height: 26 }} /> */}
            </View>

            {/* <TouchableOpacity
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
                    router.push("/(logged-in)/(tabs)/(profile)/settings");
                }}>
                <ThemedText type="default">Settings</ThemedText>
                <Gear size={20} color={ThemedColor.text} weight="regular" />
            </TouchableOpacity> */}
            <DrawerItem
                    title="Home"
                    selected={currentSelected}
                    icon={<House size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)", "")}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Settings"
                    selected={currentSelected}
                    icon={<Gear size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(profile)/settings")}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="New Workspace"
                    selected={currentSelected}
                    icon={<Plus size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => setCreating(true)}
                    onLongPress={() => {}}
                />

            <ScrollView
                ref={drawerScrollRef}
                style={{ width: "100%" }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Dimensions.get("screen").height * 0.2 }}>
                {/* <View
                    style={{
                        paddingHorizontal: HORIZONTAL_PADDING,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}>
                    <House size={16} color={ThemedColor.caption} weight="regular" />
                    <ThemedText type="subtitle_subtle">HOME</ThemedText>
                </View> */}
                {/* <DrawerItem
                    title="Today"
                    selected={currentSelected}
                    icon={<CalendarBlank size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)/daily")}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Text Dump"
                    badge="AI"
                    selected={currentSelected}
                    icon={<ChatTeardropText size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handlePush("/text-dump")}
                    onLongPress={() => {}}
                /> */}
                {/* <DrawerItem
                    title="Import"
                    selected={currentSelected}
                    icon={<DownloadSimple size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => {
                        setShowQuickImport(true);
                    }}
                    onLongPress={() => {}}
                /> */}
                <View style={{ width: "100%" }}>
                    <View
                        style={{
                            paddingHorizontal: HORIZONTAL_PADDING,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                        }}>
                        <User size={16} color={ThemedColor.caption} weight="regular" />
                        <ThemedText type="subtitle_subtle">PERSONAL WORKSPACES</ThemedText>
                    </View>
                    {workspaces
                        .filter((workspace) => !workspace.isBlueprint)
                        .map((workspace) => {
                            const taskCount = workspace.categories.reduce(
                                (total, category) => total + (category.tasks?.filter(task => task.active !== false).length || 0),
                                0
                            );
                            return (
                                <WorkspaceDrawerItem
                                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)", workspace.name)}
                                    onLongPress={() => {
                                        setFocusedWorkspace(workspace.name);
                                        reopenWorkspaceSettings();
                                    }}
                                    key={workspace.name}
                                    title={workspace.name}
                                    selected={currentSelected}
                                    taskCount={taskCount}
                                    workspaceIcon={workspace.icon ?? undefined}
                                    workspaceColor={workspace.color ?? undefined}
                                />
                            );
                        })}
                </View>
                <TouchableOpacity onPress={() => {}}>
                    <View
                        style={{
                            paddingHorizontal: HORIZONTAL_PADDING,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <FileText size={16} color={ThemedColor.caption} weight="regular" />
                            <ThemedText type="subtitle_subtle">BLUEPRINTS</ThemedText>
                        </View>
                    </View>
                </TouchableOpacity>
                {workspaces
                    .filter((workspace) => workspace.isBlueprint)
                    .map((workspace) => (
                        <DrawerItem
                            title={workspace.name}
                            selected={currentSelected}
                            onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)", workspace.name)}
                        onLongPress={() => {
                            setFocusedWorkspace(workspace.name);
                            reopenWorkspaceSettings();
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
                        <Archive size={16} color={ThemedColor.caption} weight="regular" />
                        <ThemedText type="subtitle_subtle">ARCHIVE</ThemedText>
                    </View>
                </View>
                <View style={{}}>
                    <DrawerItem
                        title="Completed Tasks"
                        selected={currentSelected}
                        icon={<CheckCircle size={20} color={ThemedColor.primary} weight="regular" />}
                        onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)/completed")}
                        onLongPress={() => {}}
                    />
                </View>
            </ScrollView>
        </View>
    );
};

type DrawerItemProps = {
    title: string;
    selected: string;
    onPress: () => void;
    onLongPress?: () => void;
    badge?: string;
    icon?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

const DrawerItem = React.memo(({ title, selected, onPress, onLongPress, badge, icon, style }: DrawerItemProps) => {
    const ThemedColor = useThemeColor();
    const isSelected = selected === title;

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
                isSelected ? { backgroundColor: ThemedColor.tertiary } : undefined,
                style,
            ]}
            onPress={onPress}
            onLongPress={onLongPress}
            key={title}>
            <SelectedIndicator selected={isSelected} />
            {icon && (
                <View style={{ width: 20, alignItems: "center" }}>
                    {icon}
                </View>
            )}
            <ThemedText type="default" style={{ fontFamily: "Outfit", fontWeight: "medium" }} key={title}>
                {title}
            </ThemedText>
            {badge && (
                <View
                    style={{
                        backgroundColor: ThemedColor.primary + "20",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 4,
                }}>
                    <ThemedText
                        style={{
                        fontSize: 10,
                            fontWeight: "600",
                        color: ThemedColor.primary,
                    }}>
                        {badge}
                    </ThemedText>
                </View>
            )}
        </TouchableOpacity>
    );
});

// Convert styles to a function to properly access ThemedColor
const styles = (ThemedColor) =>
    StyleSheet.create({
        drawerContainer: {
            flex: 1,
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            paddingTop: 64,
            backgroundColor: ThemedColor.background,
            // Fill the DrawerLayout panel (DRAWER_WIDTH) exactly so the 85% drawer
            // neither peeks past the panel nor leaves a gap inside it.
            width: "100%",
            zIndex: 80,
        },
        bottomSheetContent: {
            flex: 1,
            padding: 24,
            paddingTop: 8,
        },
    });
