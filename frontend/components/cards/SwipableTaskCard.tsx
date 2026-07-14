// Wrapper for TaskCard that allows for swiping to delete

import React, { useState, useRef, useEffect } from "react";

import TaskCard from "./TaskCard";

import { Task } from "@/api/types";
import ReanimatedSwipeable, { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useFirstTouchHint } from "@/hooks/useFirstTouchHint";
import Reanimated, { SharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS, interpolate, Extrapolation } from "react-native-reanimated";
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { markAsCompletedAPI, activateTaskAPI, setWorkingAPI } from "@/api/task";
import { ActiveTaskActivityFactory } from "@/widgets/widgetUpdaters";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { hideToastable, showToastable } from "react-native-toastable";
import TaskToast from "../ui/TaskToast";
import DefaultToast from "../ui/DefaultToast";
import * as Haptics from "expo-haptics";
import { hapticCompletionBurst } from "@/utils/haptics";
import { Bell, Flag, Trash, Check } from "phosphor-react-native";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { useQueryClient } from "@tanstack/react-query";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import DeadlineBottomSheetModal from "../modals/DeadlineBottomSheetModal";
import ReminderBottomSheetModal from "../modals/ReminderBottomSheetModal";

type Props = {
    redirect?: boolean;
    categoryId: string;
    task: Task;
    categoryName?: string;
    highlightContent?: boolean;
    tutorial?: boolean; // suppress real completion overlays — the tutorial fakes them
};

// Module-level claim so only the first mounted card plays the swipe demo
let peekClaimed = false;

