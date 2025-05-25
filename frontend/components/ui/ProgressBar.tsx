import React from "react";
import { View, Text, StyleSheet, Dimensions, Easing } from "react-native";

import { useEffect } from "react";

import { useState } from "react";
import { Animated } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

const ProgressBar = ({ start = 0, bar = "#000" }: { start: number; bar: string }) => {
    const [progress] = useState(new Animated.Value(start));
    const ThemedColor = useThemeColor();
    const style = styles(ThemedColor, bar);
    const screenWidth = Dimensions.get("window").width;

    useEffect(() => {
        progress.setValue(0);
        Animated.timing(progress, {
            toValue: screenWidth * 0.9,
            duration: 5000,
            useNativeDriver: false,
            easing: Easing.linear,
        }).start();

        // reset on component unmount
        return () => {
            progress.setValue(0);
        };
    }, []);

    progress.setValue(start);
    Animated.timing(progress, {
        toValue: screenWidth * 0.9,
        duration: 5000,
        useNativeDriver: false,
        easing: Easing.linear,
    }).start();

    return (
        <Animated.View style={style.container}>
            <Animated.View style={[style.bar, { width: progress }]} />
        </Animated.View>
    );
};

const styles = (ThemedColor: any, bar: string) =>
    StyleSheet.create({
        container: {
            height: 4,
            backgroundColor: ThemedColor.background,
        },
        bar: {
            height: 4,
            backgroundColor: bar,
        },
    });

export default ProgressBar;
