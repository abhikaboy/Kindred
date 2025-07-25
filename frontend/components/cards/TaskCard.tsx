import React, { useEffect, useMemo, useState, useRef } from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions, Alert } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import EditPost from "../modals/edit/EditPost";
import { Task } from "@/api/types";
import Svg, { Circle, Rect, Path } from "react-native-svg";
import ConditionalView from "../ui/ConditionalView";
import { useTasks } from "@/contexts/tasksContext";
import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useDebounce } from "@/hooks/useDebounce";
import EncourageModal from "../modals/EncourageModal";
import CongratulateModal from "../modals/CongratulateModal";

export const PRIORITY_MAP = {
    0: "none",
    1: "low",
    2: "medium",
    3: "high",
} as const;

type Priority = keyof typeof PRIORITY_MAP;
type PriorityLevel = (typeof PRIORITY_MAP)[Priority];

interface Props {
    content: string;
    value: number;
    priority: Priority;
    redirect?: boolean;
    encourage?: boolean;
    congratulate?: boolean;
    id: string;
    categoryId: string;
    task?: Task;
    height?: number;
    encouragementConfig?: {
        userHandle?: string;
        receiverId: string;
        categoryName: string;
    };
    congratulationConfig?: {
        userHandle?: string;
        receiverId: string;
        categoryName: string;
    };
}

