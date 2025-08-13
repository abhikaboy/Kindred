// Wrapper for TaskCard that allows for swiping to delete

import React from "react";

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
};

export default function SwipableTaskCard({ redirect = false, categoryId, task, categoryName }: Props) {
    const { removeFromCategory, setShowConfetti, categories } = useTasks();
    const ThemedColor = useThemeColor();
    console.log("🔍 CATEGORY DEBUG:");
    console.log("  - categoryId:", categoryId);
    console.log("  - categoryName prop:", categoryName);
    console.log(
        "  - available categories:",
        categories?.map((c) => ({ id: c.id, name: c.name }))
    );
    console.log(
        "  - lookup result:",
        categories?.find((cat) => cat.id === categoryId)
    );

    const finalCategoryName =
        categoryName || categories?.find((cat) => cat.id === categoryId)?.name || "Unknown Category";

    console.log("  - finalCategoryName:", finalCategoryName);

    /* 
  Mark as completed function

*/

    const deleteTask = async (categoryId: string, taskId: string) => {
        try {
            const res = await removeFromCategoryAPI(categoryId, taskId);
            removeFromCategory(categoryId, taskId);
            showToastable({
                title: "Task deleted!",
                status: "danger",
                position: "top",
                swipeDirection: "up",
                duration: 2500,
                message: "Task deleted!",
                renderContent: (props) => <DefaultToast {...props} />,
            });
            console.log(res);
        } catch (error) {
            console.log(error);
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Error deleting task",
            });
        }
    };

    const markAsCompleted = async (categoryId: string, taskId: string) => {
        try {
            const res = await markAsCompletedAPI(categoryId, taskId, {
                timeCompleted: new Date().toISOString(),
                timeTaken: new Date().toISOString(),
            });
            console.log("res");
            console.log(res);

            // Only update UI state after successful API call
            removeFromCategory(categoryId, taskId);
            setShowConfetti(true);

            if (Platform.OS === "ios") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            const taskData = {
                id: task.id,
                name: task.content,
                category: categoryId,
                categoryName: finalCategoryName,
                points: task.value,
                public: task.public,
            };
            console.log("🔍 FINAL CATEGORY NAME BEING USED:", finalCategoryName);
            console.log("🔍 TASK DATA BEING SENT TO TOAST:", JSON.stringify(taskData, null, 2));

            showToastable({
                title: "Task completed!",
                status: "success",
                position: "top",
                message: "Congrats! Click here to post and document your task!",
                onPress: () => {
                    console.log("pressed");
                },
                swipeDirection: "up",
                duration: 5500,
                renderContent: (props) => <TaskToast {...props} taskData={taskData} />,
            });

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
            });
        }
    };

    const activateTask = async (categoryId: string, taskId: string) => {
        await activateTaskAPI(categoryId, taskId);
    };
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
                    LeftAction(prog, drag, categoryId, task.id, () => markAsCompleted(categoryId, task.id))
                }
                rightThreshold={100}
                overshootRight={true}
                renderRightActions={(prog, drag) => RightAction(prog, drag, () => deleteTask(categoryId, task.id))}>
                <TaskCard
                    content={task.content}
                    value={task.value}
                    priority={task.priority as 1 | 2 | 3}
                    redirect={redirect}
                    id={task.id}
                    categoryId={categoryId}
                    task={{ ...task }}
                />
            </ReanimatedSwipeable>
        </>
    );
}

function LeftAction(
    prog: SharedValue<number>,
    drag: SharedValue<number>,
    categoryId: string,
    id: string,
    markAsCompleted: (categoryId: string, id: string) => Promise<void>
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
                runOnJS(markAsCompleted)(categoryId, id);
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
