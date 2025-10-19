import { Dimensions, StyleSheet, View, Animated } from "react-native";
import React, { useEffect, useRef } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const NotificationsOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;

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
    }, []);

    const handleContinue = () => {
        // Navigate to the accomplishment screen
        router.push('/(onboarding)/accomplishment');
    };

    const handleSkip = () => {
        router.push('/(onboarding)/accomplishment');
    };

    return (
        <ThemedView style={styles.mainContainer}>
            {/* Background graphics */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <OnboardingBackground />
            </View>

            <View style={styles.contentContainer}>
                {/* Welcome Text - Top Left */}
                <Animated.View 
                    style={[
                        styles.welcomeContainer,
                        {
                            opacity: fadeAnimation,
                            transform: [{ translateY: slideAnimation }],
                        }
                    ]}
                >

                </Animated.View>

                {/* Main Text Section - Centered */}
                <Animated.View 
                    style={[
                        styles.mainTextContainer,
                        {
                            opacity: fadeAnimation,
                            transform: [{ translateY: slideAnimation }],
                        }
                    ]}
                >
                    <ThemedText style={styles.welcomeText}>
                        Welcome!
                    </ThemedText>
                    <ThemedText style={styles.mainText}>
                        You've joined the{'\n'}
                        <ThemedText style={[styles.mainText, { color: '#854dff' }]}>
                            kindred
                        </ThemedText>
                        {' '}family
                    </ThemedText>
                </Animated.View>

                {/* Spacer */}
                <View style={{ flex: 1 }} />

                {/* Button Section */}
                <Animated.View 
                    style={[
                        styles.buttonContainer,
                        {
                            opacity: fadeAnimation,
                        }
                    ]}
                >
                    <PrimaryButton
                        title="Continue"
                        onPress={handleContinue}
                    />
                </Animated.View>
            </View>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: 'relative',
        backgroundColor: 'white',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.15,
        paddingBottom: 40,
        zIndex: 1,
    },
    welcomeContainer: {
        marginBottom: screenHeight * 0.15,
    },
    welcomeText: {
        fontSize: 24,
        fontFamily: 'Fraunces',
        fontWeight: '400',
        letterSpacing: -1,
        color: '#000000',
        marginBottom: 24,
    },
    mainTextContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    mainText: {
        fontSize: 40,
        fontFamily: 'Fraunces',
        fontWeight: '600',
        lineHeight: 48,
        letterSpacing: -1,
        color: '#13121f',
    },
    buttonContainer: {
        width: '100%',
        marginTop: 20,
    },
});

export default NotificationsOnboarding;