const TaskCard = ({
    content,
    value,
    priority,
    redirect = false,
    id,
    categoryId,
    encourage = false,
    congratulate = false,
    task,
    height = Dimensions.get("window").height * 0.07,
    encouragementConfig,
    congratulationConfig,
}: Props) => {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [showEncourageModal, setShowEncourageModal] = useState(false);
    const [showCongratulateModal, setShowCongratulateModal] = useState(false);
    const ThemedColor = useThemeColor();
    const { setTask } = useTasks();
    const [isRunningState, setIsRunningState] = useState(false);
    const isMounted = useRef(true);

    const debouncedRedirect = useDebounce(() => {
        if (!redirect) return;
        router.push({
            pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
            params: { name: content, id: id, categoryId: categoryId },
        });
    }, 100);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        // const checkTimerState = async () => {
        //     try {
        //         const isRunning = await AsyncStorage.getItem(`task_${id}_isRunning`);
        //         if (isMounted.current) {
        //             setIsRunningState(isRunning === "true");
        //         }
        //     } catch (error) {
        //         console.error("Error checking timer state:", error);
        //     }
        // };
        // checkTimerState();
    }, [id]);

    const getPriorityColor = (level: PriorityLevel) => {
        switch (level) {
            case "none":
                return ThemedColor.disabled + "00";
            case "low":
                return ThemedColor.success;
            case "medium":
                return ThemedColor.warning;
            case "high":
                return ThemedColor.error;
        }
    };

    const handlePress = () => {
        if (encourage) {
            if (!encouragementConfig?.receiverId || encouragementConfig.receiverId.trim() === "") {
                console.error("Cannot show encourage modal: missing receiverId");
                Alert.alert("Error", "Unable to send encouragement at this time. Please try again later.");
                return;
            }
            console.log("Encourage button pressed, showing modal");
            setShowEncourageModal(true);
        }
        if (congratulate) {
            if (!congratulationConfig?.receiverId || congratulationConfig.receiverId.trim() === "") {
                console.error("Cannot show congratulate modal: missing receiverId");
                Alert.alert("Error", "Unable to send congratulation at this time. Please try again later.");
                return;
            }
            console.log("Congratulate button pressed, showing modal");
            setShowCongratulateModal(true);
        }
        if (task) {
            setTask(task);
            debouncedRedirect();
        } else {
            // theres some error
        }
    };

    const handleLongPress = () => {
        if (redirect) setEditing(true);
    };

    return (
        <>
            <TouchableOpacity
                style={[
                    styles.container,
                    {
                        backgroundColor: ThemedColor.lightened,
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                        minHeight: height,
                    },
                ]}
                disabled={!redirect && !encourage && !congratulate}
                onPress={handlePress}
                onLongPress={handleLongPress}>
                <EditPost visible={editing} setVisible={setEditing} id={{ id, category: categoryId }} />

                <View style={styles.row}>
                    <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.content} type="default">
                        {content}
                    </ThemedText>
                    <View style={styles.row}>
                        <ConditionalView condition={!encourage}>
                            <ConditionalView condition={isRunningState}>
                                <MaterialIcons name="timer" size={20} color={ThemedColor.caption} />
                            </ConditionalView>
                            <ConditionalView condition={task?.recurring}>
                                <AntDesign name="retweet" size={20} color={ThemedColor.caption} />
                            </ConditionalView>
                            {/* <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                            {value}
                        </ThemedText> */}
                            <View
                                style={[styles.circle, { backgroundColor: getPriorityColor(PRIORITY_MAP[priority]) }]}
                            />
                        </ConditionalView>
                        <ConditionalView condition={encourage}>
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M17.2397 14.3755C17.0452 15.4618 16.5226 16.4624 15.7422 17.2426C14.9618 18.0229 13.961 18.5453 12.8747 18.7395C12.8334 18.7461 12.7918 18.7496 12.75 18.7498C12.5619 18.7498 12.3806 18.679 12.2422 18.5516C12.1038 18.4242 12.0183 18.2494 12.0028 18.0619C11.9872 17.8745 12.0426 17.688 12.1581 17.5394C12.2736 17.3909 12.4407 17.2913 12.6262 17.2602C14.1797 16.9986 15.4978 15.6805 15.7612 14.1242C15.7946 13.928 15.9045 13.7531 16.0667 13.638C16.229 13.5228 16.4304 13.4768 16.6266 13.5102C16.8227 13.5435 16.9976 13.6534 17.1128 13.8156C17.228 13.9779 17.2739 14.1793 17.2406 14.3755H17.2397ZM20.25 13.4998C20.25 15.6879 19.3808 17.7863 17.8336 19.3335C16.2865 20.8807 14.188 21.7498 12 21.7498C9.81196 21.7498 7.71354 20.8807 6.16637 19.3335C4.61919 17.7863 3.75 15.6879 3.75 13.4998C3.75 10.8823 4.78125 8.20579 6.81188 5.54516C6.87615 5.46091 6.95755 5.39124 7.05071 5.34074C7.14387 5.29024 7.24667 5.26005 7.35235 5.25217C7.45802 5.24429 7.56417 5.25889 7.66379 5.29501C7.76341 5.33113 7.85425 5.38795 7.93031 5.46172L10.1916 7.65641L12.2541 1.99297C12.2953 1.88002 12.363 1.77862 12.4516 1.69734C12.5402 1.61606 12.6471 1.55727 12.7632 1.52593C12.8792 1.49459 13.0011 1.49161 13.1186 1.51726C13.2361 1.5429 13.3457 1.59642 13.4381 1.67329C15.4884 3.37485 20.25 7.92641 20.25 13.4998ZM18.75 13.4998C18.75 9.17891 15.3947 5.44485 13.2928 3.53141L11.205 9.25672C11.1621 9.37431 11.0906 9.47931 10.9967 9.56215C10.9029 9.64499 10.7899 9.70303 10.6679 9.73099C10.5459 9.75895 10.4188 9.75593 10.2983 9.72222C10.1778 9.68851 10.0676 9.62517 9.97781 9.53797L7.50562 7.13985C6.00844 9.30079 5.25 11.4373 5.25 13.4998C5.25 15.2901 5.96116 17.0069 7.22703 18.2728C8.4929 19.5387 10.2098 20.2498 12 20.2498C13.7902 20.2498 15.5071 19.5387 16.773 18.2728C18.0388 17.0069 18.75 15.2901 18.75 13.4998Z"
                                    fill="#FF5C5F"
                                />
                            </Svg>
                        </ConditionalView>
                        <ConditionalView condition={congratulate}>
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
                                    fill="#FFD700"
                                />
                            </Svg>
                        </ConditionalView>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Encourage Modal */}
            <EncourageModal
                visible={showEncourageModal}
                setVisible={setShowEncourageModal}
                task={{
                    id,
                    content,
                    value,
                    priority,
                    categoryId,
                }}
                encouragementConfig={encouragementConfig}
            />

            {/* Congratulate Modal */}
            <CongratulateModal
                visible={showCongratulateModal}
                setVisible={setShowCongratulateModal}
                task={{
                    id,
                    content,
                    value,
                    priority,
                    categoryId,
                }}
                congratulationConfig={congratulationConfig}
            />
        </>
    );
};

export default TaskCard;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        borderRadius: 16,
        justifyContent: "center",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
        height: 20,
    },
    circle: {
        width: 10,
        height: 10,
        borderRadius: 10,
    },
    content: {
        textAlign: "left",
    },
});
