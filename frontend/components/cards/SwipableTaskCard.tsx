// Wrapper for TaskCard that allows for swiping to delete

import React from "react";

import TaskCard from "./TaskCard";

import { Task } from "@/api/types";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, { SharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useThemeColor } from "@/hooks/useThemeColor";
import { markAsCompletedAPI, activateTaskAPI, removeFromCategoryAPI } from "@/api/task";
import { useTasks } from "@/contexts/tasksContext";
import { hideToastable, showToastable } from "react-native-toastable";
import TaskToast from "../ui/TaskToast";
import DefaultToast from "../ui/DefaultToast";
import * as Haptics from "expo-haptics";
import Octicons from "@expo/vector-icons/Octicons";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
type Props = {
    redirect?: boolean;
    categoryId: string;
    task: Task;
    categoryName?: string;
    highlightContent?: boolean;
};

export default function SwipableTaskCard({ redirect = false, categoryId, task, categoryName, highlightContent = false }: Props) {
    const { removeFromCategory, setShowConfetti, categories } = useTasks();
    const ThemedColor = useThemeColor();

    const finalCategoryName =
        categoryName || categories?.find((cat) => cat.id === categoryId)?.name || "Unknown Category";


    /* 
  Mark as completed function

*/

    const deleteTask = async (categoryId: string, taskId: string) => {
        try {
            const res = await removeFromCategoryAPI(categoryId, taskId);
            removeFromCategory(categoryId, taskId);
            console.log(res);
        } catch (error) {
            console.log(error);
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Error deleting task",
                swipeDirection: "up",
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }
    };

    const markAsCompleted = async (categoryId: string, taskId: string) => {
        try {
            const res = await markAsCompletedAPI(categoryId, taskId, {
                timeCompleted: new Date().toISOString(),
                timeTaken: new Date().toISOString(),
            });
            console.log("Task completion result:", res);

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

            // Build title and message based on streak status
            let title = "Task completed!";
            let message = "Congrats! Click here to post and document your task!";
            
            if (res.streakChanged) {
                title = `🔥 Task completed - ${res.currentStreak} day streak!`;
                message = `Keep it up! You're on a ${res.currentStreak} day streak! Click here to post!`;
            }

            // Show completion toast with streak info included if applicable
            if (task.public) {
                showToastable({
                    title,
                    status: "success",
                    position: "top",
                    message,
                    onPress: () => {
                        console.log("pressed");
                    },
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
                renderRightActions={(prog, drag) => (
                    <View style={{ flexDirection: "row" }}>
                        {RightAction(
                            prog,
                            drag,
                            () => console.log("pressed"),
                            3,
                            <Ionicons name="alarm-outline" size={32} color="white" style={styles.rightAction} />,
                            ThemedColor.primary
                        )}
                        {RightAction(
                            prog,
                            drag,
                            () => console.log("pressed"),
                            3,
                            <Feather name="flag" size={24} color="white" style={styles.rightAction} />,
                            ThemedColor.primary
                        )}
                        {RightAction(
                            prog,
                            drag,
                            () => deleteTask(categoryId, task.id),
                            3,
                            <Octicons name="trash" size={24} color="white" style={styles.rightAction} />,
                            ThemedColor.error
                        )}
                    </View>
                )}>
                <TaskCard
                    content={task.content}
                    value={task.value}
                    priority={task.priority as 1 | 2 | 3}
                    redirect={redirect}
                    id={task.id}
                    categoryId={categoryId}
                    task={{ ...task }}
                    highlightContent={highlightContent}
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
                runOnJS(markAsCompleted)(categoryId, id); // runs only once
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

function RightAction(
    prog: SharedValue<number>,
    drag: SharedValue<number>,
    callback: () => void,
    index: number,
    icon: React.ReactNode,
    color: string
) {
    const ThemedColor = useThemeColor();

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + RIGHT_ACTION_WIDTH * index }],
        };
    });

    return (
        <Reanimated.View
            style={[styleAnimation, { backgroundColor: color, justifyContent: "center", alignItems: "center" }]}>
            <TouchableOpacity onPress={() => callback()}>{icon}</TouchableOpacity>
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