const SwipableTaskCard = ({
    redirect = false,
    categoryId,
    task,
    categoryName,
    highlightContent = false,
    tutorial = false,
}: Props) => {
    const { removeFromCategory, addToCategory, setShowConfetti, categories, updateTask } = useTasks();
    const { loadTaskData } = useTaskCreation();
    const ThemedColor = useThemeColor();
    const { deleteWithUndo, alertElement } = useUndoableDelete();
    const { capture } = useAnalytics();
    const queryClient = useQueryClient();
    const { showRingUpdate } = useRingUpdate();
    const [showDeadlineModal, setShowDeadlineModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);

    // First-touch demo: exactly one card app-wide peeks both swipe sides open
    const swipeableRef = useRef<SwipeableMethods>(null);
    const { ready: swipeHintReady, done: swipeHintDone } = useFirstTouchHint("swipe_actions");
    useEffect(() => {
        if (!swipeHintReady || tutorial || peekClaimed) return;
        peekClaimed = true;
        swipeHintDone();
        const timers = [
            setTimeout(() => swipeableRef.current?.openLeft(), 600),
            setTimeout(() => swipeableRef.current?.close(), 1500),
            setTimeout(() => swipeableRef.current?.openRight(), 2100),
            setTimeout(() => swipeableRef.current?.close(), 3000),
        ];
        return () => timers.forEach(clearTimeout);
    }, [swipeHintReady]);

    const openDeadline = () => {
        loadTaskData(task);
        setShowDeadlineModal(true);
    };

    const openReminder = () => {
        loadTaskData(task);
        setShowReminderModal(true);
    };

    const handleDeadlineUpdate = (deadline: Date | null) => {
        updateTask(categoryId, task.id, { deadline: deadline?.toISOString() || "" });
    };

    const finalCategoryName =
        categoryName ||
        task.categoryName ||
        categories?.find((cat) => cat.id === categoryId)?.name ||
        "Unknown Category";


    /*
  Mark as completed function

*/

    const markAsCompleted = async (categoryId: string, taskId: string) => {
        try {
            // End any live activity for this task
            if (task.workingOnSince) {
                ActiveTaskActivityFactory.getInstances().forEach((a) => a.end("default"));
                setWorkingAPI(categoryId, taskId, false).catch(() => {});
            }

            const res = await markAsCompletedAPI(categoryId, taskId, {
                timeCompleted: new Date().toISOString(),
                timeTaken: "PT0S", // ISO 8601 duration: 0 seconds (not tracked)
            });
            // Only update UI state after successful API call
            removeFromCategory(categoryId, taskId);
            // For public tasks we pop a "tap to post" toast at the top for ~5.5s.
            // The do ring lives in the same top region, so wait for the toast
            // to clear before animating it.
            const ringDelta = res.ringDelta;
            if (!tutorial) {
                if (ringDelta?.ring === "do" && task.public) {
                    setTimeout(() => showRingUpdate(ringDelta), 5600);
                } else {
                    showRingUpdate(ringDelta);
                }
            }
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
            capture(AnalyticsEvents.TASK_COMPLETED, {
                source: "swipe",
            });

            // If backend returned the next flex instance, insert it immediately
            if (res.nextFlexTask) {
                addToCategory(res.nextFlexTask.categoryId, {
                    ...res.nextFlexTask.task,
                    categoryID: res.nextFlexTask.categoryId,
                } as Task);
            }

            setShowConfetti(true);

            const taskData = {
                id: task.id,
                name: task.content,
                category: categoryId,
                categoryName: finalCategoryName,
                points: task.value,
                public: task.public,
            };
            // Build title and message based on streak status
            let title = "Task completed!";
            let message = "Congrats! Click here to post and document your task!";

            if (res.streakChanged) {
                title = `🔥 Task completed - ${res.currentStreak} day streak!`;
                message = `Keep it up! You're on a ${res.currentStreak} day streak! Click here to post!`;
            }

            // Show completion toast with streak info included if applicable
            if (task.public && !tutorial) {
                showToastable({
                    title,
                    status: "success",
                    position: "top",
                    message,
                    onPress: () => {},
                    swipeDirection: "up",
                    duration: 5500,
                    renderContent: (props) => <TaskToast {...props} taskData={taskData} />,
                });
            }

            setTimeout(() => {
                setShowConfetti(false);
            }, 1700);
        } catch (error) {
            console.error("Error completing task:", error);
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Failed to complete task",
                swipeDirection: "up",
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }
    };

    const activateTask = async (categoryId: string, taskId: string) => {
        await activateTaskAPI(categoryId, taskId);
    };
    const taskCard = (
        <TaskCard
            content={task.content}
            value={task.value}
            priority={task.priority as 1 | 2 | 3}
            redirect={redirect}
            id={task.id}
            categoryId={categoryId}
            task={{ ...task }}
            highlightContent={false}
        />
    );

    if (task.isPhantom) {
        const phantomCard = (
            <TaskCard
                content={task.content}
                value={task.value}
                priority={task.priority as 1 | 2 | 3}
                id={task.id}
                categoryId={categoryId}
                task={task}
                redirect={false}
                highlightContent={false}
            />
        );
        return (
            <>
                {phantomCard}
                {alertElement}
            </>
        );
    }

    return (
        <>
            <ReanimatedSwipeable
                ref={swipeableRef}
                containerStyle={styles.swipeable}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={Dimensions.get("window").width / 3}
                overshootLeft={true}
                overshootFriction={2.7}
                renderLeftActions={(prog, drag) => (
                    <LeftAction drag={drag} onComplete={() => markAsCompleted(categoryId, task.id)} />
                )}
                rightThreshold={100}
                overshootRight={true}
                renderRightActions={(prog, drag) => (
                    <View style={{ flexDirection: "row" }}>
                        <RightAction
                            drag={drag}
                            callback={openReminder}
                            index={3}
                            icon={<Bell size={24} color="white" weight="regular" />}
                            color={ThemedColor.primary}
                        />
                        <RightAction
                            drag={drag}
                            callback={openDeadline}
                            index={3}
                            icon={<Flag size={24} color="white" weight="regular" />}
                            color={ThemedColor.primary}
                        />
                        <RightAction
                            drag={drag}
                            callback={() => deleteWithUndo(task, categoryId)}
                            index={3}
                            icon={<Trash size={24} color="white" weight="regular" />}
                            color={ThemedColor.error}
                        />
                    </View>
                )}>
                {taskCard}
            </ReanimatedSwipeable>

            {showDeadlineModal && (
                <DeadlineBottomSheetModal
                    visible={showDeadlineModal}
                    setVisible={setShowDeadlineModal}
                    taskId={task.id}
                    categoryId={categoryId}
                    onDeadlineUpdate={handleDeadlineUpdate}
                />
            )}

            {showReminderModal && (
                <ReminderBottomSheetModal
                    visible={showReminderModal}
                    setVisible={setShowReminderModal}
                    taskId={task.id}
                    categoryId={categoryId}
                />
            )}

            {alertElement}
        </>
    );
}

// Swipe distance between haptic ticks (~16 ticks across a full swipe).
const HAPTIC_STEP = 14;

