import { StyleSheet, Dimensions, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useScrollViewOffset, AnimatedRef } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";

interface ParallaxBannerProps {
    scrollRef: AnimatedRef<Animated.ScrollView>;
    backgroundImage: string;
    backgroundColor: string;
    headerHeight?: number;
}

export default function ParallaxBanner({
    scrollRef,
    backgroundImage,
    backgroundColor,
    headerHeight = Dimensions.get("window").height * 0.4,
}: ParallaxBannerProps) {
    const scrollOffset = useScrollViewOffset(scrollRef);

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: interpolate(
                        scrollOffset.value,
                        [-headerHeight, 0, headerHeight],
                        [-headerHeight / 2, 0, headerHeight * 0.45]
                    ),
                },
                {
                    scale: interpolate(scrollOffset.value, [-headerHeight, 0, headerHeight], [1.5, 1, 1]),
                },
            ] as const,
        };
    });

    return (
        <Animated.View style={[headerAnimatedStyle]}>
            <LinearGradient
                colors={["transparent", backgroundColor]}
                style={[styles.headerImage, styles.gradientOverlay]}
            />
            <LinearGradient
                colors={[backgroundColor + "40", backgroundColor + "40"]}
                style={[styles.headerImage, styles.gradientOverlay]}
            />
            <Animated.Image src={backgroundImage} style={[styles.headerImage]} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    headerImage: {
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height * 0.4,
        position: "absolute",
    },
    gradientOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 2,
    },
});
