import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    cancelAnimation,
    Easing,
} from "react-native-reanimated";

// Staggered delays so bars bounce out of phase, like a real equalizer.
const BAR_DELAYS = [0, 140, 70, 200];

export default function Equalizer({ playing, color, size = 16 }: { playing: boolean; color: string; size?: number }) {
    return (
        <View style={[styles.row, { height: size }]}>
            {BAR_DELAYS.map((delay, i) => (
                <EqualizerBar key={i} playing={playing} color={color} delay={delay} maxHeight={size} />
            ))}
        </View>
    );
}

function EqualizerBar({
    playing,
    color,
    delay,
    maxHeight,
}: {
    playing: boolean;
    color: string;
    delay: number;
    maxHeight: number;
}) {
    const fraction = useSharedValue(0.3);

    useEffect(() => {
        if (playing) {
            fraction.value = withDelay(
                delay,
                withRepeat(withTiming(1, { duration: 340, easing: Easing.inOut(Easing.ease) }), -1, true)
            );
        } else {
            cancelAnimation(fraction);
            fraction.value = withTiming(0.3, { duration: 150 });
        }
        return () => cancelAnimation(fraction);
    }, [playing, delay, fraction]);

    const style = useAnimatedStyle(() => ({ height: maxHeight * fraction.value }));

    return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 2,
    },
    bar: {
        width: 3,
        borderRadius: 2,
    },
});
