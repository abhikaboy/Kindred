import React from "react";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type Props = Omit<React.ComponentProps<typeof BlurView>, "intensity"> & {
    /** Full strength when `progress` is 1. */
    intensity: number;
    progress: SharedValue<number>;
};

// iOS blur views ignore their parent's opacity (the blur pops on at full strength), so
// fading one in or out has to animate its own intensity.
export function FadingBlurView({ intensity, progress, ...rest }: Props) {
    const animatedProps = useAnimatedProps(() => ({ intensity: intensity * progress.value }));
    return <AnimatedBlurView {...rest} animatedProps={animatedProps} />;
}
