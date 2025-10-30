import { Dimensions, StyleSheet, View, Animated, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity, TextInput } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { applyReferralCode } from "@/api/referral";
import { showToast } from "@/utils/showToast";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const ReferralOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();

    const [referralCode, setReferralCode] = useState("");
    const [isApplying, setIsApplying] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    const shakeAnimation = useRef(new Animated.Value(0)).current;

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

    // Shake animation on error
    useEffect(() => {
        if (errorMessage) {
            Animated.sequence([
                Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]).start();
        }
    }, [errorMessage]);

    const handleApply = async () => {
        if (referralCode.length < 6) {
            setErrorMessage("Please enter a valid referral code");
            return;
        }

        setIsApplying(true);
        setErrorMessage("");

        try {
            await applyReferralCode(referralCode);
            setIsSuccess(true);
            showToast("Referral code applied successfully! 🎉", "success");
            
            // Small delay to show success state
            setTimeout(() => {
                router.push("/(onboarding)/notifications");
            }, 1000);
        } catch (error: any) {
            console.error("Failed to apply referral code:", error);
            setErrorMessage(error.message || "Failed to apply referral code");
        } finally {
            setIsApplying(false);
        }
    };

    const handleSkip = () => {
        router.push("/(onboarding)/notifications");
    };

    const handleBack = () => {
        router.back();
    };

    // Format input to uppercase and limit length
    const handleCodeChange = (text: string) => {
        const formatted = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        setReferralCode(formatted);
        setErrorMessage(""); // Clear error on input change
    };

    const isCodeValid = referralCode.length >= 6;

    return (
        <ThemedView style={styles.mainContainer}>
            {/* Background graphics */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <OnboardingBackground />
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.contentContainer}>
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
                        <TouchableOpacity 
                            onPress={handleBack}
                            style={styles.backButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ThemedText style={styles.backButtonText}>← Back</ThemedText>
                        </TouchableOpacity>

                        <ThemedText style={styles.titleText}>
                            Have a referral code?
                        </ThemedText>
                        <ThemedText style={styles.subtitleText}>
                            Enter a friend's code to unlock premium features
                        </ThemedText>
                    </Animated.View>

                    {/* Input Section */}
                    <Animated.View 
                        style={[
                            styles.inputContainer,
                            {
                                opacity: fadeAnimation,
                                transform: [{ translateX: shakeAnimation }],
                            }
                        ]}
                    >
                        <View style={styles.codeInputWrapper}>
                            <TextInput
                                style={[
                                    styles.codeInput,
                                    {
                                        backgroundColor: ThemedColor.lightened,
                                        color: ThemedColor.text,
                                        borderColor: errorMessage 
                                            ? '#ff3b30' 
                                            : isSuccess
                                            ? '#34c759'
                                            : 'transparent',
                                        borderWidth: 2,
                                    }
                                ]}
                                value={referralCode}
                                onChangeText={handleCodeChange}
                                placeholder="ABCD1234"
                                placeholderTextColor={ThemedColor.caption}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={12}
                                editable={!isApplying && !isSuccess}
                                textAlign="center"
                            />
                        </View>

                        {/* Error Message */}
                        {errorMessage && (
                            <ThemedText style={styles.errorText}>
                                {errorMessage}
                            </ThemedText>
                        )}

                        {/* Success Message */}
                        {isSuccess && (
                            <View style={styles.successContainer}>
                                <ThemedText style={styles.successText}>
                                    Code applied successfully!
                                </ThemedText>
                            </View>
                        )}

                        {/* Help Text */}
                        {!errorMessage && !isSuccess && (
                            <View style={styles.helpContainer}>
                                <ThemedText style={[styles.helpText, { color: ThemedColor.caption }]}>
                                    💡 Referral codes are 6-12 characters
                                </ThemedText>
                            </View>
                        )}
                    </Animated.View>

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
                            title={isApplying ? "Applying..." : "Apply Code"}
                            onPress={handleApply}
                            disabled={!isCodeValid || isApplying || isSuccess}
                        />
                        <TouchableOpacity 
                            style={styles.skipButton}
                            onPress={handleSkip}
                            disabled={isApplying}
                        >
                            <ThemedText style={[
                                styles.skipText, 
                                { 
                                    color: ThemedColor.primary,
                                    opacity: isApplying ? 0.5 : 1 
                                }
                            ]}>
                                Skip for now
                            </ThemedText>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
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
    contentContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.10,
        justifyContent: 'space-between',
        paddingBottom: 20,
        zIndex: 1,
    },
    headerContainer: {
        gap: 12,
    },
    backButton: {
        marginBottom: 12,
        alignSelf: 'flex-start',
    },
    backButtonText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '500',
        opacity: 0.7,
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
        flex: 1,
        marginTop: 40,
        alignItems: 'center',
    },
    codeInputWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    codeInput: {
        width: '100%',
        height: 72,
        borderRadius: 16,
        fontSize: 28,
        fontFamily: 'Outfit',
        fontWeight: '600',
        letterSpacing: 4,
        textAlign: 'center',
    },
    errorText: {
        color: '#ff3b30',
        fontSize: 14,
        fontFamily: 'Outfit',
        marginTop: 16,
        textAlign: 'center',
    },
    successContainer: {
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(52, 199, 89, 0.1)',
    },
    successText: {
        color: '#34c759',
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '600',
        textAlign: 'center',
    },
    helpContainer: {
        marginTop: 16,
        paddingHorizontal: 20,
    },
    helpText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        textAlign: 'center',
    },
    buttonContainer: {
        width: '100%',
        gap: 16,
    },
    skipButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    skipText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '500',
    },
});

export default ReferralOnboarding;

