import React from "react";
import { Pressable, SafeAreaView, View, StyleSheet, Button } from "react-native";
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import AntDesign from "@expo/vector-icons/AntDesign";

const ThemedSwitch = ({ value, onPress, style, duration = 400, trackColors = { on: "#82cab2", off: "#fa7f7c" } }) => {
    const height = useSharedValue(0);
    const width = useSharedValue(0);

    const trackAnimatedStyle = useAnimatedStyle(() => {
        const color = interpolateColor(value.value, [0, 1], [trackColors.off, trackColors.on]);
        const colorValue = withTiming(color, { duration });

        return {
            backgroundColor: colorValue,
            borderRadius: height.value / 2,
        };
    });

    const thumbAnimatedStyle = useAnimatedStyle(() => {
        const moveValue = interpolate(Number(value.value), [0, 1], [0, width.value - height.value]);
        const translateValue = withTiming(moveValue, { duration });

        return {
            transform: [{ translateX: translateValue }],
            borderRadius: height.value / 2,
        };
    });

    return (
        <Pressable onPress={onPress}>
            <Animated.View
                onLayout={(e) => {
                    height.value = e.nativeEvent.layout.height;
                    width.value = e.nativeEvent.layout.width;
                }}
                style={[switchStyles.track, style, trackAnimatedStyle]}>
                <Animated.View style={[switchStyles.thumb, thumbAnimatedStyle]}>
                    <AntDesign name={value.value ? "eye" : "eyeo"} size={24} color={trackColors.on} />
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
};

const switchStyles = StyleSheet.create({
    track: {
        alignItems: "flex-start",
        width: 50,
        height: 30,
        padding: 3,
        boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.1)",
    },
    thumb: {
        height: "100%",
        aspectRatio: 1,
        backgroundColor: "white",
    },
});

export default ThemedSwitch;
