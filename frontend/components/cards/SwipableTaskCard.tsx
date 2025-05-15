// Wrapper for TaskCard that allows for swiping to delete

import React, { useEffect, useState } from "react";

import TaskCard from "./TaskCard";
import { Task } from "@/api/types";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
import { markAsCompletedAPI, activateTaskAPI } from "@/api/task";
import Confetti from "react-native-simple-confetti";
import { useTasks } from "@/contexts/tasksContext";
type Props = {
    redirect?: boolean;
    categoryId: string;
    task: Task;
};

const ThemedColor = useThemeColor();

/* 
  Mark as completed function
*/

export default function SwipableTaskCard({ redirect = false, categoryId, task }: Props) {
    const { removeFromCategory, setShowConfetti } = useTasks();
    const deleteTask = async (categoryId: string, taskId: string) => {
        // const res = await deleteTask(categoryId, taskId);
        // console.log(res);
        removeFromCategory(categoryId, taskId);
    };
    const markAsCompleted = async (categoryId: string, taskId: string) => {
        const res = await markAsCompletedAPI(categoryId, taskId, {
            timeCompleted: new Date().toISOString(),
            timeTaken: new Date().toISOString(),
        });
        console.log(res);
        removeFromCategory(categoryId, taskId);
        setShowConfetti(true);
        setTimeout(() => {
            setShowConfetti(false);
        }, 1700);
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
                renderLeftActions={(prog, drag) => LeftAction(prog, drag, categoryId, task.id, markAsCompleted)}
                onBegan={(event) => {
                    console.log(event);
                }}
                onSwipeableOpen={(direction) => {
                    if (direction === "right") {
                        console.log(direction);
                        markAsCompleted(categoryId, task.id);
                    }
                }}
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
                    task={task}
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
    markAsCompleted: (categoryId: string, id: string) => void
) {
    let width = Dimensions.get("window").width;
    const styleAnimation = useAnimatedStyle(() => {
        let threshold = width / 4; // if its past the threshold, begin fading out
        let percent = (drag.value - threshold * 3) / threshold;
        let opacity = 1 - percent;
        if (opacity <= 0) {
            // markAsCompleted(categoryId, id);
        }
        return {
            transform: [{ translateX: drag.value - width }],
            opacity: opacity,
            display: opacity > 0 ? "flex" : "none",
        };
    });

    useEffect(() => {
        console.log(prog.value, drag.value);
    }, [prog.value, drag.value]);

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
        backgroundColor: ThemedColor.success,
    },
});
