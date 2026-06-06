import React, { useEffect, useState } from "react";
import { StyleSheet, StyleProp, ViewStyle } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    type SharedValue,
} from "react-native-reanimated";

const BAR_COUNT = 28;
// How often a new loudness sample is pushed into the buffer (drives scroll speed).
const SAMPLE_INTERVAL_MS = 85;
const MIN_BAR = 2;
const MAX_BAR = 26;

type VoiceWaveformProps = {
    /** Normalized current loudness (0..1), updated on the UI thread. */
    level: SharedValue<number>;
    /** Runs the scroll + fades the waveform in while true. */
    active: boolean;
    color?: string;
    style?: StyleProp<ViewStyle>;
};

/** Scrolling loudness waveform — newest sample enters from the right and scrolls left. */
export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
    level,
    active,
    color = "rgba(255,255,255,0.9)",
    style,
}) => {
    const [samples, setSamples] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
    const appearance = useSharedValue(0);

    useEffect(() => {
        appearance.value = withTiming(active ? 1 : 0, { duration: 250 });
    }, [active, appearance]);

    useEffect(() => {
        if (!active) {
            setSamples(new Array(BAR_COUNT).fill(0));
            return;
        }
        const id = setInterval(() => {
            const v = Math.max(0, Math.min(1, level.value));
            setSamples((prev) => [...prev.slice(1), v]);
        }, SAMPLE_INTERVAL_MS);
        return () => clearInterval(id);
    }, [active, level]);

    const containerStyle = useAnimatedStyle(() => ({ opacity: appearance.value }));

    return (
        <Animated.View style={[styles.container, containerStyle, style]} pointerEvents="none">
            {samples.map((value, i) => (
                <WaveBar key={i} value={value} color={color} />
            ))}
        </Animated.View>
    );
};

const WaveBar: React.FC<{ value: number; color: string }> = ({ value, color }) => {
    const height = useSharedValue(MIN_BAR);

    useEffect(() => {
        height.value = withTiming(MIN_BAR + value * (MAX_BAR - MIN_BAR), {
            duration: 130,
            easing: Easing.out(Easing.quad),
        });
    }, [value, height]);

    const barStyle = useAnimatedStyle(() => ({ height: height.value }));

    return <Animated.View style={[styles.bar, { backgroundColor: color }, barStyle]} />;
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: MAX_BAR,
        gap: 3,
    },
    bar: {
        width: 3,
        borderRadius: 1.5,
    },
});

export default VoiceWaveform;
