import React from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & {
    style?: StyleProp<ViewStyle>;
    haptic?: boolean;
};

// Shared tap feedback: a short dim + 2% settle on press-in, never blocking input.
export const QuietPressable = React.forwardRef<any, Props>(
    ({ style, haptic = true, onPressIn, onPressOut, children, ...rest }, ref) => {
        const pressed = useSharedValue(0);
        const animatedStyle = useAnimatedStyle(() => ({
            opacity: 1 - pressed.value * 0.35,
            transform: [{ scale: 1 - pressed.value * 0.02 }],
        }));

        return (
            <AnimatedPressable
                ref={ref}
                {...rest}
                onPressIn={(e) => {
                    pressed.value = withTiming(1, { duration: 80 });
                    if (haptic) Haptics.selectionAsync();
                    onPressIn?.(e);
                }}
                onPressOut={(e) => {
                    pressed.value = withTiming(0, { duration: 180 });
                    onPressOut?.(e);
                }}
                style={[style, animatedStyle]}>
                {children as React.ReactNode}
            </AnimatedPressable>
        );
    }
);
