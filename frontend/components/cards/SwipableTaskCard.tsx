// Wrapper for TaskCard that allows for swiping to delete

import React, { useState, useRef, useEffect, useCallback } from "react";

import TaskCard from "./TaskCard";

import { Task } from "@/api/types";
import ReanimatedSwipeable, { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useFirstTouchHint, isHintKnownDone } from "@/hooks/useFirstTouchHint";
import Reanimated, { SharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS, interpolate, Extrapolation } from "react-native-reanimated";
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { markAsCompletedAPI, activateTaskAPI, setWorkingAPI } from "@/api/task";
import { ActiveTaskActivityFactory } from "@/widgets/widgetUpdaters";
import { useTaskActions, useTasksSelector } from "@/contexts/tasksContext";
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
import { useOnboardingV2Context } from "@/contexts/OnboardingV2Context";
import DeadlineStage from "../modals/create/composer/DeadlineStage";
import ReminderStage from "../modals/create/composer/ReminderStage";
import type { Reminder } from "@/hooks/useReminder";

type Props = {
    redirect?: boolean;
    categoryId: string;
    task: Task;
    categoryName?: string;
    highlightContent?: boolean;
    tutorial?: boolean; // suppress real completion overlays — the tutorial fakes them
    // Whether this card may host the one-time swipe demo. Lists that know their
    // first card pass true for it and false for the rest; undefined keeps the
    // legacy "first mounted card claims it" behavior.
    showSwipeHint?: boolean;
};

// Module-level claim so only the first mounted card plays the swipe demo
let peekClaimed = false;

const SWIPE_HINT_KEY = "swipe_actions";

