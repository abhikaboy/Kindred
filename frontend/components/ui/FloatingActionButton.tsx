import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Animated, Keyboard, Modal } from "react-native";
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
import { VoiceInputOverlay } from "./fab/VoiceInputOverlay";
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
    const [voiceOverlayVisible, setVoiceOverlayVisible] = useState(false);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    // Controls whether height: menuHeight is applied to the menu container.
    // Only true during/after a height transition so natural layout works on first render.
    const [shouldAnimateHeight, setShouldAnimateHeight] = useState(false);

    // Detect if we're on the feed tab
    const isOnFeedTab = segments?.some(segment => segment === "(feed)");

    // Animations
    const animations = useFABAnimations();

    // Height refs for measuring content natural heights
    const taskSelectionHeight = useRef(0);
    const workspaceSelectionHeight = useRef(0);
    const postTaskSelectionHeight = useRef(0);
    const workspaceCountAtMeasure = useRef(workspaces.length);

    // Tracks whether menuHeight has been seeded for the current FAB session
    const heightInitialized = useRef(false);

    // Pending flags: set when the destination view hasn't measured yet.
    // Cleared inside the destination view's onLayout once it fires.
    const pendingWorkspaceAnim = useRef(false);
    const pendingPostTaskAnim = useRef(false);
    const pendingTaskPress = useRef(false);

    // Animation to run after the shouldAnimateHeight re-render commits.
    // Using a ref (not state) avoids an extra re-render cycle.
    const pendingAnimation = useRef<(() => void) | null>(null);

    // Fire the pending animation after the re-render that applied height: menuHeight.
    // useEffect fires after React commits and paints, guaranteeing the constraint
    // is in the native view before the animation starts driving that value.
    useEffect(() => {
        if (shouldAnimateHeight && pendingAnimation.current) {
            const fn = pendingAnimation.current;
            pendingAnimation.current = null;
            fn();
        }
    }, [shouldAnimateHeight]);

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
            heightInitialized.current = false;
            pendingWorkspaceAnim.current = false;
            pendingPostTaskAnim.current = false;
            pendingTaskPress.current = false;
            pendingAnimation.current = null;
        });
    };

    const startTaskToWorkspaceTransition = () => {
        setFabState("workspace-creation");

        const from = taskSelectionHeight.current;
        const to = workspaceSelectionHeight.current;

        if (to > 0 && from > 0) {
            // Force a deterministic height animation after the constraint is applied.
            animations.menuHeight.setValue(from);
            pendingAnimation.current = null;
            setShouldAnimateHeight(true);
            requestAnimationFrame(() => {
                animations.animateToWorkspaceView(from, to).start();
            });
        } else {
            // WorkspaceSelectionView hasn't measured yet.
            // Seed the from-height and let onLayout fire the animation once measured.
            animations.menuHeight.setValue(from);
            pendingWorkspaceAnim.current = true;
            // Allow the workspace view to measure its natural height.
            setShouldAnimateHeight(false);
        }
    };

    const handleTaskPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (workspaces.length !== workspaceCountAtMeasure.current) {
            workspaceSelectionHeight.current = 0;
        }
        if (taskSelectionHeight.current === 0) {
            pendingTaskPress.current = true;
            return;
        }
        startTaskToWorkspaceTransition();
    };

    const handleWorkspacePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleClose();
        setTimeout(() => setWorkspaceModalVisible(true), 300);
    };

    const handleVoiceInputPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        animations.animateClose(() => {
            setFabState("collapsed");
            setShouldAnimateHeight(false);
            heightInitialized.current = false;
            pendingWorkspaceAnim.current = false;
            pendingPostTaskAnim.current = false;
            pendingAnimation.current = null;
            setVoiceOverlayVisible(true);
        });
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

        const from = taskSelectionHeight.current;
        const to = postTaskSelectionHeight.current;

        if (to > 0 && from > 0) {
            if (shouldAnimateHeight) {
                animations.animateToPostTaskView(from, to).start();
            } else {
                animations.menuHeight.setValue(from);
                pendingAnimation.current = () => animations.animateToPostTaskView(from, to).start();
                setShouldAnimateHeight(true);
            }
        } else {
            animations.menuHeight.setValue(from);
            pendingPostTaskAnim.current = true;
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
                        name: task.content,
                        category: task.categoryID,
                        categoryName: task.categoryName,
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
            animations.animateBackToTaskView(currentHeight, taskSelectionHeight.current).start(({ finished }) => {
                if (finished) {
                    setFabState("task-selection");
                    // Reset so TaskSelectionView remeasures its natural height on next mount,
                    // ensuring taskSelectionHeight.current is never stale when Task is pressed again.
                    setShouldAnimateHeight(false);
                }
            });
        } else {
            setFabState("task-selection");
            setShouldAnimateHeight(false);
        }
    };

    if (!visible) return null;

    const bottomOffset = insets.bottom + TAB_BAR_HEIGHT;

    return (
        <>
            <CreateWorkspaceBottomSheetModal
                visible={workspaceModalVisible}
                setVisible={setWorkspaceModalVisible}
            />

            {voiceOverlayVisible && (
                <Modal transparent animationType="none" statusBarTranslucent>
                    <VoiceInputOverlay
                        onClose={() => setVoiceOverlayVisible(false)}
                    />
                </Modal>
            )}

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
                                // Only constrain height once we're in a transition.
                                // Without this guard the container starts at 0 and
                                // children can't measure their natural height.
                                ...(shouldAnimateHeight && { height: animations.menuHeight }),
                            },
                        ]}
                    >
                        {fabState === "task-selection" && (
                            <TaskSelectionView
                                opacity={animations.taskSelectionOpacity}
                                onTaskPress={handleTaskPress}
                                onSecondaryPress={isOnFeedTab ? handlePostPress : handleWorkspacePress}
                                onVoiceInputPress={handleVoiceInputPress}
                                isOnFeedTab={isOnFeedTab}
                                onLayout={(event) => {
                                    const h = event.nativeEvent.layout.height;
                                    if (h > 0) {
                                        taskSelectionHeight.current = Math.max(taskSelectionHeight.current, h);
                                    }
                                    // Seed menuHeight once per session so the from-value
                                    // is ready before the first transition is requested.
                                    if (!heightInitialized.current && h > 0) {
                                        heightInitialized.current = true;
                                        animations.menuHeight.setValue(h);
                                    }
                                    if (pendingTaskPress.current && taskSelectionHeight.current > 0) {
                                        pendingTaskPress.current = false;
                                        requestAnimationFrame(() => startTaskToWorkspaceTransition());
                                    }
                                }}
                            />
                        )}

                        {fabState === "workspace-creation" && (
                            <WorkspaceSelectionView
                                workspaces={workspaces}
                                selectedWorkspace={selected}
                                opacity={animations.workspaceSelectionOpacity}
                                onBackPress={handleBackPress}
                                onWorkspaceSelect={handleWorkspaceSelect}
                                onLayout={(event) => {
                                    const h = event.nativeEvent.layout.height;
                                    // Only record the natural height when the view is
                                    // unconstrained (shouldAnimateHeight=false).  When
                                    // the constraint is active onLayout returns the
                                    // animated value, not the content's natural height.
                                    if (!shouldAnimateHeight && h > 0) {
                                        workspaceSelectionHeight.current = Math.max(workspaceSelectionHeight.current, h);
                                        workspaceCountAtMeasure.current = workspaces.length;
                                    }
                                    if (pendingWorkspaceAnim.current && h > 0) {
                                        pendingWorkspaceAnim.current = false;
                                        pendingAnimation.current = () =>
                                            animations.animateToWorkspaceView(
                                                taskSelectionHeight.current,
                                                h
                                            ).start();
                                        setShouldAnimateHeight(true);
                                    }
                                }}
                            />
                        )}

                        {fabState === "post-task-selection" && (
                            <PostTaskSelectionView
                                completedTasks={completedTasks}
                                loading={loadingTasks}
                                opacity={animations.postTaskSelectionOpacity}
                                onBackPress={handleBackPress}
                                onTaskSelect={handleCompletedTaskSelect}
                                onLayout={(event) => {
                                    const h = event.nativeEvent.layout.height;
                                    if (!shouldAnimateHeight && h > 0) {
                                        postTaskSelectionHeight.current = Math.max(postTaskSelectionHeight.current, h);
                                    }
                                    if (pendingPostTaskAnim.current && h > 0) {
                                        pendingPostTaskAnim.current = false;
                                        pendingAnimation.current = () =>
                                            animations.animateToPostTaskView(
                                                taskSelectionHeight.current,
                                                h
                                            ).start();
                                        setShouldAnimateHeight(true);
                                    }
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
                isOnFeedTab={isOnFeedTab}
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
