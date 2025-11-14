import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming, 
    withDelay,
    Easing 
} from "react-native-reanimated";

interface AnimatedViewProps {
    visible: boolean;
    children: React.ReactNode;
    duration?: number;
}

/**
 * AnimatedView - Smoothly cross-fades content while preserving component state
 * 
 * Cross-fade strategy:
 * - All views are absolutely positioned and stacked
 * - When switching: old fades out while new fades in simultaneously
 * - Uses zIndex to control which view is interactive
 * 
 * @param visible - Controls visibility
 * @param children - Content to animate
 * @param duration - Animation duration in ms (default: 250)
 */
export const AnimatedView: React.FC<AnimatedViewProps> = ({ 
    visible, 
    children, 
    duration = 250 
}) => {
    const opacity = useSharedValue(visible ? 1 : 0);
    const prevVisible = useRef(visible);

    useEffect(() => {
        // Only animate if visibility actually changed
        if (prevVisible.current !== visible) {
            prevVisible.current = visible;
            
            if (visible) {
                // Fade in immediately when becoming visible
                opacity.value = withTiming(1, {
                    duration,
                    easing: Easing.out(Easing.cubic),
                });
            } else {
                // Fade out when hiding
                opacity.value = withTiming(0, {
                    duration,
                    easing: Easing.in(Easing.cubic),
                });
            }
        }
    }, [visible, opacity, duration]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        // Use zIndex to control which view receives touches
        zIndex: visible ? 1 : 0,
    }));

    return (
        <Animated.View 
            style={[
                styles.container,
                animatedStyle,
            ]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            {children}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
    },
});

