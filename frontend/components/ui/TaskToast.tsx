import { View, Text, Animated, Dimensions, TouchableOpacity } from "react-native";
import React, { useRef } from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ProgressBar from "./ProgressBar";
import Entypo from "@expo/vector-icons/Entypo";
import { hideToastable, ToastableBodyParams } from "react-native-toastable";
import { PanGestureHandler, PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedGestureHandler,
    runOnJS,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface TaskToastProps extends ToastableBodyParams {
    taskData?: {
        id: string;
        name: string;
        category: string;
        categoryName: string;
        points?: number;
        public?: boolean;
    };
}
export default function TaskToast(props: TaskToastProps) {
    const ThemedColor = useThemeColor();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);

    const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
        onStart: (_, context) => {
            context.startX = translateX.value;
            context.startY = translateY.value;
        },
        onActive: (event, context) => {
            // Track both horizontal and vertical movement
            translateX.value = context.startX + event.translationX;
            translateY.value = context.startY + event.translationY;

            // Update opacity based on swipe distance (either direction)
            const horizontalProgress = Math.abs(translateX.value) / (screenWidth * 0.3);
            const verticalProgress = Math.abs(translateY.value) / (screenHeight * 0.2);
            const maxProgress = Math.max(horizontalProgress, verticalProgress);
            opacity.value = Math.max(0.3, 1 - maxProgress);
        },
        onEnd: (event) => {
            const horizontalThreshold = screenWidth * 0.25; // 25% of screen width
            const verticalThreshold = screenHeight * 0.15; // 15% of screen height
            const velocityX = event.velocityX;
            const velocityY = event.velocityY;

            // Check for horizontal swipe dismiss
            const shouldDismissHorizontal =
                Math.abs(translateX.value) > horizontalThreshold || Math.abs(velocityX) > 500;

            // Check for upward swipe dismiss (negative Y is up)
            const shouldDismissVertical = translateY.value < -verticalThreshold || velocityY < -500;

            if (shouldDismissHorizontal || shouldDismissVertical) {
                // Dismiss the toast
                if (shouldDismissVertical) {
                    // Swipe up - move toast upward off screen
                    translateY.value = withTiming(-screenHeight, { duration: 200 });
                } else {
                    // Swipe horizontal - move toast sideways off screen
                    const direction = translateX.value > 0 ? 1 : -1;
                    translateX.value = withTiming(direction * screenWidth, { duration: 200 });
                }
                opacity.value = withTiming(0, { duration: 200 });

                // Call dismiss function if available
                runOnJS(hideToastable)();
            } else {
                // Spring back to original position
                translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
                opacity.value = withSpring(1, { damping: 20, stiffness: 300 });
            }
        },
    });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
            opacity: opacity.value,
        };
    });
    translateX.value = 0;
    translateY.value = 0;
    opacity.value = 1;

    const router = useRouter();

    const handleNavigateToCamera = () => {
        const taskInfo = props.taskData
            ? {
                  id: props.taskData.id,
                  name: props.taskData.name,
                  category: props.taskData.category,
                  categoryName: props.taskData.categoryName,
                  points: props.taskData.points,
                  public: props.taskData.public,
              }
            : null;
        router.push({
            pathname: "/posting/cameraview",
            params: taskInfo
                ? {
                      taskInfo: JSON.stringify(taskInfo),
                  }
                : {},
        });
    };
    return (
        <PanGestureHandler onGestureEvent={gestureHandler} enabled={true}>
            <Reanimated.View style={[animatedStyle]}>
                <Animated.View
                    style={{
                        backgroundColor: ThemedColor.lightened,
                        borderRadius: 12,
                        boxShadow: `0px 4px 16px 0px #00000050`,
                        flexDirection: "column",
                        padding: 0,
                    }}>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            padding: 20,
                        }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, width: "80%" }}>
                            <Text style={{ fontSize: 30, fontWeight: "bold" }}>🎉</Text>
                            <ThemedText>{props.message}</ThemedText>
                        </View>
                        <TouchableOpacity onPress={handleNavigateToCamera}>
                            <Entypo name="chevron-right" size={24} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </View>
                    <ProgressBar start={0} bar={ThemedColor.success} />
                </Animated.View>
            </Reanimated.View>
        </PanGestureHandler>
    );
}
