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

const ProductivityOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();

    // Animation values for text fade in/out
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    const buttonFadeAnimation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Initial fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 1200,
                delay: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 1200,
                delay: 300,
                useNativeDriver: true,
            }),
        ]).start();

        // Button fade in after text animation completes
        Animated.timing(buttonFadeAnimation, {
            toValue: 1,
            duration: 800,
            delay: 1500, // Start after text animation (300ms + 1200ms)
            useNativeDriver: true,
        }).start();

        // Breathing effect - subtle fade in/out loop
        const breathingAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnimation, {
                    toValue: 0.85,
                    duration: 3000,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnimation, {
                    toValue: 1,
                    duration: 3000,
                    useNativeDriver: true,
                }),
            ]),
            { iterations: 0 }
        );

        // Start breathing effect after initial fade in
        const timeout = setTimeout(() => {
            breathingAnimation.start();
        }, 1500);

        return () => {
            clearTimeout(timeout);
            breathingAnimation.stop();
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
                        <ThemedText style={[styles.mainText, { color: '#13121f' }]}>
                            Productivity is something{'\n'}that should feel good,
                        </ThemedText>
                    </Animated.View>
                </View>

                {/* Navigation button */}
                <Animated.View style={{ zIndex: 1, opacity: buttonFadeAnimation }}>
                    <OnboardButton
                        disabled={false}
                        onPress={() => {
                            // Navigate to the next step in onboarding
                            router.push("/(onboarding)/positivity");
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
    mainText: {
        fontSize: Math.min(screenWidth * 0.085, 32), // Responsive font size with max of 32
        fontFamily: 'Fraunces',
        fontWeight: '400',
        lineHeight: Math.min(screenWidth * 0.102, 38), // Responsive line height
        letterSpacing: -1,
        textAlign: 'left',
        color: '#13121f',
    },
});

export default ProductivityOnboarding;
