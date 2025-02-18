import { Colors } from "@/constants/Colors";
import React from "react";
import { View, StyleSheet } from "react-native";
import { TextInput } from "react-native-gesture-handler";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedProps } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const INITIAL_BOX_SIZE = 50;
const SLIDER_WIDTH = 300;

Animated.addWhitelistedNativeProps({ text: true });

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const ThemedSlider = () => {
    const offset = useSharedValue(0);
    const MAX_VALUE = SLIDER_WIDTH - INITIAL_BOX_SIZE;

    const pan = Gesture.Pan().onChange((event) => {
        offset.value =
            Math.abs(offset.value) <= MAX_VALUE
                ? offset.value + event.changeX <= 0
                    ? 0
                    : offset.value + event.changeX >= MAX_VALUE
                      ? MAX_VALUE
                      : offset.value + event.changeX
                : offset.value;
    });

    const sliderStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: offset.value }],
        };
    });
    const filledStyle = useAnimatedStyle(() => {
        return {
            width: offset.value + 20,
        };
    });

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.sliderTrack}>
                <Animated.View style={[styles.sliderTrackFilled, filledStyle]}></Animated.View>
                <GestureDetector gesture={pan}>
                    <Animated.View style={[styles.sliderHandle, sliderStyle]}>
                        <Animated.View style={[styles.filled]}></Animated.View>
                        <View
                            style={{
                                backgroundColor: "#fff",
                                width: 16,
                                height: 16,
                                borderRadius: 12,
                                margin: "auto",
                            }}
                        />
                    </Animated.View>
                </GestureDetector>
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 32,
    },
    filled: {
        backgroundColor: Colors.dark.primary,
    },
    sliderTrack: {
        width: SLIDER_WIDTH,
        height: 25,
        backgroundColor: Colors.dark.text,
        // backgroundColor: Colors.dark.primary,
        borderRadius: 25,
        justifyContent: "center",
        padding: 5,
    },
    sliderTrackFilled: {
        width: SLIDER_WIDTH,
        height: 25,
        backgroundColor: Colors.dark.primary,
        // backgroundColor: Colors.dark.primary,
        borderRadius: 25,
        justifyContent: "center",
        left: -5,
    },
    sliderHandle: {
        width: 40,
        height: 40,
        backgroundColor: Colors.dark.primary,
        // background: "linear-gradient(to right, #00ff00, #ff0000)",
        borderRadius: 20,
        position: "absolute",
        left: 5,
    },
    boxWidthText: {
        textAlign: "center",
        fontSize: 18,
    },
});

export default ThemedSlider;
