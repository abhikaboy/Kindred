import React from "react";
import { View, Dimensions, StyleSheet, TouchableOpacity } from "react-native";
import { ToastableBodyParams, hideToastable } from "react-native-toastable";
import { ThemedText } from "../ThemedText";
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

interface UndoToastProps extends ToastableBodyParams {
    onUndo: () => void;
    count: number;
}

export default function UndoToast({ message, onUndo, count }: UndoToastProps) {
    const ThemedColor = useThemeColor();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);

    React.useEffect(() => {
        translateX.value = 0;
        translateY.value = 0;
        opacity.value = 1;
    }, []);

    const panGesture = Gesture.Pan()
        .onBegin(() => {
            startX.value = translateX.value;
            startY.value = translateY.value;
        })
        .onUpdate((event) => {
            translateX.value = startX.value + event.translationX;
            translateY.value = startY.value + event.translationY;
            const horizontalProgress = Math.abs(translateX.value) / (screenWidth * 0.3);
            const verticalProgress = Math.abs(translateY.value) / (screenHeight * 0.2);
            const maxProgress = Math.max(horizontalProgress, verticalProgress);
            opacity.value = Math.max(0.3, 1 - maxProgress);
        })
        .onEnd((event) => {
            const horizontalThreshold = screenWidth * 0.25;
            const verticalThreshold = screenHeight * 0.15;
            const shouldDismissHorizontal =
                Math.abs(translateX.value) > horizontalThreshold || Math.abs(event.velocityX) > 500;
            const shouldDismissVertical =
                translateY.value < -verticalThreshold || event.velocityY < -500;

            if (shouldDismissHorizontal || shouldDismissVertical) {
                if (shouldDismissVertical) {
                    translateY.value = withTiming(-screenHeight, { duration: 200 });
                } else {
                    const direction = translateX.value > 0 ? 1 : -1;
                    translateX.value = withTiming(direction * screenWidth, { duration: 200 });
                }
                opacity.value = withTiming(0, { duration: 200 });
                runOnJS(hideToastable)();
            } else {
                translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
                opacity.value = withSpring(1, { damping: 20, stiffness: 300 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
        ],
        opacity: opacity.value,
    }));

    const label = count === 1 ? "1 task deleted" : `${count} tasks deleted`;

    return (
        <GestureDetector gesture={panGesture}>
            <Reanimated.View style={animatedStyle as any}>
                <View style={styles.container}>
                    <View style={[styles.toastBody, {
                        borderColor: ThemedColor.warning,
                        backgroundColor: ThemedColor.lightened,
                    }]}>
                        <ThemedText type="defaultSemiBold" style={styles.messageText}>
                            {label}
                        </ThemedText>
                        <TouchableOpacity onPress={onUndo} hitSlop={8} style={styles.undoButton}>
                            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                                Undo
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Reanimated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    toastBody: {
        minWidth: screenWidth * 0.8,
        maxWidth: screenWidth * 0.9,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: 12,
        borderBottomWidth: 3,
        paddingVertical: 16,
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    messageText: {
        fontSize: 16,
        flexShrink: 1,
    },
    undoButton: {
        marginLeft: 16,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
});