// Mounted by at most the cards that might play the demo, so the hint hook
// (and its storage lookup) doesn't run once per card.
const SwipeHintPeek = ({ swipeableRef }: { swipeableRef: React.RefObject<SwipeableMethods | null> }) => {
    const { ready, done } = useFirstTouchHint(SWIPE_HINT_KEY);
    useEffect(() => {
        if (!ready || peekClaimed) return;
        peekClaimed = true;
        done();
        const timers = [
            setTimeout(() => swipeableRef.current?.openLeft(), 600),
            setTimeout(() => swipeableRef.current?.close(), 1500),
            setTimeout(() => swipeableRef.current?.openRight(), 2100),
            setTimeout(() => swipeableRef.current?.close(), 3000),
        ];
        return () => timers.forEach(clearTimeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);
    return null;
};

// Constant icons, hoisted so the action renderers don't re-create them.
const BELL_ICON = <Bell size={24} color="white" weight="regular" />;
const FLAG_ICON = <Flag size={24} color="white" weight="regular" />;
const TRASH_ICON = <Trash size={24} color="white" weight="regular" />;

// Returns a referentially stable function that always calls the latest `fn`.
function useLatestCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    const ref = useRef(fn);
    ref.current = fn;
    return useCallback((...args: A) => ref.current(...args), []);
}

const SwipableTaskCard = ({
    redirect = false,
    categoryId,
    task,
    categoryName,
    highlightContent = false,
    tutorial = false,
    showSwipeHint,
}: Props) => {
    const { removeFromCategory, addToCategory, setShowConfetti, updateTask } = useTaskActions();
    // Only subscribes when no name was passed in; otherwise the selector is a
    // constant null and workspace/category changes never re-render this card.
    const fallbackCategoryName = useTasksSelector((s) =>
        categoryName || task.categoryName ? null : (s.categories?.find((cat) => cat.id === categoryId)?.name ?? null)
    );
    const ThemedColor = useThemeColor();
    const { deleteWithUndo, alertElement } = useUndoableDelete();
    const { capture } = useAnalytics();
    const queryClient = useQueryClient();
    const { showRingUpdate } = useRingUpdate();
    const { step: onboardingStep, dispatch: dispatchOnboarding } = useOnboardingV2Context();
    const [showDeadlineModal, setShowDeadlineModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);

    // First-touch demo: exactly one card app-wide peeks both swipe sides open
    const swipeableRef = useRef<SwipeableMethods>(null);
    const mountSwipeHint = showSwipeHint !== false && !tutorial && !peekClaimed && !isHintKnownDone(SWIPE_HINT_KEY);

    const openDeadline = () => setShowDeadlineModal(true);
    const openReminder = () => setShowReminderModal(true);

    const handleDeadlineUpdate = (deadline: Date | null) => {
        updateTask(categoryId, task.id, { deadline: deadline?.toISOString() || "" });
    };

    const handleReminderUpdate = (reminders: Reminder[]) => {
        updateTask(categoryId, task.id, { reminders } as any);
    };

    const finalCategoryName =
        categoryName ||
        task.categoryName ||
        fallbackCategoryName ||
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
            // Step 3 ends on the first completed task, step 7 on the next. Other steps ignore both.
            if (onboardingStep === 3) dispatchOnboarding({ type: "TASK_COMPLETED" });
            if (onboardingStep === 7) dispatchOnboarding({ type: "FINISH" });

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
                title = `Task completed - ${res.currentStreak} day streak!`;
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

    // Stable action callbacks (always see the latest task/props) so the swipe
    // action renderers keep their identity across re-renders.
    const onComplete = useLatestCallback(() => markAsCompleted(categoryId, task.id));
    const onReminder = useLatestCallback(openReminder);
    const onDeadline = useLatestCallback(openDeadline);
    const onDelete = useLatestCallback(() => deleteWithUndo(task, categoryId));

    const renderLeftActions = useCallback(
        (_prog: SharedValue<number>, drag: SharedValue<number>) => <LeftAction drag={drag} onComplete={onComplete} />,
        [onComplete]
    );

    const renderRightActions = useCallback(
        (_prog: SharedValue<number>, drag: SharedValue<number>) => (
            <View style={{ flexDirection: "row" }}>
                <RightAction drag={drag} callback={onReminder} index={3} icon={BELL_ICON} color={ThemedColor.primary} />
                <RightAction drag={drag} callback={onDeadline} index={3} icon={FLAG_ICON} color={ThemedColor.primary} />
                <RightAction drag={drag} callback={onDelete} index={3} icon={TRASH_ICON} color={ThemedColor.error} />
            </View>
        ),
        [onReminder, onDeadline, onDelete, ThemedColor.primary, ThemedColor.error]
    );
    const taskCard = (
        <TaskCard
            content={task.content}
            value={task.value}
            priority={task.priority as 1 | 2 | 3}
            redirect={redirect}
            id={task.id}
            categoryId={categoryId}
            task={task}
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
                renderLeftActions={renderLeftActions}
                rightThreshold={100}
                overshootRight={true}
                renderRightActions={renderRightActions}>
                {taskCard}
            </ReanimatedSwipeable>
            {mountSwipeHint && <SwipeHintPeek swipeableRef={swipeableRef} />}

            {showDeadlineModal && (
                <DeadlineStage
                    visible={showDeadlineModal}
                    setVisible={setShowDeadlineModal}
                    task={task}
                    taskId={task.id}
                    categoryId={categoryId}
                    onDeadlineUpdate={handleDeadlineUpdate}
                />
            )}

            {showReminderModal && (
                <ReminderStage
                    visible={showReminderModal}
                    setVisible={setShowReminderModal}
                    task={task}
                    taskId={task.id}
                    categoryId={categoryId}
                    onReminderUpdate={handleReminderUpdate}
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
        opacity: interpolate(drag.value, [width * 0.04, width * 0.18], [0, 1], Extrapolation.CLAMP),
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
        prevProps.categoryName === nextProps.categoryName &&
        prevProps.tutorial === nextProps.tutorial &&
        prevProps.showSwipeHint === nextProps.showSwipeHint &&
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
        prevProps.task.integration === nextProps.task.integration &&
        prevProps.task.public === nextProps.task.public &&
        prevProps.task.templateID === nextProps.task.templateID &&
        prevProps.task.categoryName === nextProps.task.categoryName &&
        prevProps.task.encouragements === nextProps.task.encouragements &&
        prevProps.task.taggedUsers === nextProps.task.taggedUsers
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
