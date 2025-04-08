import { useThemeColor } from "@/hooks/useThemeColor";
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { TextInput } from "react-native-gesture-handler";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { ThemedText } from "../ThemedText";

const INITIAL_BOX_SIZE = 40;
const SLIDER_WIDTH = 300;

const STEP_SIZE = SLIDER_WIDTH / 11;

Animated.addWhitelistedNativeProps({ text: true });

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

let ThemedColor = useThemeColor();
const ThemedSlider = () => {
    const offset = useSharedValue(0);
    const MAX_VALUE = SLIDER_WIDTH - INITIAL_BOX_SIZE;
    const POINTS = [
        { label: "0", value: 0 },
        { label: "1", value: 1 },
        { label: "2", value: 2 },
        { label: "3", value: 3 },
        { label: "4", value: 4 },
        { label: "5", value: 5 },
        { label: "6", value: 6 },
        { label: "7", value: 7 },
        { label: "8", value: 8 },
        { label: "9", value: 9 },
        { label: "10", value: 10 },
    ];
    const [step, setStep] = useState(POINTS[0]);
    const pan = Gesture.Pan()
        .onChange((event) => {
            offset.value = Math.max(0, Math.min(MAX_VALUE, offset.value + event.changeX));
        })
        .onEnd(() => {
            const closestStep = Math.round(offset.value / STEP_SIZE) * STEP_SIZE;
            offset.value = closestStep;
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

    useAnimatedReaction(
        () => Math.round(offset.value / STEP_SIZE),
        (stepIndex) => {
            runOnJS(setStep)(POINTS[stepIndex] || POINTS[0]);
        }
    );

    return (
        <View>
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
            <View style={styles.step}>
                <ThemedText type="lightBody" style={styles.stepText}>
                    {step.label}
                </ThemedText>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        //justifyContent: "center",
        //alignItems: "center",
        gap: 32,
    },
    filled: {
        backgroundColor: ThemedColor.primary,
    },
    sliderTrack: {
        width: SLIDER_WIDTH,
        height: 25,
        backgroundColor: ThemedColor.text,
        // backgroundColor: ThemedColor.primary,
        borderRadius: 25,
        justifyContent: "center",
    },
    sliderTrackFilled: {
        width: SLIDER_WIDTH,
        height: 25,
        backgroundColor: ThemedColor.primary,
        // backgroundColor: ThemedColor.primary,
        borderRadius: 25,
        justifyContent: "center",
    },
    sliderHandle: {
        width: 40,
        height: 40,
        backgroundColor: ThemedColor.primary,
        // background: "linear-gradient(to right, #00ff00, #ff0000)",
        borderRadius: 20,
        position: "absolute",
        shadowColor: "rgba(0, 0, 0, 0.25)",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 4,
    },
    boxWidthText: {
        textAlign: "center",
        fontSize: 18,
    },
    step: {
        marginTop: 10,
        alignItems: "flex-start",
    },
    stepText: {
        fontSize: 15,
        color: "white",
    },
});

export default ThemedSlider;
