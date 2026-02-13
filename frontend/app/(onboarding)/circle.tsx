import { Dimensions, StyleSheet, View, Animated, Easing } from "react-native";
import React, { useEffect, useRef } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import OnboardButton from "@/components/inputs/OnboardButton";
import Svg, { Circle, Path, G } from 'react-native-svg';
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Create animated SVG component
const AnimatedG = Animated.createAnimatedComponent(G);

type Props = {};

const CircleOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    const buttonFadeAnimation = useRef(new Animated.Value(0)).current;
    const circleRotation = useRef(new Animated.Value(0)).current;
    const labelIndex = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Initial fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 960,
                delay: 240,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 960,
                delay: 240,
                useNativeDriver: true,
            }),
        ]).start();

        // Button fade in after text animation completes
        Animated.timing(buttonFadeAnimation, {
            toValue: 1,
            duration: 640,
            delay: 1200,
            useNativeDriver: true,
        }).start();

        // Exponential easing where it starts fast and slows down
        // Using out-expo easing for smooth deceleration
        const exponentialEasing = Easing.out(Easing.exp);

        // Create sequence of 4 quarter rotations, each with exponential easing
        const quarterRotationDuration = 4000; // 4 seconds per quarter rotation

        const rotationLoop = Animated.loop(
            Animated.sequence([
                // First quarter (0 to 0.25)
                Animated.timing(circleRotation, {
                    toValue: 0.25,
                    duration: quarterRotationDuration,
                    easing: exponentialEasing,
                    useNativeDriver: false,
                }),
                // Second quarter (0.25 to 0.5)
                Animated.timing(circleRotation, {
                    toValue: 0.5,
                    duration: quarterRotationDuration,
                    easing: exponentialEasing,
                    useNativeDriver: false,
                }),
                // Third quarter (0.5 to 0.75)
                Animated.timing(circleRotation, {
                    toValue: 0.75,
                    duration: quarterRotationDuration,
                    easing: exponentialEasing,
                    useNativeDriver: false,
                }),
                // Fourth quarter (0.75 to 1)
                Animated.timing(circleRotation, {
                    toValue: 1,
                    duration: quarterRotationDuration,
                    easing: exponentialEasing,
                    useNativeDriver: false,
                }),
                // Reset to 0 instantly for seamless loop
                Animated.timing(circleRotation, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: false,
                }),
            ])
        );
        rotationLoop.start();

        // Label switching animation - synchronized with quarter rotations
        const labelLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(labelIndex, {
                    toValue: 4,
                    duration: quarterRotationDuration * 4, // 16 seconds total
                    easing: Easing.linear, // Linear for smooth interpolation between labels
                    useNativeDriver: false,
                }),
                Animated.timing(labelIndex, {
                    toValue: 0,
                    duration: 0, // Reset instantly
                    useNativeDriver: false,
                }),
            ])
        );
        labelLoop.start();

        // Cleanup: stop animations on unmount
        return () => {
            rotationLoop.stop();
            labelLoop.stop();
        };
    }, []);

    // Labels array
    const labels = [
        "human encouragements",
        "intrinsic motivation",
        "human recognition",
        "congratulations &"
    ];

    return (
        <ThemedView style={styles.mainContainer}>
            {/* Background graphics */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <OnboardingBackground variant="green" />
            </View>

            {/* Main content */}
            <View style={[styles.contentContainer, { zIndex: 1 }]}>
                {/* Large rotating circle graphic - positioned absolutely on right */}
                <View style={styles.circleContainer}>
                    <Svg
                        width={screenHeight * 0.5}
                        height={screenHeight * 0.5}
                        viewBox="0 0 400 400"
                        style={styles.circleSvg}
                    >
                        <AnimatedG
                            transform={circleRotation.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['rotate(0 200 200)', 'rotate(360 200 200)'],
                            })}
                        >
                            {/* Main dotted circle - GREEN */}
                            <Circle
                                cx="200"
                                cy="200"
                                r="180"
                                fill="none"
                                stroke="#5CFF95"
                                strokeDasharray="12 12"
                                strokeWidth="2"
                            />

                            {/* 4 filled circles on the circumference at cardinal points - GREEN */}
                            {/* Top */}
                            <Circle
                                cx="200"
                                cy="20"
                                r="16"
                                fill="#5CFF95"
                            />

                            {/* Right */}
                            <Circle
                                cx="380"
                                cy="200"
                                r="16"
                                fill="#5CFF95"
                            />

                            {/* Bottom */}
                            <Circle
                                cx="200"
                                cy="380"
                                r="16"
                                fill="#5CFF95"
                            />

                            {/* Left */}
                            <Circle
                                cx="20"
                                cy="200"
                                r="16"
                                fill="#5CFF95"
                            />
                        </AnimatedG>
                    </Svg>
                </View>

                {/* Text labels on the left side - showing one at a time */}
                <Animated.View style={styles.leftLabelsContainer}>
                    {labels.map((label, index) => {
                        // Create smooth cycling opacity for each label
                        const opacity = labelIndex.interpolate({
                            inputRange: [
                                index,
                                index + 0.2,
                                index + 0.8,
                                index + 1
                            ],
                            outputRange: [
                                0,
                                1,
                                1,
                                0
                            ],
                            extrapolate: 'clamp',
                        });

                        return (
                            <Animated.Text
                                key={index}
                                style={[
                                    styles.labelText,
                                    {
                                        opacity,
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                    }
                                ]}
                            >
                                {label}
                            </Animated.Text>
                        );
                    })}
                </Animated.View>

                {/* Text content positioned 3/4th down the screen */}
                <Animated.View
                    style={[
                        styles.textContainer,
                        {
                            opacity: fadeAnimation,
                            transform: [
                                { translateY: slideAnimation }
                            ],
                        }
                    ]}
                >
                    <ThemedText style={[styles.mainText, { color: '#13121f' }]}>
                        Built around positive{'\n'}feedback loops
                    </ThemedText>
                </Animated.View>
            </View>

            {/* Navigation button */}
            <Animated.View style={{ zIndex: 1, opacity: buttonFadeAnimation }}>
                <OnboardButton
                    disabled={false}
                    onPress={async () => {
                        // Mark onboarding as seen
                        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
                        // Navigate to login page
                        router.push("/login");
                    }}
                />
            </Animated.View>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: 'white',
        position: 'relative',
        height: '100%',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.75, // Position text 3/4th down the screen
    },
    circleContainer: {
        position: 'absolute',
        right: -screenHeight * 0.25, // Position so center is at right edge
        top: screenHeight * 0.15,
    },
    circleSvg: {
        // Additional styling if needed
    },
    leftLabelsContainer: {
        position: 'absolute',
        left: HORIZONTAL_PADDING,
        top: screenHeight * 0.15 + (screenHeight * 0.5 * 0.5) - 15, // Vertically centered with circle
        width: '50%',
        height: 30,
        justifyContent: 'center',
    },
    labelText: {
        fontSize: 20,
        fontFamily: 'Outfit',
        fontWeight: '400',
        color: '#13121f',
        textAlign: 'left',
    },
    textContainer: {
        width: '100%',
    },
    mainText: {
        fontSize: Math.min(screenWidth * 0.085, 32),
        fontFamily: 'Fraunces',
        fontWeight: '400',
        lineHeight: Math.min(screenWidth * 0.102, 38),
        letterSpacing: -1,
        textAlign: 'left',
        color: '#13121f',
    },
});

export default CircleOnboarding;
