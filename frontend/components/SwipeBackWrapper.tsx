import React from "react";
import { Dimensions } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from "react-native-reanimated";
import { router } from "expo-router";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3; // 30% of screen width

interface Props {
    children: React.ReactNode;
}

export default function SwipeBackWrapper({ children }: Props) {
    const translateX = useSharedValue(0);

    const handleNavigateBack = () => {
        router.back();
    };

    const gesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onChange((event) => {
            // Only allow right swipe (positive x translation)
            if (event.translationX > 0) {
                translateX.value = event.translationX;
            }
        })
        .onEnd((event) => {
            if (event.translationX > SWIPE_THRESHOLD) {
                // If swipe distance exceeds threshold, navigate back
                translateX.value = withSpring(SCREEN_WIDTH, {}, () => {
                    runOnJS(handleNavigateBack)();
                });
            } else {
                // Otherwise, spring back to original position
                translateX.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        };
    });

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>
        </GestureDetector>
    );
}
