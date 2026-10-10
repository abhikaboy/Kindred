import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Reanimated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { Check } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

const PEEK_WIDTH = 84;

/** Onboarding: a green flap slides over the card's left edge and back, showing the swipe without completing. */
export default function CompleteSwipeNudge() {
    const ThemedColor = useThemeColor();
    const reveal = useSharedValue(0);

    useEffect(() => {
        reveal.value = withRepeat(
            withSequence(
                withDelay(900, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })),
                withDelay(500, withTiming(0, { duration: 450, easing: Easing.in(Easing.cubic) })),
                withDelay(1300, withTiming(0, { duration: 0 }))
            ),
            -1
        );
        return () => cancelAnimation(reveal);
    }, [reveal]);

    const flap = useAnimatedStyle(() => ({ width: reveal.value * PEEK_WIDTH, opacity: reveal.value > 0 ? 1 : 0 }));

    return (
        <Reanimated.View pointerEvents="none" style={[styles.flap, { backgroundColor: ThemedColor.success }, flap]}>
            <Check size={22} color="white" weight="bold" />
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    flap: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
});
