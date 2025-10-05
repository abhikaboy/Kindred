import { Dimensions, StyleSheet, TextInput, View, Animated, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
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

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 800,
                delay: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 800,
                delay: 200,
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
                                Create a password
                            </ThemedText>
                            <ThemedText style={styles.subtitleText}>
                                Must be at least 8 characters
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
                            <View style={styles.fieldContainer}>
                                <View style={styles.labelRow}>
                                    <ThemedText style={styles.labelText}>Password</ThemedText>
                                    <ThemedText style={[styles.asterisk, { color: ThemedColor.error }]}>*</ThemedText>
                                </View>
                                <View style={styles.passwordInputWrapper}>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: ThemedColor.lightened,
                                                color: ThemedColor.text,
                                            }
                                        ]}
                                        placeholder="Enter password"
                                        placeholderTextColor={ThemedColor.caption}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                        autoFocus
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        maxLength={128}
                                    />
                                    <TouchableOpacity 
                                        style={styles.eyeButton}
                                        onPress={() => setShowPassword(!showPassword)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons 
                                            name={showPassword ? "eye-off-outline" : "eye-outline"} 
                                            size={24} 
                                            color={ThemedColor.caption} 
                                        />
                                    </TouchableOpacity>
                                </View>
                                {showErrors && validationErrors.password && (
                                    <ThemedText style={[styles.errorText, { color: ThemedColor.error }]}>
                                        {validationErrors.password}
                                    </ThemedText>
                                )}
                                {!showErrors && password.length > 0 && password.length < 8 && (
                                    <ThemedText style={[styles.helperText, { color: ThemedColor.caption }]}>
                                        {8 - password.length} more character{8 - password.length !== 1 ? 's' : ''} needed
                                    </ThemedText>
                                )}
                            </View>

                            <View style={styles.fieldContainer}>
                                <View style={styles.labelRow}>
                                    <ThemedText style={styles.labelText}>Confirm Password</ThemedText>
                                    <ThemedText style={[styles.asterisk, { color: ThemedColor.error }]}>*</ThemedText>
                                </View>
                                <View style={styles.passwordInputWrapper}>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: ThemedColor.lightened,
                                                color: ThemedColor.text,
                                            }
                                        ]}
                                        placeholder="Confirm password"
                                        placeholderTextColor={ThemedColor.caption}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={!showConfirmPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        maxLength={128}
                                    />
                                    <TouchableOpacity 
                                        style={styles.eyeButton}
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons 
                                            name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                                            size={24} 
                                            color={ThemedColor.caption} 
                                        />
                                    </TouchableOpacity>
                                </View>
                                {showErrors && confirmPassword.length > 0 && !passwordsMatch && (
                                    <ThemedText style={[styles.errorText, { color: ThemedColor.error }]}>
                                        Passwords do not match
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
                        disabled={!isValid || !passwordsMatch || confirmPassword.length === 0}
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
    passwordInputWrapper: {
        position: 'relative',
    },
    input: {
        fontSize: 18,
        fontFamily: 'Outfit',
        fontWeight: '400',
        paddingVertical: 20,
        paddingHorizontal: 24,
        paddingRight: 60,
        borderRadius: 16,
    },
    eyeButton: {
        position: 'absolute',
        right: 20,
        top: 20,
        padding: 4,
    },
    errorText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        marginTop: 4,
        marginLeft: 4,
    },
    helperText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        marginTop: 4,
        marginLeft: 4,
    },
    buttonContainer: {
        width: '100%',
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: 20,
    },
});

export default PasswordOnboarding;
