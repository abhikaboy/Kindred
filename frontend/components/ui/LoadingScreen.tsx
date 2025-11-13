import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions, StatusBar, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
const KindredCheckImage = require("@/assets/images/KindredCheck.png");

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
    const ThemedColor = useThemeColor();

    // Animation values
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Fade in animation
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();

        // Pulse animation for the logo
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );

        // Rotation animation (optional - comment out if you prefer just pulse)
        const rotateAnimation = Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 3000,
                useNativeDriver: true,
            })
        );

        pulseAnimation.start();

        return () => {
            pulseAnimation.stop();
        };
    }, [fadeAnim, pulseAnim, rotateAnim]);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    // Loading dots animation
    const [dots, setDots] = React.useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            setDots((prev) => {
                if (prev === "...") return "";
                return prev + ".";
            });
        }, 500);

        return () => clearInterval(interval);
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: pulseAnim }],
                    },
                ]}>
                <Image source={KindredCheckImage} style={{ width: 120, height: 120 }} resizeMode="contain" />
            </Animated.View>

            <Animated.View
                style={[
                    styles.textContainer,
                    {
                        opacity: fadeAnim,
                    },
                ]}>
                <ThemedText type="default" style={[styles.loadingText, { color: ThemedColor.caption }]}>
                    {message}
                    {dots}
                </ThemedText>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    logoContainer: {
        marginBottom: 40,
        // Add shadow for depth
        shadowColor: "#854DFF",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    textContainer: {
        alignItems: "center",
        marginBottom: 60,
    },
    brandName: {
        fontSize: 32,
        fontWeight: "700",
        marginBottom: 8,
        letterSpacing: -1,
    },
    loadingText: {
        fontSize: 16,
        minWidth: 100,
        textAlign: "center",
    },
    progressContainer: {
        position: "absolute",
        bottom: 100,
        width: Dimensions.get("window").width * 0.6,
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
    },
    progressBar: {
        height: "100%",
        width: "100%",
        borderRadius: 2,
    },
});

// Usage example:
// <LoadingScreen message="Preparing your tasks" />
// <LoadingScreen message="Almost there" />
// <LoadingScreen /> // Uses default "Loading..."
