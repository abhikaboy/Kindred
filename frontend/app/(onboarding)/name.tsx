import { Dimensions, StyleSheet, View, Animated, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useOnboarding } from "@/hooks/useOnboarding";
import { BigInput } from "@/components/inputs/BigInput";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const NameOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { onboardingData, updateDisplayName, updateHandle, validationErrors } = useOnboarding();

    const [name, setName] = useState(onboardingData.displayName);
    const [handle, setHandle] = useState(onboardingData.handle.replace('@', ''));
    const [showErrors, setShowErrors] = useState(false);

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

    const handleContinue = () => {
        updateDisplayName(name);
        updateHandle(handle);
        setShowErrors(true);

        if (!validationErrors.displayName && !validationErrors.handle && isValid) {
            // If Apple ID is present, skip password screen and go directly to photo
            // Apple users don't need a password
            if (onboardingData.appleId) {
                router.push("/(onboarding)/photo");
            } else {
                router.push("/(onboarding)/password");
            }
        }
    };

    const handleTextChange = (text: string) => {
        // Remove @ if user types it
        const cleanText = text.replace('@', '');
        setHandle(cleanText);
    };

    const isValid = name.length >= 2 && handle.length >= 1;

    const themedStyles = styles(ThemedColor);

    return (
        <ThemedView style={themedStyles.mainContainer}>
            {/* Background graphics */}
            <View style={themedStyles.backgroundContainer}>
                <OnboardingBackground />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={themedStyles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? -20 : 0}
                enabled
            >
                <ScrollView
                    contentContainerStyle={themedStyles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={themedStyles.scrollView}
                >
                    <View style={themedStyles.innerContainer}>
                        {/* Header Section */}
                        <Animated.View
                            style={[
                                themedStyles.headerContainer,
                                {
                                    opacity: fadeAnimation,
                                    transform: [{ translateY: slideAnimation }],
                                }
                            ]}
                        >
                            <ThemedText style={themedStyles.titleText}>
                                Introduce yourself
                            </ThemedText>
                        </Animated.View>

                        {/* Input Section */}
                        <Animated.View
                            style={[
                                themedStyles.inputContainer,
                                {
                                    opacity: fadeAnimation,
                                }
                            ]}
                        >
                            <BigInput
                                label="Name"
                                value={name}
                                onChangeText={setName}
                                placeholder="Enter your name"
                                error={validationErrors.displayName}
                                showError={showErrors}
                                autoFocus
                                maxLength={50}
                            />

                            <BigInput
                                label="Handle"
                                value={handle}
                                onChangeText={handleTextChange}
                                placeholder="kindred_handle"
                                error={validationErrors.handle}
                                showError={showErrors}
                                prefix="@"
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={29}
                            />
                        </Animated.View>
                    </View>
                </ScrollView>

                {/* Button Section - Always at bottom */}
                <Animated.View
                    style={[
                        themedStyles.buttonContainer,
                        {
                            opacity: fadeAnimation,
                        }
                    ]}
                >
                    <PrimaryButton
                        title="Continue"
                        onPress={handleContinue}
                        disabled={!isValid}
                    />
                </Animated.View>
            </KeyboardAvoidingView>
        </ThemedView>
    );
};

const styles = (ThemedColor: ReturnType<typeof useThemeColor>) => StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: 'relative',
    },
    backgroundContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    innerContainer: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.18,
        zIndex: 1,
        paddingBottom: 100,
    },
    headerContainer: {
        gap: 4,
        marginBottom: 20,
    },
    titleText: {
        fontSize: Math.min(screenWidth * 0.085, 32),
        fontFamily: 'Fraunces',
        fontWeight: '600',
        lineHeight: Math.min(screenWidth * 0.102, 38),
        letterSpacing: -1,
    },
    inputContainer: {
        gap: 24,
    },
    buttonContainer: {
        width: '100%',
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: 28,
    },
});

export default NameOnboarding;
