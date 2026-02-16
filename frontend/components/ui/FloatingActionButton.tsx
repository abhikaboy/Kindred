import React, { useRef, useState, useEffect } from "react";
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
    ScrollView,
    Keyboard,
    Easing,
} from "react-native";
import { ArrowLeft, CheckCircle, Folder, Plus, X, Camera } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import * as Haptics from "expo-haptics";
import { useTasks } from "@/contexts/tasksContext";
import { useCreateModal } from "@/contexts/createModalContext";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CreateWorkspaceBottomSheetModal from "@/components/modals/CreateWorkspaceBottomSheetModal";
import { usePathname, router, useSegments } from "expo-router";
import { getCompletedTasksAPI } from "@/api/task";
import type { Task } from "@/api/types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type FABState = "collapsed" | "task-selection" | "workspace-creation" | "post-task-selection";

interface FloatingActionButtonProps {
    visible?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ visible = true }) => {
    const TAB_BAR_HEIGHT = 83;
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const segments = useSegments();
    const { workspaces, selected, setSelected } = useTasks();
    const { openModal } = useCreateModal();

    const [fabState, setFabState] = useState<FABState>("collapsed");
    const [workspaceModalVisible, setWorkspaceModalVisible] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

    // Detect if we're on the feed tab using segments
    const isOnFeedTab = segments?.some(segment => segment === "(feed)");

    // Animation values
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const fabScale = useRef(new Animated.Value(1)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const menuOpacity = useRef(new Animated.Value(0)).current;
    const menuTranslateY = useRef(new Animated.Value(30)).current;
    const menuHeight = useRef(new Animated.Value(0)).current;
    const fabOpacity = useRef(new Animated.Value(1)).current;

    // Menu content animations
    const taskSelectionOpacity = useRef(new Animated.Value(1)).current;
    const workspaceSelectionOpacity = useRef(new Animated.Value(0)).current;
    const postTaskSelectionOpacity = useRef(new Animated.Value(0)).current;

    // Workspace item animations - use ref to persist across renders
    const workspaceAnimationsRef = useRef<Array<{ opacity: Animated.Value; translateY: Animated.Value }>>([]);
    const completedTaskAnimationsRef = useRef<Array<{ opacity: Animated.Value; translateY: Animated.Value }>>([]);

    // Refs for measuring content heights
    const taskSelectionHeight = useRef(0);
    const workspaceSelectionHeight = useRef(0);
    const postTaskSelectionHeight = useRef(0);
    const [shouldAnimateHeight, setShouldAnimateHeight] = useState(false);

    // Initialize/update workspace animations when workspaces change
    useEffect(() => {
        const filteredWorkspaces = workspaces.filter(w => !w.isBlueprint);
        const currentLength = workspaceAnimationsRef.current.length;

        if (currentLength !== filteredWorkspaces.length) {
            // Create new animations array
            const newAnimations = filteredWorkspaces.map((_, index) => {
                // Reuse existing animation if available
                if (workspaceAnimationsRef.current[index]) {
                    // Reset values
                    workspaceAnimationsRef.current[index].opacity.setValue(1);
                    workspaceAnimationsRef.current[index].translateY.setValue(10);
                    return workspaceAnimationsRef.current[index];
                }
                // Create new animation values
                return {
                    opacity: new Animated.Value(1),
                    translateY: new Animated.Value(10),
                };
            });
            workspaceAnimationsRef.current = newAnimations;
        }
    }, [workspaces]);

    // Initialize/update completed task animations when completed tasks change
    useEffect(() => {
        const currentLength = completedTaskAnimationsRef.current.length;

        if (currentLength !== completedTasks.length) {
            const newAnimations = completedTasks.map((_, index) => {
                if (completedTaskAnimationsRef.current[index]) {
                    completedTaskAnimationsRef.current[index].opacity.setValue(1);
                    completedTaskAnimationsRef.current[index].translateY.setValue(10);
                    return completedTaskAnimationsRef.current[index];
                }
                return {
                    opacity: new Animated.Value(1),
                    translateY: new Animated.Value(10),
                };
            });
            completedTaskAnimationsRef.current = newAnimations;
        }
    }, [completedTasks]);

    const workspaceAnimations = workspaceAnimationsRef.current;
    const completedTaskAnimations = completedTaskAnimationsRef.current;

    // Handle keyboard visibility
    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener("keyboardWillShow", () => {
            setKeyboardVisible(true);
            Animated.timing(fabOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        });

        const keyboardWillHide = Keyboard.addListener("keyboardWillHide", () => {
            setKeyboardVisible(false);
            Animated.timing(fabOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        });

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "45deg"],
    });

    const handleFABPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Subtle press animation
        Animated.sequence([
            Animated.timing(fabScale, {
                toValue: 0.9,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(fabScale, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        if (fabState === "collapsed") {
            // Show task/workspace selection menu
            setFabState("task-selection");
            animateOpen();
        } else {
            // Close menu - animate first, then change state
            animateClose();
        }
    };

    const animateOpen = () => {
        // Reset all menu content opacities and positions
        taskSelectionOpacity.setValue(1);
        workspaceSelectionOpacity.setValue(0);
        menuOpacity.setValue(0);
        menuTranslateY.setValue(30);
        backdropOpacity.setValue(0); // Reset backdrop to 0 before animating

        // Reset workspace animations - opacity stays at 1, only translateY resets
        workspaceAnimations.forEach((anim) => {
            anim.opacity.setValue(1);
            anim.translateY.setValue(10);
        });

        Animated.parallel([
            // FAB rotation
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            // Backdrop fade in
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            // Menu fade and slide in
            Animated.timing(menuOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(menuTranslateY, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const animateClose = () => {
        Animated.parallel([
            // FAB rotation
            Animated.timing(rotateAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            // Backdrop fade out
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            // Menu fade and slide out
            Animated.timing(menuOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(menuTranslateY, {
                toValue: 30,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Change state to collapsed AFTER animation completes
            setFabState("collapsed");

            // Reset all animations after close completes
            taskSelectionOpacity.setValue(1);
            workspaceSelectionOpacity.setValue(0);
            postTaskSelectionOpacity.setValue(0);
            setShouldAnimateHeight(false);

            // Reset animations
            workspaceAnimations.forEach((anim) => {
                anim.opacity.setValue(1);
                anim.translateY.setValue(10);
            });
            completedTaskAnimations.forEach((anim) => {
                anim.opacity.setValue(1);
                anim.translateY.setValue(10);
            });
        });
    };

    const handleTaskPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Update state first to render the workspace view
        setFabState("workspace-creation");

        // Enable height animation and animate to workspace height
        if (workspaceSelectionHeight.current > 0 && taskSelectionHeight.current > 0) {
            setShouldAnimateHeight(true);
            menuHeight.setValue(taskSelectionHeight.current);
            Animated.timing(menuHeight, {
                toValue: workspaceSelectionHeight.current,
                duration: 250,
                easing: Easing.ease,
                useNativeDriver: false, // height animations can't use native driver
            }).start();
        }

        // Fade out task selection, fade in workspace selection
        Animated.parallel([
            Animated.timing(taskSelectionOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(workspaceSelectionOpacity, {
                toValue: 1,
                duration: 200,
                delay: 100,
                useNativeDriver: true,
            }),
        ]).start();

        // No animations for workspace items - just show them immediately
        // (Simplified for debugging)
    };

    const handleWorkspacePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Close FAB and open workspace creation modal
        animateClose();

        // Open workspace creation modal after animation
        setTimeout(() => {
            setWorkspaceModalVisible(true);
        }, 300);
    };

    const handleWorkspaceSelect = (workspaceName: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Select the workspace and open create modal
        setSelected(workspaceName);

        // Close FAB with animation
        animateClose();

        // Open modal after animation completes
        setTimeout(() => {
            openModal();
        }, 300);
    };

    const handlePostPress = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Fetch completed tasks
        setLoadingTasks(true);
        try {
            const response = await getCompletedTasksAPI(1, 20);
            setCompletedTasks(response.tasks as any);
        } catch (error) {
            console.error("Failed to fetch completed tasks:", error);
            setCompletedTasks([]);
        } finally {
            setLoadingTasks(false);
        }

        // Update state first to render the post task selection view
        setFabState("post-task-selection");

        // Enable height animation and animate to post task selection height
        if (postTaskSelectionHeight.current > 0 && taskSelectionHeight.current > 0) {
            setShouldAnimateHeight(true);
            menuHeight.setValue(taskSelectionHeight.current);
            Animated.timing(menuHeight, {
                toValue: postTaskSelectionHeight.current,
                duration: 250,
                easing: Easing.ease,
                useNativeDriver: false,
            }).start();
        }

        // Fade out task selection, fade in post task selection
        Animated.parallel([
            Animated.timing(taskSelectionOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(postTaskSelectionOpacity, {
                toValue: 1,
                duration: 200,
                delay: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handleCompletedTaskSelect = (task: Task) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Close FAB with animation
        animateClose();

        // Navigate to camera with task info
        setTimeout(() => {
            router.push({
                pathname: "/posting/cameraview",
                params: {
                    taskInfo: JSON.stringify({
                        id: task.id,
                        content: task.content,
                        category: {
                            id: task.categoryID,
                            name: task.categoryName,
                        },
                    }),
                },
            });
        }, 300);
    };

    const handleBackdropPress = () => {
        if (fabState === "workspace-creation" || fabState === "post-task-selection") {
            // Go back to task selection
            handleBackPress();
        } else {
            // Close with animation
            animateClose();
        }
    };

    const handleBackPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const currentHeight = fabState === "workspace-creation" ? workspaceSelectionHeight.current : postTaskSelectionHeight.current;

        // Animate height change back to task selection
        if (taskSelectionHeight.current > 0 && currentHeight > 0) {
            setShouldAnimateHeight(true);
            menuHeight.setValue(currentHeight);
            Animated.timing(menuHeight, {
                toValue: taskSelectionHeight.current,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }

        // Fade out current selection, fade in task selection
        Animated.parallel([
            Animated.timing(workspaceSelectionOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(postTaskSelectionOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(taskSelectionOpacity, {
                toValue: 1,
                duration: 200,
                delay: 100,
                useNativeDriver: true,
            }),
        ]).start();

        // Reset animations
        workspaceAnimations.forEach((anim) => {
            anim.opacity.setValue(1);
            anim.translateY.setValue(10);
        });
        completedTaskAnimations.forEach((anim) => {
            anim.opacity.setValue(1);
            anim.translateY.setValue(10);
        });

        // Update state after fade starts
        setTimeout(() => {
            setFabState("task-selection");
        }, 100);
    };

    if (!visible) return null;

    return (
        <>
            {/* Workspace Creation Modal */}
            <CreateWorkspaceBottomSheetModal
                visible={workspaceModalVisible}
                setVisible={setWorkspaceModalVisible}
            />

            {/* Backdrop */}
            {fabState !== "collapsed" && (
                <TouchableWithoutFeedback onPress={handleBackdropPress}>
                    <Animated.View
                        style={[
                            styles.backdrop,
                            {
                                opacity: backdropOpacity,
                            },
                        ]}
                    >
                        <BlurView intensity={15} style={StyleSheet.absoluteFill} tint="dark" />
                    </Animated.View>
                </TouchableWithoutFeedback>
            )}

            {/* Menu Content */}
            {fabState !== "collapsed" && (
                <Animated.View
                    style={[
                        styles.menuContainer,
                        {
                            opacity: menuOpacity,
                            transform: [{ translateY: menuTranslateY }],
                            bottom: insets.bottom + TAB_BAR_HEIGHT + 64,
                        },
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.menuContent,
                            {
                                backgroundColor: ThemedColor.background,
                                borderColor: ThemedColor.lightened,
                                ...(shouldAnimateHeight && { height: menuHeight }),
                            },
                        ]}
                    >
                        {/* Task Selection View */}
                        {fabState === "task-selection" && (
                            <Animated.View
                                style={[
                                    styles.menuSection,
                                    {
                                        opacity: taskSelectionOpacity,
                                    }
                                ]}
                                onLayout={(event) => {
                                    const { height } = event.nativeEvent.layout;
                                    taskSelectionHeight.current = height;
                                }}
                            >
                            <TouchableOpacity
                                style={[styles.menuItem, { borderBottomColor: ThemedColor.lightened }]}
                                onPress={handleTaskPress}
                            >
                                <View style={styles.menuItemContent}>
                                    <View style={[styles.iconContainer, { backgroundColor: ThemedColor.lightened }]}>
                                        <CheckCircle size={24} color={ThemedColor.primary} weight="bold" />
                                    </View>
                                    <View style={styles.menuItemText}>
                                        <ThemedText type="defaultSemiBold">Task</ThemedText>
                                        <ThemedText type="caption">
                                            Create a new task
                                        </ThemedText>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={isOnFeedTab ? handlePostPress : handleWorkspacePress}
                            >
                                <View style={styles.menuItemContent}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: ThemedColor.lightened },
                                        ]}
                                    >
                                        {isOnFeedTab ? (
                                            <Camera size={20} color={ThemedColor.primary} weight="bold" />
                                        ) : (
                                            <Folder size={20} color={ThemedColor.primary} weight="bold" />
                                        )}
                                    </View>
                                    <View style={styles.menuItemText}>
                                        <ThemedText type="defaultSemiBold">
                                            {isOnFeedTab ? "Post" : "Workspace"}
                                        </ThemedText>
                                        <ThemedText type="caption">
                                            {isOnFeedTab ? "Share a completed task" : "Create a new workspace"}
                                        </ThemedText>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                        )}

                        {/* Workspace Selection View */}
                        {fabState === "workspace-creation" && (
                            <View
                                style={[
                                    styles.menuSection,
                                    {
                                        // Temporarily disable opacity animation for debugging
                                        opacity: 1,
                                    }
                                ]}
                                onLayout={(event) => {
                                    const { height } = event.nativeEvent.layout;
                                    workspaceSelectionHeight.current = height;
                                }}
                            >
                                <View style={styles.workspaceHeader}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                        <TouchableOpacity
                                            onPress={handleBackPress}
                                            style={{ padding: 4 }}
                                        >
                                            <ArrowLeft size={20} color={ThemedColor.text} weight="bold" />
                                        </TouchableOpacity>
                                        <View style={{ flex: 1 }}>
                                            <ThemedText type="defaultSemiBold">
                                                Select Workspace
                                            </ThemedText>
                                            <ThemedText type="caption" style={{ marginTop: 4, fontSize: 14 }}>
                                                Choose where to create your task
                                            </ThemedText>
                                        </View>
                                    </View>
                                </View>

                            <ScrollView
                                style={styles.workspaceList}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 8 }}
                            >
                                {(() => {
                                    const filtered = workspaces.filter((workspace) => !workspace.isBlueprint);
                                    return filtered.map((workspace, index) => {
                                        return (
                                            <View key={workspace.name}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.workspaceItem,
                                                        {
                                                            backgroundColor:
                                                                selected === workspace.name
                                                                    ? ThemedColor.lightened
                                                                    : "transparent",
                                                            borderWidth: 1,
                                                            borderColor: ThemedColor.lightened,

                                                        },
                                                    ]}
                                                    onPress={() => handleWorkspaceSelect(workspace.name)}
                                                >
                                                    <ThemedText type="default">{workspace.name}</ThemedText>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    });
                                })()}
                            </ScrollView>
                        </View>
                        )}

                        {/* Post Task Selection View */}
                        {fabState === "post-task-selection" && (
                            <View
                                style={[
                                    styles.menuSection,
                                    {
                                        opacity: 1,
                                    }
                                ]}
                                onLayout={(event) => {
                                    const { height } = event.nativeEvent.layout;
                                    postTaskSelectionHeight.current = height;
                                }}
                            >
                                <View style={styles.workspaceHeader}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                        <TouchableOpacity
                                            onPress={handleBackPress}
                                            style={{ padding: 4 }}
                                        >
                                            <ArrowLeft size={20} color={ThemedColor.text} weight="bold" />
                                        </TouchableOpacity>
                                        <View style={{ flex: 1 }}>
                                            <ThemedText type="defaultSemiBold">
                                                Select Completed Task
                                            </ThemedText>
                                            <ThemedText type="caption" style={{ marginTop: 4, fontSize: 14 }}>
                                                Choose a task to share
                                            </ThemedText>
                                        </View>
                                    </View>
                                </View>

                            <ScrollView
                                style={styles.workspaceList}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 8 }}
                            >
                                {loadingTasks ? (
                                    <View style={{ padding: 16, alignItems: "center" }}>
                                        <ThemedText type="caption">Loading tasks...</ThemedText>
                                    </View>
                                ) : completedTasks.length === 0 ? (
                                    <View style={{ padding: 16, alignItems: "center" }}>
                                        <ThemedText type="caption">No completed tasks found</ThemedText>
                                    </View>
                                ) : (
                                    completedTasks.map((task, index) => (
                                        <TouchableOpacity
                                            key={task.id}
                                            style={[
                                                styles.completedTaskItem,
                                                {
                                                    backgroundColor: ThemedColor.lightenedCard,
                                                    borderWidth: 1,
                                                    borderColor: ThemedColor.tertiary,
                                                }
                                            ]}
                                            onPress={() => handleCompletedTaskSelect(task)}
                                        >
                                            <View style={styles.completedTaskContent}>
                                                <View style={styles.completedTaskText}>
                                                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                                                        {task.content}
                                                    </ThemedText>
                                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                                        {task.categoryName}
                                                    </ThemedText>
                                                </View>
                                            </View>
                                            <View style={[styles.completedTaskAction, { backgroundColor: ThemedColor.primary + "10" }]}>
                                                <Camera size={20} color={ThemedColor.primary} weight="regular" />
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                        )}
                    </Animated.View>
                </Animated.View>
            )}

            {/* FAB Button */}
            <Animated.View
                style={[
                    styles.fab,
                    {
                        backgroundColor: "#854DFF",
                        bottom: insets.bottom + TAB_BAR_HEIGHT,
                        transform: [{ rotate: rotation }, { scale: fabScale }],
                        opacity: fabOpacity,
                    },
                ]}
                pointerEvents={keyboardVisible ? "none" : "auto"}
            >
                <TouchableOpacity
                    style={styles.fabButton}
                    onPress={handleFABPress}
                    activeOpacity={0.8}
                >
                    {fabState === "collapsed" ? (
                        <Plus size={24} color="#FFFFFF" weight="bold" />
                    ) : (
                        <X size={24} color="#FFFFFF" weight="bold" />
                    )}
                </TouchableOpacity>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        zIndex: 998,
    },
    fab: {
        position: "absolute",
        right: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
    },
    fabButton: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 28,
    },
    menuContainer: {
        position: "absolute",
        left: 16,
        right: 16,
        zIndex: 999,
    },
    menuContent: {
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 12,
        overflow: "hidden",
    },
    menuSection: {
        padding: 8,
    },
    menuItem: {
        borderBottomWidth: 0,
    },
    menuItemContent: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    menuItemText: {
        flex: 1,
        gap: 2,
    },
    workspaceHeader: {
        padding: 16,
        paddingBottom: 12,
    },
    workspaceList: {
        maxHeight: SCREEN_HEIGHT * 0.5,
        paddingHorizontal: 8,
    },
    workspaceItem: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 4,
        paddingVertical: 20,
        gap: 4,
    },
    workspaceItemContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    workspaceItemText: {
        flex: 1,
        gap: 2,
    },
    completedTaskItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    completedTaskContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    completedTaskText: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 2,
    },
    completedTaskAction: {
        padding: 10,
        borderRadius: 20,
        marginLeft: 8,
    },
});
