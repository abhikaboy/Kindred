import { Dimensions, StyleSheet, View, Animated, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Ionicons } from '@expo/vector-icons';
import { BigInput } from "@/components/inputs/BigInput";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const PasswordOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { onboardingData, updatePassword, validationErrors } = useOnboarding();

    const [password, setPassword] = useState(onboardingData.password);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;

    useEffect(() => {
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
        updatePassword(password);
        setShowErrors(true);

        if (!validationErrors.password && isValid && passwordsMatch) {
            router.push("/(onboarding)/photo");
        }
    };

    const isValid = password.length >= 8;
    const passwordsMatch = password === confirmPassword;

    const themedStyles = styles(ThemedColor);

    const passwordHelperText = !showErrors && password.length > 0 && password.length < 8
        ? `${8 - password.length} more character${8 - password.length !== 1 ? 's' : ''} needed`
        : undefined;

    const confirmPasswordError = showErrors && confirmPassword.length > 0 && !passwordsMatch
        ? "Passwords do not match"
        : undefined;

    return (
        <ThemedView style={themedStyles.mainContainer}>
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
                                Create a password
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
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Enter password"
                                error={validationErrors.password}
                                helperText={passwordHelperText}
                                showError={showErrors}
                                suffix={
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                                            size={24}
                                            color={ThemedColor.caption}
                                        />
                                    </TouchableOpacity>
                                }
                                secureTextEntry={!showPassword}
                                autoFocus
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={128}
                            />

                            <BigInput
                                label="Confirm Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirm password"
                                error={confirmPasswordError}
                                showError={showErrors}
                                suffix={
                                    <TouchableOpacity
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                            size={24}
                                            color={ThemedColor.caption}
                                        />
                                    </TouchableOpacity>
                                }
                                secureTextEntry={!showConfirmPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={128}
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
                        disabled={!isValid || !passwordsMatch || confirmPassword.length === 0}
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
        gap: 12,
        marginBottom: 16,
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
    },
    buttonContainer: {
        width: '100%',
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: 20,
    },
});

export default PasswordOnboarding;
