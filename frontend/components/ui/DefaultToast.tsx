import React from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { ToastableBodyParams, hideToastable } from "react-native-toastable";
import { ThemedText } from "../ThemedText";
import Entypo from "@expo/vector-icons/Entypo";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
    withSpring,
    withTiming,
} from "react-native-reanimated";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function DefaultToast({ status, message }: ToastableBodyParams) {
    const ThemedColor = useThemeColor();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);

    const panGesture = Gesture.Pan()
        .onStart((_, context) => {
            context.startX = translateX.value;
            context.startY = translateY.value;
        })
        .onUpdate((event, context) => {
            // Track both horizontal and vertical movement
            translateX.value = context.startX + event.translationX;
            translateY.value = context.startY + event.translationY;

            // Update opacity based on swipe distance (either direction)
            const horizontalProgress = Math.abs(translateX.value) / (screenWidth * 0.3);
            const verticalProgress = Math.abs(translateY.value) / (screenHeight * 0.2);
            const maxProgress = Math.max(horizontalProgress, verticalProgress);
            opacity.value = Math.max(0.3, 1 - maxProgress);
        })
        .onEnd((event) => {
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
        });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value }
            ],
            opacity: opacity.value,
        };
    });

    const statusMapping = {
        success: {
            color: ThemedColor.success,
            icon: "check",
        },
        danger: {
            color: ThemedColor.error,
            icon: "cross",
        },
        warning: {
            color: ThemedColor.warning,
            icon: "warning",
        },
        info: {
            color: ThemedColor.primary,
            icon: "info",
        },
    };

    // Reset values on component mount
    React.useEffect(() => {
        translateX.value = 0;
        translateY.value = 0;
        opacity.value = 1;
    }, []);

    const styles = StyleSheet.create({
        container: {
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
        },
        toastBody: {
            minWidth: screenWidth * 0.8,
            maxWidth: screenWidth * 0.9,
            alignItems: "center",
            borderRadius: 12,
            borderBottomWidth: 3,
            borderColor: statusMapping[status]?.color || ThemedColor.primary,
            paddingVertical: 16,
            paddingHorizontal: 20,
            backgroundColor: ThemedColor.lightened,
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 3,
            },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8, // For Android shadow
        },
        iconContainer: {
            marginBottom: 8,
        },
        messageText: {
            textAlign: "center",
            fontSize: 16,
            lineHeight: 22,
            flexWrap: "wrap",
        },
    });

    return (
        <GestureDetector gesture={panGesture}>
            <Reanimated.View style={animatedStyle as any}>
                <View style={styles.container}>
                    <View style={styles.toastBody}>
                        <ThemedText type="defaultSemiBold" style={{textAlign: "center"}}>{message}</ThemedText>
                    </View>
                </View>
            </Reanimated.View>
        </GestureDetector>
    );
}