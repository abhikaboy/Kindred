import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Keyboard } from "react-native";
import * as Haptics from "expo-haptics";
import { useTasks } from "@/contexts/tasksContext";
import { useCreateModal } from "@/contexts/createModalContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSegments, router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getCompletedTasksAPI } from "@/api/task";
import type { Task } from "@/api/types";

import { FABButton } from "./fab/FABButton";
import { FABBackdrop } from "./fab/FABBackdrop";
import { TaskSelectionView } from "./fab/TaskSelectionView";
import { WorkspaceSelectionView } from "./fab/WorkspaceSelectionView";
import { PostTaskSelectionView } from "./fab/PostTaskSelectionView";
import { useFABAnimations } from "./fab/useFABAnimations";
import CreateWorkspaceBottomSheetModal from "@/components/modals/CreateWorkspaceBottomSheetModal";

const TAB_BAR_HEIGHT = 83;

type FABState = "collapsed" | "task-selection" | "workspace-creation" | "post-task-selection";

interface FloatingActionButtonProps {
    visible?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ visible = true }) => {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const segments = useSegments();
    const { workspaces, selected, setSelected } = useTasks();
    const { openModal } = useCreateModal();

    // State
    const [fabState, setFabState] = useState<FABState>("collapsed");
    const [workspaceModalVisible, setWorkspaceModalVisible] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [shouldAnimateHeight, setShouldAnimateHeight] = useState(false);

    // Detect if we're on the feed tab
    const isOnFeedTab = segments?.some(segment => segment === "(feed)");

    // Animations
    const animations = useFABAnimations();

    // Height refs for measuring content
    const taskSelectionHeight = useRef(0);
    const workspaceSelectionHeight = useRef(0);
    const postTaskSelectionHeight = useRef(0);

    // Keyboard visibility handling
    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener("keyboardWillShow", () => {
            setKeyboardVisible(true);
            animations.animateKeyboardShow().start();
        });

        const keyboardWillHide = Keyboard.addListener("keyboardWillHide", () => {
            setKeyboardVisible(false);
            animations.animateKeyboardHide().start();
        });

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    // Handlers
    const handleFABPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        animations.animateFABPress().start();

        if (fabState === "collapsed") {
            setFabState("task-selection");
            animations.animateOpen().start();
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        animations.animateClose(() => {
            setFabState("collapsed");
            setShouldAnimateHeight(false);
        });
    };

    const handleTaskPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFabState("workspace-creation");

        if (workspaceSelectionHeight.current > 0 && taskSelectionHeight.current > 0) {
            setShouldAnimateHeight(true);
            animations.animateToWorkspaceView(
                taskSelectionHeight.current,
                workspaceSelectionHeight.current
            ).start();
        }
    };

    const handleWorkspacePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleClose();
        setTimeout(() => setWorkspaceModalVisible(true), 300);
    };

    const handleWorkspaceSelect = (workspaceName: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelected(workspaceName);
        handleClose();
        setTimeout(() => openModal(), 300);
    };

    const handlePostPress = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

        setFabState("post-task-selection");

        if (postTaskSelectionHeight.current > 0 && taskSelectionHeight.current > 0) {
            setShouldAnimateHeight(true);
            animations.animateToPostTaskView(
                taskSelectionHeight.current,
                postTaskSelectionHeight.current
            ).start();
        }
    };

    const handleCompletedTaskSelect = (task: Task) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleClose();

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
            handleBackPress();
        } else {
            handleClose();
        }
    };

    const handleBackPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const currentHeight = fabState === "workspace-creation"
            ? workspaceSelectionHeight.current
            : postTaskSelectionHeight.current;

        if (taskSelectionHeight.current > 0 && currentHeight > 0) {
            setShouldAnimateHeight(true);
            animations.animateBackToTaskView(currentHeight, taskSelectionHeight.current).start();
        }

        setTimeout(() => setFabState("task-selection"), 100);
    };

    if (!visible) return null;

    const bottomOffset = insets.bottom + TAB_BAR_HEIGHT;

    return (
        <>
            <CreateWorkspaceBottomSheetModal
                visible={workspaceModalVisible}
                setVisible={setWorkspaceModalVisible}
            />

            <FABBackdrop
                visible={fabState !== "collapsed"}
                opacity={animations.backdropOpacity}
                onPress={handleBackdropPress}
            />

            {fabState !== "collapsed" && (
                <Animated.View
                    style={[
                        styles.menuContainer,
                        {
                            opacity: animations.menuOpacity,
                            transform: [{ translateY: animations.menuTranslateY }],
                            bottom: bottomOffset + 64,
                        },
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.menuContent,
                            {
                                backgroundColor: ThemedColor.background,
                                borderColor: ThemedColor.lightened,
                                ...(shouldAnimateHeight && { height: animations.menuHeight }),
                            },
                        ]}
                    >
                        {fabState === "task-selection" && (
                            <TaskSelectionView
                                opacity={animations.taskSelectionOpacity}
                                onTaskPress={handleTaskPress}
                                onSecondaryPress={isOnFeedTab ? handlePostPress : handleWorkspacePress}
                                isOnFeedTab={isOnFeedTab}
                                onLayout={(event) => {
                                    taskSelectionHeight.current = event.nativeEvent.layout.height;
                                }}
                            />
                        )}

                        {fabState === "workspace-creation" && (
                            <WorkspaceSelectionView
                                workspaces={workspaces}
                                selectedWorkspace={selected}
                                onBackPress={handleBackPress}
                                onWorkspaceSelect={handleWorkspaceSelect}
                                onLayout={(event) => {
                                    workspaceSelectionHeight.current = event.nativeEvent.layout.height;
                                }}
                            />
                        )}

                        {fabState === "post-task-selection" && (
                            <PostTaskSelectionView
                                completedTasks={completedTasks}
                                loading={loadingTasks}
                                onBackPress={handleBackPress}
                                onTaskSelect={handleCompletedTaskSelect}
                                onLayout={(event) => {
                                    postTaskSelectionHeight.current = event.nativeEvent.layout.height;
                                }}
                            />
                        )}
                    </Animated.View>
                </Animated.View>
            )}

            <FABButton
                isOpen={fabState !== "collapsed"}
                onPress={handleFABPress}
                rotation={animations.rotation}
                scale={animations.fabScale}
                opacity={animations.fabOpacity}
                bottomOffset={bottomOffset}
                isKeyboardVisible={keyboardVisible}
            />
        </>
    );
};

const styles = StyleSheet.create({
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
});
