import { Dimensions, StyleSheet, View, Animated, TouchableOpacity } from "react-native";
import React, { useEffect, useRef } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from 'expo-av';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const PublicTasksTutorialScreen = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 640,
                delay: 160,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 640,
                delay: 160,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleFinish = () => {
        // Return to home
        router.push('/(logged-in)/(tabs)/(task)');
    };

    return (
        <ThemedView style={styles.container}>
            {/* Background Graphics */}
            <OnboardingBackground />

            <Animated.View 
                style={[
                    styles.content,
                    {
                        opacity: fadeAnimation,
                        transform: [{ translateY: slideAnimation }],
                        paddingTop: insets.top + 20,
                        paddingBottom: insets.bottom + 20,
                    }
                ]}
            >
                {/* Video */}
                <View style={styles.videoContainer}>
                    <Video
                        source={require('@/assets/video/post.mp4')}
                        style={styles.video}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay
                        isLooping
                        isMuted
                    />
                </View>

                {/* Title */}
                <View style={styles.titleContainer}>
                    <ThemedText type="titleFraunces" style={styles.title}>
                        Public tasks will let you make a post after completion!
                    </ThemedText>
                </View>

                {/* Spacer to push button to bottom */}
                <View style={styles.spacer} />

                {/* Finish Button */}
                <TouchableOpacity
                    style={[styles.nextButton, {
                        backgroundColor: ThemedColor.primary,
                    }]}
                    onPress={handleFinish}
                    activeOpacity={0.8}
                >
                    <ThemedText style={[styles.buttonText, {
                        color: ThemedColor.buttonText,
                    }]}>
                        →
                    </ThemedText>
                </TouchableOpacity>
            </Animated.View>
        </ThemedView>
    );
};

export default PublicTasksTutorialScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    content: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        position: 'relative',
        zIndex: 1,
    },
    videoContainer: {
        width: 250,
        height: 542,
        borderRadius: 12,
        overflow: 'hidden',
        alignSelf: 'flex-start',
        marginTop: 0,
    },
    video: {
        width: '100%',
        height: '100%',
    },
    titleContainer: {
        marginTop: 16,
        paddingRight: 24,
    },
    title: {
        fontSize: 32,
        letterSpacing: -1,
        lineHeight: 38,
    },
    spacer: {
        flex: 1,
    },
    nextButton: {
        width: 64,
        height: 64,
        borderRadius: 400,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'flex-end',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    buttonText: {
        fontSize: 24,
        fontFamily: 'Outfit',
        fontWeight: '400',
        textAlign: 'center',
    },
});

