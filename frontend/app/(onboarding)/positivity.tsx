import { Dimensions, StyleSheet, View, Animated } from "react-native";
import React, { useEffect, useRef } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import OnboardButton from "@/components/inputs/OnboardButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const PositivityOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();

    // Animation values for text fade in/out
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    
    // Individual animation values for each highlighted word
    const positivityFade = useRef(new Animated.Value(0)).current;
    const connectionFade = useRef(new Animated.Value(0)).current;
    const happinessFade = useRef(new Animated.Value(0)).current;
    const buttonFadeAnimation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Initial fade in animation for main text
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

        // Staggered animations for highlighted words (2 seconds apart)
        // "positivity" appears after 2 seconds
        const positivityTimeout = setTimeout(() => {
            Animated.timing(positivityFade, {
                toValue: 1,
                duration: 640,
                useNativeDriver: true,
            }).start();
        }, 1600);

        // "connection" appears after 4 seconds
        const connectionTimeout = setTimeout(() => {
            Animated.timing(connectionFade, {
                toValue: 1,
                duration: 640,
                useNativeDriver: true,
            }).start();
        }, 2400);

        // "happiness" appears after 6 seconds
        const happinessTimeout = setTimeout(() => {
            Animated.timing(happinessFade, {
                toValue: 1,
                duration: 640,
                useNativeDriver: true,
            }).start();
        }, 3200);

        // Button fade in after all animations
        Animated.timing(buttonFadeAnimation, {
            toValue: 1,
            duration: 640,
            delay: 4000, // Start after happiness appears
            useNativeDriver: true,
        }).start();

        // Cleanup timeouts
        return () => {
            clearTimeout(positivityTimeout);
            clearTimeout(connectionTimeout);
            clearTimeout(happinessTimeout);
        };
    }, []);

    return (
        <ThemedView style={styles.mainContainer}>
            {/* Background graphics */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <OnboardingBackground />
            </View>
            
            {/* Main content */}
            <View style={[styles.contentContainer, { zIndex: 1 }]}>
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
                    <View style={styles.textWrapper}>
                        <ThemedText style={[styles.mainText, { color: '#13121f' }]}>
                            Something rooted in
                        </ThemedText>
                        <Animated.View style={{ opacity: positivityFade }}>
                            <ThemedText style={[styles.mainText, styles.highlightText, { color: '#854dff' }]}>
                                positivity
                            </ThemedText>
                        </Animated.View>
                        <Animated.View style={{ opacity: connectionFade }}>
                            <ThemedText style={[styles.mainText, styles.highlightText, { color: '#854dff' }]}>
                                connection
                            </ThemedText>
                        </Animated.View>
                        <Animated.View style={{ opacity: happinessFade }}>
                            <ThemedText style={[styles.mainText, styles.highlightText, { color: '#854dff' }]}>
                                happiness
                            </ThemedText>
                        </Animated.View>
                    </View>
                </Animated.View>
            </View>

            {/* Navigation button */}
            <Animated.View style={{ zIndex: 1, opacity: buttonFadeAnimation }}>
                <OnboardButton
                    disabled={false}
                    onPress={() => {
                        router.push("/(onboarding)/human");
                    }}
                />
            </Animated.View>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        height: '100%',
    },
    mainContainer: {
        flex: 1,
        backgroundColor: 'white',
        position: 'relative',
        height: '100%',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    textContainer: {
        width: '100%',
    },
    textWrapper: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    mainText: {
        fontSize: Math.min(screenWidth * 0.085, 32), // Responsive font size with max of 32
        fontFamily: 'Fraunces',
        fontWeight: '400',
        lineHeight: Math.min(screenWidth * 0.102, 38), // Responsive line height
        letterSpacing: -1,
        textAlign: 'left',
        color: '#13121f',
    },
    highlightText: {
        fontWeight: '600', // Semi-bold as per Figma design
        color: '#854dff', // Primary purple color
    },
});

export default PositivityOnboarding;
