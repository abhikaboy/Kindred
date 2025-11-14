import { useTasks } from "@/contexts/tasksContext";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, TouchableOpacity, ScrollView, Keyboard, Platform, Image } from "react-native";
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
    Archive 
} from "phosphor-react-native";
import { router, usePathname } from "expo-router";
import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep } from "react-native-spotlight-tour";
import { useSpotlight } from "@/contexts/SpotlightContext";
import { TourStepCard } from "@/components/spotlight/TourStepCard";
import { SPOTLIGHT_MOTION } from "@/constants/spotlightConfig";
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
    const { spotlightState, setSpotlightShown } = useSpotlight();

    const handleCreateBlueprint = () => {
        close();
        router.push("/blueprint/create");
    };

    // Tour steps for drawer
    const tourSteps: TourStep[] = [
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Workspaces 📚"
                    description="Kindred organizes lists into workspaces. Each workspace can have multiple categories and tasks."
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown("menuSpotlight");
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="New Workspace ✨"
                    description="The new workspace button is at the top. Tap here to create a new workspace anytime!"
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown("menuSpotlight");
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Your Workspaces 📝"
                    description="Current workspaces can be found in 'Personal Workspaces' below. Tap any workspace to view its tasks."
                    onNext={() => {
                        // Immediately update state (synchronous - no waiting needed)
                        setSpotlightShown("menuSpotlight");

                        // Find and navigate to Kindred Guide workspace
                        const kindredGuide = workspaces.find((w) => w.name === "🌺 Kindred Guide");
                        if (kindredGuide) {
                            setSelected("🌺 Kindred Guide");
                            close();
                        }

                        next();
                    }}
                    isLastStep
                />
            ),
        },
    ];

    return (
        <SpotlightTourProvider steps={tourSteps} motion={SPOTLIGHT_MOTION}>
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
                spotlightState={spotlightState}
            />
        </SpotlightTourProvider>
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
    spotlightState,
}: any) => {
    const { start } = useSpotlightTour();

    // Helper function to determine which drawer item should be selected based on current route
    const getSelectedItem = () => {
        if (pathname.includes("/daily")) return "Daily";
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
    const handleNavigate = useCallback((route: any, workspaceName?: string) => {
        close();
        requestAnimationFrame(() => {
            if (workspaceName !== undefined) {
                setSelected(workspaceName);
            }
            router.navigate(route as any);
        });
    }, [close, setSelected]);

    // Helper for router.push instead of navigate
    const handlePush = useCallback((route: any) => {
        close();
        requestAnimationFrame(() => {
            router.push(route as any);
        });
    }, [close]);

    const currentSelected = getSelectedItem();

    useEffect(() => {
        // Only start the tour if:
        // 1. We haven't shown the menu spotlight yet
        // 2. The home spotlight has been completed (so the drawer was opened from the home tour)
        if (!spotlightState.menuSpotlight && spotlightState.homeSpotlight) {
            // Increased delay to 800ms to allow drawer animation to complete
            const timer = setTimeout(() => {
                start();
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [start, spotlightState.menuSpotlight, spotlightState.homeSpotlight]);

    return (
        <View style={styles(ThemedColor).drawerContainer}>
            {/* CreateWorkspace Bottom Sheet Modal */}
            <CreateWorkspaceBottomSheetModal visible={creating} setVisible={setCreating} />

            <EditWorkspace editing={editing} setEditing={setEditing} id={focusedWorkspace} />

            {/* Quick Import Bottom Sheet */}
            <QuickImportBottomSheet isVisible={showQuickImport} onClose={() => setShowQuickImport(false)} />

            <AttachStep index={0}>
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
            </AttachStep>
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
                <Gear size={20} color={ThemedColor.text} weight="regular" />
            </TouchableOpacity>
            <AttachStep index={1} style={{ width: "100%" }}>
                <TouchableOpacity
                    style={{
                        paddingTop: 4,
                        width: "100%",
                        paddingBottom: 16,
                        marginBottom: Dimensions.get("screen").height * 0.01,
                        paddingHorizontal: HORIZONTAL_PADDING,
                        borderTopWidth: 0,
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                    }}
                    onPress={() => setCreating(true)}>
                    <ThemedText type="default">+ New Workspace</ThemedText>
                </TouchableOpacity>
            </AttachStep>

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
                    <House size={16} color={ThemedColor.caption} weight="regular" />
                    <ThemedText type="subtitle_subtle">HOME</ThemedText>
                </View>
                <DrawerItem
                    title="Home"
                    selected={currentSelected}
                    icon={<House size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)", "")}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Daily"
                    selected={currentSelected}
                    icon={<CalendarBlank size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)/daily")}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Calendar"
                    selected={currentSelected}
                    icon={<Calendar size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)/calendar")}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Analytics"
                    selected={currentSelected}
                    icon={<ChartLine size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)/analytics")}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Voice Dump"
                    badge="AI"
                    selected={currentSelected}
                    icon={<Microphone size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handlePush("/voice")}
                    onLongPress={() => {}}
                />
                <DrawerItem
                    title="Text Dump"
                    badge="AI"
                    selected={currentSelected}
                    icon={<ChatTeardropText size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => handlePush("/text-dump")}
                    onLongPress={() => {}}
                />
                {/* <DrawerItem
                    title="Import"
                    selected={currentSelected}
                    icon={<DownloadSimple size={20} color={ThemedColor.primary} weight="regular" />}
                    onPress={() => {
                        setShowQuickImport(true);
                    }}
                    onLongPress={() => {}}
                /> */}
                <AttachStep index={2} style={{ width: "100%" }}>
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
                            .map((workspace) => (
                                <DrawerItem
                                    onPress={() => handleNavigate("/(logged-in)/(tabs)/(task)", workspace.name)}
                                    onLongPress={() => {
                                        setFocusedWorkspace(workspace.name);
                                        setEditing(true);
                                    }}
                                    key={workspace.name}
                                    title={workspace.name}
                                    selected={currentSelected}
                                />
                            ))}
                    </View>
                </AttachStep>
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
};

const DrawerItem = React.memo(({ title, selected, onPress, onLongPress, badge, icon }: DrawerItemProps) => {
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
