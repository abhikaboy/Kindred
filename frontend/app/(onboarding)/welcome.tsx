import { Dimensions, StyleSheet, View, Animated } from "react-native";
import React, { useEffect, useRef } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import OnboardButton from "@/components/inputs/OnboardButton";
import { Svg, Circle, Path, Polygon } from "react-native-svg";
import OnboardingProgressBar from "@/components/onboarding/OnboardingProgressBar";
import { useOnboarding } from "@/hooks/useOnboarding";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const WelcomeOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { onboardingData } = useOnboarding();

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    const buttonFadeAnimation = useRef(new Animated.Value(0)).current;

    const isSocialAuth = !!(onboardingData.appleId || onboardingData.googleId);
    const totalSteps = isSocialAuth ? 4 : 5;

    useEffect(() => {
        // Fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 800,
                delay: 240,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 800,
                delay: 240,
                useNativeDriver: true,
            }),
        ]).start();

        // Button fade in after text animation
        Animated.timing(buttonFadeAnimation, {
            toValue: 1,
            duration: 640,
            delay: 1200,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <ThemedView style={styles.mainContainer}>
            <OnboardingProgressBar currentStep={totalSteps - 1} totalSteps={totalSteps} />

            {/* Background decorative elements */}
            <View style={styles.backgroundGraphics}>
                {/* Top left circle */}
                <Svg
                    width="112"
                    height="112"
                    viewBox="0 0 112 112"
                    style={styles.topLeftCircle}
                >
                    <Circle
                        cx="56"
                        cy="56"
                        r="55"
                        stroke={ThemedColor.primary}
                        strokeWidth="2"
                        strokeDasharray="10 10"
                        fill={ThemedColor.background}
                    />
                </Svg>

                {/* Top right triangle */}
                <Svg
                    width="85"
                    height="82"
                    viewBox="0 0 85 82"
                    style={styles.topRightTriangle}
                >
                    <Polygon
                        points="42.5,5 80,77 5,77"
                        fill={ThemedColor.primary}
                        opacity="0.15"
                    />
                </Svg>

                {/* Middle right star */}
                <Svg
                    width="145"
                    height="145"
                    viewBox="0 0 145 145"
                    style={styles.middleRightStar}
                >
                    <Path
                        d="M72.5 10L88.2 56.3L135 72L88.2 87.7L72.5 134L56.8 87.7L10 72L56.8 56.3L72.5 10Z"
                        fill={ThemedColor.primary}
                        opacity="0.1"
                    />
                </Svg>

                {/* Bottom left circle */}
                <Svg
                    width="172"
                    height="172"
                    viewBox="0 0 172 172"
                    style={styles.bottomLeftCircle}
                >
                    <Circle
                        cx="86"
                        cy="86"
                        r="85"
                        stroke={ThemedColor.primary}
                        strokeWidth="2"
                        strokeDasharray="10 10"
                        fill={ThemedColor.background}
                    />
                </Svg>

                {/* Bottom right square */}
                <Svg
                    width="85"
                    height="82"
                    viewBox="0 0 85 82"
                    style={styles.bottomRightSquare}
                >
                    <Path
                        d="M20 20L65 20L65 65L20 65Z"
                        fill={ThemedColor.primary}
                        opacity="0.15"
                        transform="rotate(30 42.5 42.5)"
                    />
                </Svg>

                {/* Bottom arrow */}
                <Svg
                    width="120"
                    height="60"
                    viewBox="0 0 120 60"
                    style={styles.bottomArrow}
                >
                    <Path
                        d="M10 10 Q40 40, 70 10 T110 40"
                        stroke={ThemedColor.tint}
                        strokeWidth="2"
                        strokeDasharray="8 8"
                        fill="none"
                    />
                    <Path
                        d="M100 30 L110 40 L100 50"
                        stroke={ThemedColor.tint}
                        strokeWidth="2"
                        fill="none"
                    />
                </Svg>
            </View>

            <View style={styles.contentContainer}>
                {/* Main Text Section */}
                <Animated.View
                    style={[
                        styles.mainTextContainer,
                        {
                            opacity: fadeAnimation,
                            transform: [{ translateY: slideAnimation }],
                        }
                    ]}
                >
                    <ThemedText style={[styles.welcomeText, { color: ThemedColor.text }]}>
                        Welcome!
                    </ThemedText>
                    <ThemedText style={[styles.familyText, { color: ThemedColor.text }]}>
                        You've joined the{' '}
                        <ThemedText style={[styles.familyText, { color: '#854dff' }]}>
                            kindred
                        </ThemedText>
                        {' '}family
                    </ThemedText>
                </Animated.View>
            </View>

            {/* Navigation button */}
            <Animated.View style={{ zIndex: 1, opacity: buttonFadeAnimation }}>
                <OnboardButton
                    testID="onboard-next-btn"
                    disabled={false}
                    onPress={() => {
                        router.push("/(onboarding)/calendar");
                    }}
                />
            </Animated.View>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: 'relative',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.35,
        paddingBottom: 40,
        zIndex: 1,
    },
    backgroundGraphics: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
    },
    topLeftCircle: {
        position: 'absolute',
        top: 67,
        left: -38,
    },
    topRightTriangle: {
        position: 'absolute',
        top: 134,
        right: 55,
    },
    middleRightStar: {
        position: 'absolute',
        top: screenHeight * 0.55,
        right: -50,
        transform: [{ rotate: '38.941deg' }],
    },
    bottomLeftCircle: {
        position: 'absolute',
        bottom: screenHeight * 0.15,
        left: -28,
    },
    bottomRightSquare: {
        position: 'absolute',
        bottom: 50,
        right: 25,
        transform: [{ rotate: '30deg' }],
    },
    bottomArrow: {
        position: 'absolute',
        bottom: screenHeight * 0.35,
        right: 20,
    },
    mainTextContainer: {
        marginBottom: 36,
    },
    welcomeText: {
        fontSize: 24,
        fontFamily: 'Fraunces',
        fontWeight: '400',
        letterSpacing: -1,
        marginBottom: 8,
    },
    familyText: {
        fontSize: 36,
        fontFamily: 'Fraunces',
        fontWeight: '600',
        lineHeight: 44,
        letterSpacing: -1,
    },
});

export default WelcomeOnboarding;