function LeftAction({
    drag,
    onComplete,
}: {
    drag: SharedValue<number>;
    onComplete: () => void;
}) {
    let width = Dimensions.get("window").width;
    const [isCompleting, setIsCompleting] = React.useState(false);
    const ThemedColor = useThemeColor();

    // Duolingo-style ratchet: a tick every HAPTIC_STEP px of swipe, growing
    // from Soft to Heavy as the card approaches the completion point.
    const tickHaptic = (progress: number) => {
        if (Platform.OS !== "ios") return;
        const style =
            progress > 0.7
                ? Haptics.ImpactFeedbackStyle.Heavy
                : progress > 0.35
                  ? Haptics.ImpactFeedbackStyle.Medium
                  : Haptics.ImpactFeedbackStyle.Soft;
        Haptics.impactAsync(style).catch(() => {});
    };

    const completionHaptic = () => {
        hapticCompletionBurst();
    };

    // Use useAnimatedReaction to watch the drag value
    useAnimatedReaction(
        () => drag.value,
        (currentValue, previousValue) => {
            let threshold = width / 4;
            let percent = (currentValue - threshold * 3) / threshold;
            let opacity = 1 - percent;

            // Positive drag = completion swipe. Tick each step crossed, in
            // either direction, so the card ratchets under the finger.
            const prev = previousValue ?? 0;
            if (
                currentValue > 0 &&
                Math.floor(currentValue / HAPTIC_STEP) !== Math.floor(prev / HAPTIC_STEP)
            ) {
                runOnJS(tickHaptic)(currentValue / width);
            }

            if (opacity <= 0 && !isCompleting) {
                runOnJS(setIsCompleting)(true);
                runOnJS(completionHaptic)(); // instant thud — don't wait for the API
                runOnJS(onComplete)(); // runs only once
            }
        }
    );

    const styleAnimation = useAnimatedStyle(() => {
        let threshold = width / 4;
        let percent = (drag.value - threshold * 3) / threshold;
        let opacity = 1 - percent;

        return {
            transform: [{ translateX: drag.value - width }],
            opacity: opacity,
            display: opacity > 0 ? "flex" : "none",
        };
    });

    // Fade the "Completing" label in as the swipe progresses so it's clear what
    // the green action does. Sits at the revealed edge, tracking the card.
    const labelStyle = useAnimatedStyle(() => ({
        opacity: interpolate(drag.value, [width * 0.12, width * 0.45], [0, 1], Extrapolation.CLAMP),
    }));

    return (
        <Reanimated.View
            style={[
                styleAnimation,
                {
                    backgroundColor: ThemedColor.success,
                    width: width,
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    paddingRight: 28,
                },
            ]}>
            <Reanimated.View style={[labelStyle, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
                <Check size={22} color="white" weight="bold" />
                <ThemedText type="defaultSemiBold" style={{ color: "white" }}>
                    Completing
                </ThemedText>
            </Reanimated.View>
        </Reanimated.View>
    );
}

const RIGHT_ACTION_WIDTH = 75;

function RightAction({
    drag,
    callback,
    index,
    icon,
    color,
}: {
    drag: SharedValue<number>;
    callback: () => void;
    index: number;
    icon: React.ReactNode;
    color: string;
}) {
    const ThemedColor = useThemeColor();

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + RIGHT_ACTION_WIDTH * index }],
        };
    });

    return (
        <Reanimated.View
            style={[
                styleAnimation,
                {
                    backgroundColor: color,
                    justifyContent: "center",
                    alignItems: "center",
                    width: RIGHT_ACTION_WIDTH,
                }
            ]}>
            <TouchableOpacity onPress={() => callback()} style={{ width: "100%", alignItems: "center" }}>
                {icon}
            </TouchableOpacity>
        </Reanimated.View>
    );
}

// Memoize SwipableTaskCard to prevent unnecessary re-renders
export default React.memo(SwipableTaskCard, (prevProps, nextProps) => {
    return (
        prevProps.redirect === nextProps.redirect &&
        prevProps.categoryId === nextProps.categoryId &&
        prevProps.task.id === nextProps.task.id &&
        prevProps.task.content === nextProps.task.content &&
        prevProps.task.priority === nextProps.task.priority &&
        prevProps.task.value === nextProps.task.value &&
        prevProps.task.deadline === nextProps.task.deadline &&
        prevProps.task.startDate === nextProps.task.startDate &&
        prevProps.task.active === nextProps.task.active &&
        prevProps.highlightContent === nextProps.highlightContent &&
        prevProps.task.isPhantom === nextProps.task.isPhantom &&
        prevProps.task.nextGenerated === nextProps.task.nextGenerated &&
        prevProps.task.workingOnSince === nextProps.task.workingOnSince &&
        prevProps.task.startTime === nextProps.task.startTime &&
        prevProps.task.recurring === nextProps.task.recurring &&
        prevProps.task.flexInfo?.instanceNumber === nextProps.task.flexInfo?.instanceNumber &&
        prevProps.task.flexInfo?.target === nextProps.task.flexInfo?.target &&
        prevProps.task.integration === nextProps.task.integration
    );
});

const styles = StyleSheet.create({
    swipeable: {
    },
    rightAction: {
        width: RIGHT_ACTION_WIDTH,
        alignSelf: "center",
        textAlign: "center",
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
    },
    leftAction: {
        width: Dimensions.get("window").width,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
});
