import React from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import { ToastableBodyParams, hideToastable } from "react-native-toastable";
import { ThemedText } from "../ThemedText";
import { CheckCircle, Info, Warning, WarningCircle, type Icon } from "phosphor-react-native";
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

export default function DefaultToast({ status, message, title }: ToastableBodyParams) {
    const ThemedColor = useThemeColor();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);

    // Reset values on component mount
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
            // Track both horizontal and vertical movement
            translateX.value = startX.value + event.translationX;
            translateY.value = startY.value + event.translationY;

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
                translateX.value = withTiming(0, { duration: 200 });
                translateY.value = withTiming(0, { duration: 200 });
                opacity.value = withTiming(1, { duration: 200 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
            ] as any,
            opacity: opacity.value,
        };
    });

    const statusMapping: Record<string, { color: string; Icon: Icon }> = {
        success: { color: ThemedColor.success, Icon: CheckCircle },
        danger: { color: ThemedColor.error, Icon: WarningCircle },
        warning: { color: ThemedColor.warning, Icon: Warning },
        info: { color: ThemedColor.primary, Icon: Info },
        neutral: { color: ThemedColor.caption, Icon: Info },
    };
    const { color: accent, Icon: StatusIcon } = statusMapping[status ?? "info"] ?? statusMapping.info;
    // Status colors are hex; drop any alpha channel and apply a soft tint for the icon badge
    const accentTint = `${String(accent).slice(0, 7)}26`;

    return (
        <GestureDetector gesture={panGesture}>
            <Reanimated.View style={animatedStyle as any}>
                <View style={styles.container}>
                    <View
                        style={[
                            styles.toastBody,
                            { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary },
                        ]}>
                        <View style={[styles.iconBadge, { backgroundColor: accentTint }]}>
                            <StatusIcon size={20} color={accent} weight="fill" />
                        </View>
                        <View style={styles.textColumn}>
                            {title ? (
                                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                                    {title}
                                </ThemedText>
                            ) : null}
                            <ThemedText
                                type={title ? "smallerDefault" : "defaultSemiBold"}
                                style={title ? { color: ThemedColor.caption } : undefined}
                                numberOfLines={3}>
                                {message}
                            </ThemedText>
                        </View>
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
    },
    toastBody: {
        width: "100%",
        maxWidth: 480,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 12,
        paddingLeft: 12,
        paddingRight: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 6,
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    textColumn: {
        flex: 1,
        gap: 2,
    },
});
