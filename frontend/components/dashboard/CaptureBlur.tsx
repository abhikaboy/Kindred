import React, { useState } from "react";
import { Keyboard, Pressable, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Reanimated, {
    SharedValue,
    runOnJS,
    useAnimatedProps,
    useAnimatedReaction,
    useSharedValue,
} from "react-native-reanimated";

const MAX_INTENSITY = 24;

const AnimatedBlurView = Reanimated.createAnimatedComponent(BlurView);

interface CaptureBlurProps {
    progress: SharedValue<number>;
    style?: ViewStyle;
}

/**
 * Blurs whatever it's layered over while QuickCapture is focused. Intensity is
 * driven by a shared value on the UI thread, so focusing the field never
 * re-renders the screen underneath. The blur view is only mounted while the
 * field is focused or fading, so it costs nothing while you scroll the
 * dashboard. While fading in or held, tapping it dismisses the keyboard (which
 * unfocuses the field) and swallows the tap so it can't also open the card
 * underneath. While fading out it lets touches through, so tapping straight
 * back into the shrinking field isn't eaten.
 */
export default function CaptureBlur({ progress, style }: CaptureBlurProps) {
    const [mounted, setMounted] = useState(false);
    const [interactive, setInteractive] = useState(false);
    const rising = useSharedValue(false);

    useAnimatedReaction(
        () => progress.value,
        (value, previous) => {
            const prev = previous ?? 0;
            if (value > 0 !== prev > 0) runOnJS(setMounted)(value > 0);
            // Hop to JS only when the direction flips, not every frame
            if (value !== prev && value > prev !== rising.value) {
                rising.value = value > prev;
                runOnJS(setInteractive)(value > prev);
            }
        }
    );

    const animatedProps = useAnimatedProps(() => ({
        intensity: progress.value * MAX_INTENSITY,
    }));

    if (!mounted) return null;

    return (
        <Pressable
            onPress={Keyboard.dismiss}
            pointerEvents={interactive ? "auto" : "none"}
            accessibilityLabel="Close task input"
            style={[StyleSheet.absoluteFill, style]}>
            <AnimatedBlurView tint="default" animatedProps={animatedProps} style={StyleSheet.absoluteFill} />
        </Pressable>
    );
}
