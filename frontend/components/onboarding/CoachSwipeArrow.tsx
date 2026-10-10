import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";
import { CaretDown, CaretUp } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    direction?: "up" | "down";
    visible?: boolean;
    testID?: string;
};

const SIZE = 28;
export const SWIPE_ARROW_SIZE = { width: 40, height: SIZE } as const;
const DRIFT = 6;
const HALF_CYCLE_MS = 800;

/** One quiet chevron drifting a few px in its direction; fills the rect its parent positions. Static under reduced motion. */
export default function CoachSwipeArrow({
    direction = "up",
    visible = true,
    testID = "coach-swipe-arrow",
}: Props) {
    const ThemedColor = useThemeColor();
    const [reduceMotion, setReduceMotion] = useState(false);
    const phase = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let alive = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then((v) => alive && setReduceMotion(v))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (!visible || reduceMotion) return;
        const easing = Easing.inOut(Easing.quad);
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(phase, { toValue: 1, duration: HALF_CYCLE_MS, easing, useNativeDriver: true }),
                Animated.timing(phase, { toValue: 0, duration: HALF_CYCLE_MS, easing, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => {
            loop.stop();
            phase.setValue(0);
        };
    }, [visible, reduceMotion, phase]);

    if (!visible) return null;

    const Chevron = direction === "up" ? CaretUp : CaretDown;
    const sign = direction === "up" ? -1 : 1;
    const motion = reduceMotion
        ? undefined
        : {
              opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
              transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, sign * DRIFT] }) }],
          };

    return (
        <Animated.View
            pointerEvents="none"
            testID={testID}
            style={styles.root}>
            <Animated.View testID={`${testID}-chevron`} style={motion}>
                <Chevron size={SIZE} weight="bold" color={ThemedColor.primary} />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
});
