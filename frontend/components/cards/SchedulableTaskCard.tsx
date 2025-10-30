// Wrapper for TaskCard that allows for swiping to schedule

import React, { useCallback } from "react";

import TaskCard from "./TaskCard";

import { Task } from "@/api/types";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, { SharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { Dimensions, Platform, StyleSheet, TouchableOpacity } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useThemeColor } from "@/hooks/useThemeColor";
import { markAsCompletedAPI, activateTaskAPI, removeFromCategoryAPI } from "@/api/task";
import { useTasks } from "@/contexts/tasksContext";
import { hideToastable, showToastable } from "react-native-toastable";
import TaskToast from "../ui/TaskToast";
import DefaultToast from "../ui/DefaultToast";
import * as Haptics from "expo-haptics";

type Props = {
    redirect?: boolean;
    categoryId: string;
    task: Task;
    categoryName?: string;
    onRightSwipe?: () => void; // Customizable right swipe action
};

const SchedulableTaskCard = React.memo(function SchedulableTaskCard({ 
    redirect = false, 
    categoryId, 
    task, 
    categoryName,
    onRightSwipe 
}: Props) {
    const { removeFromCategory, setShowConfetti } = useTasks();
    const ThemedColor = useThemeColor();

    /* 
  Mark as completed function
*/

    const deleteTask = useCallback(async (categoryId: string, taskId: string) => {
        try {
            const res = await removeFromCategoryAPI(categoryId, taskId);
            removeFromCategory(categoryId, taskId);
        } catch (error) {
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Error deleting task",
                swipeDirection: "up",
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }
    }, [removeFromCategory]);

    // Custom right swipe action - either use provided callback or default delete
    const handleRightSwipe = useCallback(() => {
        if (onRightSwipe) {
            onRightSwipe();
        } else {
            deleteTask(categoryId, task.id);
        }
    }, [onRightSwipe, deleteTask, categoryId, task.id]);

    // Check if categoryId is configured
    const isCategoryConfigured = categoryId && categoryId.trim() !== "";

    return (
        <>
            <ReanimatedSwipeable
                containerStyle={styles.swipeable}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={Dimensions.get("window").width / 3}
                overshootLeft={true}
                overshootFriction={2.7}
                renderLeftActions={(prog, drag) =>
                    LeftAction(prog, drag, categoryId, task.id, onRightSwipe)
                }
                rightThreshold={100}
                overshootRight={true}
                renderRightActions={(prog, drag) => RightAction(prog, drag, handleRightSwipe)}>
                <TaskCard
                    content={task.content}
                    value={task.value}
                    priority={task.priority as 1 | 2 | 3}
                    redirect={redirect}
                    id={task.id}
                    categoryId={categoryId}
                    task={{ ...task }}
                    showRedOutline={!isCategoryConfigured}
                />
            </ReanimatedSwipeable>
        </>
    );
});

export default SchedulableTaskCard;

function LeftAction(
    prog: SharedValue<number>,
    drag: SharedValue<number>,
    categoryId: string,
    id: string,
    onRightSwipe: () => void
) {
    let width = Dimensions.get("window").width;
    const [isCompleting, setIsCompleting] = React.useState(false);
    const ThemedColor = useThemeColor();

    // Use useAnimatedReaction to watch the drag value
    useAnimatedReaction(
        () => drag.value,
        (currentValue) => {
            let threshold = width / 4;
            let percent = (currentValue - threshold * 3) / threshold;
            let opacity = 1 - percent;

            if (opacity <= 0 && !isCompleting) {
                runOnJS(setIsCompleting)(true);
                runOnJS(onRightSwipe)();
                runOnJS(setIsCompleting)(false);
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

    return (
        <Reanimated.View
            style={[
                styleAnimation,
                {
                    backgroundColor: ThemedColor.success,
                    width: width,
                    justifyContent: "center",
                    alignItems: "center",
                },
            ]}></Reanimated.View>
    );
}

const RIGHT_ACTION_WIDTH = 75;

function RightAction(prog: SharedValue<number>, drag: SharedValue<number>, callback: () => void) {
    const ThemedColor = useThemeColor();

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + RIGHT_ACTION_WIDTH }],
        };
    });

    return (
        <Reanimated.View
            style={[
                styleAnimation,
                { backgroundColor: ThemedColor.error, justifyContent: "center", alignItems: "center" },
            ]}>
            <TouchableOpacity onPress={() => callback()}>
                <Entypo name="cross" size={24} color="white" style={styles.rightAction} />
            </TouchableOpacity>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    swipeable: {
        flex: 1,
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
