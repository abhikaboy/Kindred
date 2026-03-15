import React, { useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";

const HANDLE_SIZE = 22;

interface TimeRangeGhostBlockProps {
    startMinutes: SharedValue<number>;
    endMinutes: SharedValue<number>;
    hourHeightShared: SharedValue<number>;
    timeLabel: string;
    onConfirm: () => void;
    onTimeLabelUpdate: (startMins: number, endMins: number) => void;
}

export const TimeRangeGhostBlock: React.FC<TimeRangeGhostBlockProps> = ({
    startMinutes,
    endMinutes,
    hourHeightShared,
    timeLabel,
    onConfirm,
    onTimeLabelUpdate,
}) => {
    const ThemedColor = useThemeColor();

    const lastSnapStart = useSharedValue(startMinutes.value);
    const lastSnapEnd = useSharedValue(endMinutes.value);

    const triggerHaptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Top handle pan: adjusts start time
    const topHandlePan = Gesture.Pan()
        .onStart(() => {
            "worklet";
            lastSnapStart.value = startMinutes.value;
        })
        .onUpdate((e) => {
            "worklet";
            const deltaMins = (e.translationY / hourHeightShared.value) * 60;
            const raw = lastSnapStart.value + deltaMins;
            const snapped = Math.round(Math.max(0, Math.min(endMinutes.value - 15, raw)) / 15) * 15;
            if (snapped !== startMinutes.value) {
                startMinutes.value = snapped;
                runOnJS(triggerHaptic)();
                runOnJS(onTimeLabelUpdate)(snapped, endMinutes.value);
            }
        });

    // Bottom handle pan: adjusts end time
    const bottomHandlePan = Gesture.Pan()
        .onStart(() => {
            "worklet";
            lastSnapEnd.value = endMinutes.value;
        })
        .onUpdate((e) => {
            "worklet";
            const deltaMins = (e.translationY / hourHeightShared.value) * 60;
            const raw = lastSnapEnd.value + deltaMins;
            const snapped = Math.round(Math.max(startMinutes.value + 15, Math.min(1440, raw)) / 15) * 15;
            if (snapped !== endMinutes.value) {
                endMinutes.value = snapped;
                runOnJS(triggerHaptic)();
                runOnJS(onTimeLabelUpdate)(startMinutes.value, snapped);
            }
        });

    const containerStyle = useAnimatedStyle(() => {
        const topPx = (startMinutes.value / 60) * hourHeightShared.value;
        const bottomPx = (endMinutes.value / 60) * hourHeightShared.value;
        return {
            top: topPx,
            height: Math.max(bottomPx - topPx, 4),
        };
    });

    const textOpacity = useAnimatedStyle(() => {
        const h = ((endMinutes.value - startMinutes.value) / 60) * hourHeightShared.value;
        return { opacity: h > 30 ? 1 : 0 };
    });

    return (
        <Animated.View
            style={[
                styles.container,
                containerStyle,
                {
                    backgroundColor: `${ThemedColor.primary}25`,
                    borderColor: ThemedColor.primary,
                },
            ]}
        >
            {/* Top handle */}
            <GestureDetector gesture={topHandlePan}>
                <Animated.View style={styles.topHandleHitArea}>
                    <View
                        style={[
                            styles.handle,
                            { backgroundColor: ThemedColor.primary },
                        ]}
                    />
                </Animated.View>
            </GestureDetector>

            {/* Body — tap handled by parent gesture */}
            <View style={styles.body}>
                <Animated.View style={textOpacity}>
                    <Animated.Text
                        style={[styles.label, { color: ThemedColor.primary }]}
                    >
                        {timeLabel}
                    </Animated.Text>
                </Animated.View>
                <View
                    style={[
                        styles.confirmBadge,
                        { backgroundColor: ThemedColor.primary },
                    ]}
                >
                    <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
            </View>

            {/* Bottom handle */}
            <GestureDetector gesture={bottomHandlePan}>
                <Animated.View style={styles.bottomHandleHitArea}>
                    <View
                        style={[
                            styles.handle,
                            { backgroundColor: ThemedColor.primary },
                        ]}
                    />
                </Animated.View>
            </GestureDetector>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        borderWidth: 2,
        borderRadius: 10,
        zIndex: 200,
    },
    topHandleHitArea: {
        position: "absolute",
        top: -HANDLE_SIZE / 2 - 6,
        left: 0,
        right: 0,
        height: HANDLE_SIZE + 12,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 210,
    },
    bottomHandleHitArea: {
        position: "absolute",
        bottom: -HANDLE_SIZE / 2 - 6,
        left: 0,
        right: 0,
        height: HANDLE_SIZE + 12,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 210,
    },
    handle: {
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        borderRadius: HANDLE_SIZE / 2,
        borderWidth: 3,
        borderColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 4,
    },
    body: {
        flex: 1,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    label: {
        fontSize: 13,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    confirmBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
    },
});
