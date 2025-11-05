import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface SimpleProgressBarProps {
    current: number;
    max: number;
    height?: number;
    animated?: boolean;
}

export default function SimpleProgressBar({ current, max, height = 8, animated = true }: SimpleProgressBarProps) {
    const ThemedColor = useThemeColor();
    const progress = Math.min(current / max, 1);
    const animatedWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (animated) {
            Animated.timing(animatedWidth, {
                toValue: progress,
                duration: 1000,
                useNativeDriver: false,
                easing: (t: number) => t * t,
            }).start();
        } else {
            animatedWidth.setValue(progress);
        }
    }, [progress, animated]);

    const styles = createStyles(ThemedColor, height);
    const animatedWidthStyle = animatedWidth.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
    });

    return (
        <View style={styles.progressBarBackground}>
            <Animated.View style={[styles.progressBarFill, { width: animatedWidthStyle }]} />
        </View>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>, height: number) =>
    StyleSheet.create({
        progressBarBackground: {
            height,
            backgroundColor: ThemedColor.tertiary,
            borderRadius: height / 2,
            overflow: "hidden",
            width: "100%",
        },
        progressBarFill: {
            height: "100%",
            backgroundColor: ThemedColor.primary,
            borderRadius: height / 2,
        },
    });
