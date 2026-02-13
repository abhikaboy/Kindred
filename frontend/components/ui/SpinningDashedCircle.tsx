import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useThemeColor } from '@/hooks/useThemeColor';

const AnimatedView = Animated.createAnimatedComponent(View);

export const SpinningDashedCircle = () => {
    const ThemedColor = useThemeColor();
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Create infinite rotation animation (very slow)
        const rotationLoop = Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 10000, // 20 seconds for one full rotation
                useNativeDriver: true,
            }),
            {
                resetBeforeIteration: true, // Reset to 0 before each iteration
            }
        );

        rotationLoop.start();

        // Cleanup: stop animation on unmount
        return () => {
            rotationLoop.stop();
        };
    }, [rotateAnim]);

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <AnimatedView
            style={[
                styles.container,
                {
                    transform: [{ rotate }],
                }
            ]}
        >
            <Svg width="150" height="150" viewBox="0 0 100 100">
                <Circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke={ThemedColor.primary + "20"}
                    strokeWidth="2"
                    strokeDasharray="8 6"
                    fill="none"
                    strokeLinecap="round"
                />
            </Svg>
        </AnimatedView>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: -40,
        right: -50,
        width: 150,
        height: 150,
        zIndex: 1,
    },
});
