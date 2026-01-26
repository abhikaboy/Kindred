import { Dimensions, StyleSheet, TextInput, View, Animated, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useOnboarding } from "@/hooks/useOnboarding";

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

    return (
        <ThemedView style={styles.mainContainer}>
            {/* Background graphics */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <OnboardingBackground />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? -20 : 0}
                enabled
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={styles.scrollView}
                >
                    <View style={styles.innerContainer}>
                        {/* Header Section */}
                        <Animated.View
                            style={[
                                styles.headerContainer,
                                {
                                    opacity: fadeAnimation,
                                    transform: [{ translateY: slideAnimation }],
                                }
                            ]}
                        >
                            <ThemedText style={styles.titleText}>
                                Introduce yourself
                            </ThemedText>
                            <ThemedText style={styles.subtitleText}>
                                Tell us your name and choose a handle
                            </ThemedText>
                        </Animated.View>

                        {/* Input Section */}
                        <Animated.View
                            style={[
                                styles.inputContainer,
                                {
                                    opacity: fadeAnimation,
                                }
                            ]}
                        >
                            {/* Name Input */}
                            <View style={styles.fieldContainer}>
                                <View style={styles.labelRow}>
                                    <ThemedText style={styles.labelText}>Name</ThemedText>
                                    <ThemedText style={[styles.asterisk, { color: ThemedColor.error }]}>*</ThemedText>
                                </View>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: ThemedColor.lightened,
                                            color: ThemedColor.text,
                                        }
                                    ]}
                                    placeholder="Enter your name"
                                    placeholderTextColor={ThemedColor.caption}
                                    value={name}
                                    onChangeText={setName}
                                    autoFocus
                                    maxLength={50}
                                />
                                {showErrors && validationErrors.displayName && (
                                    <ThemedText style={[styles.errorText, { color: ThemedColor.error }]}>
                                        {validationErrors.displayName}
                                    </ThemedText>
                                )}
                            </View>

                            {/* Handle Input */}
                            <View style={styles.fieldContainer}>
                                <View style={styles.labelRow}>
                                    <ThemedText style={styles.labelText}>Handle</ThemedText>
                                    <ThemedText style={[styles.asterisk, { color: ThemedColor.error }]}>*</ThemedText>
                                </View>
                                <View style={[
                                    styles.unifiedInputWrapper,
                                    { backgroundColor: ThemedColor.lightened }
                                ]}>
                                    <ThemedText style={styles.prefixText}>@</ThemedText>
                                    <TextInput
                                        style={[
                                            styles.unifiedInput,
                                            {
                                                color: ThemedColor.text,
                                            }
                                        ]}
                                        placeholder="kindreduser"
                                        placeholderTextColor={ThemedColor.caption}
                                        value={handle}
                                        onChangeText={handleTextChange}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        maxLength={29}
                                    />
                                </View>
                                {showErrors && validationErrors.handle && (
                                    <ThemedText style={[styles.errorText, { color: ThemedColor.error }]}>
                                        {validationErrors.handle}
                                    </ThemedText>
                                )}
                            </View>
                        </Animated.View>
                    </View>
                </ScrollView>

                {/* Button Section - Always at bottom */}
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
                        disabled={!isValid}
                    />
                </Animated.View>
            </KeyboardAvoidingView>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: 'relative',
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
        gap: 12,
        marginBottom: 40,
    },
    titleText: {
        fontSize: Math.min(screenWidth * 0.085, 32),
        fontFamily: 'Fraunces',
        fontWeight: '600',
        lineHeight: Math.min(screenWidth * 0.102, 38),
        letterSpacing: -1,
    },
    subtitleText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        opacity: 0.6,
        marginTop: 8,
    },
    inputContainer: {
        gap: 24,
        marginBottom: 60,
    },
    fieldContainer: {
        gap: 8,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 4,
    },
    labelText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        fontWeight: '500',
        opacity: 0.7,
    },
    asterisk: {
        fontSize: 14,
        fontFamily: 'Outfit',
        fontWeight: '500',
    },
    input: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
    },
    unifiedInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingLeft: 24,
    },
    prefixText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '500',
        marginRight: 4,
    },
    unifiedInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        paddingVertical: 16,
        paddingRight: 24,
        backgroundColor: 'transparent',
    },
    errorText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        marginTop: 4,
        marginLeft: 4,
    },
    buttonContainer: {
        width: '100%',
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: 28,
    },
});

export default NameOnboarding;
