import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

import { useEffect } from "react";

import { useState } from "react";
import { Animated } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

const ProgressBar = () => {
    const [progress, setProgress] = useState(new Animated.Value(0));
    const ThemedColor = useThemeColor();
    const style = styles(ThemedColor);
    const screenWidth = Dimensions.get("window").width;

    useEffect(() => {
        // setProgress(new Animated.Value(screenWidth * 0.8));
        Animated.timing(progress, {
            toValue: screenWidth * 0.9,
            duration: 5000,
            useNativeDriver: false,
        }).start();
    }, []);

    // reset on component unmount
    useEffect(() => {
        return () => {
            setProgress(new Animated.Value(0));
        };
    }, []);

    return (
        <View style={style.container}>
            <Animated.View style={[style.bar, { width: progress }]} />
        </View>
    );
};

const styles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            height: 12,
            backgroundColor: ThemedColor.background,
            margin: 10,
        },
        bar: {
            height: 12,
            backgroundColor: ThemedColor.success,
        },
    });

export default ProgressBar;
