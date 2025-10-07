import { Dimensions, StyleSheet, View, Animated, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useVerification } from "@/hooks/useVerification";
import { OtpInput } from "react-native-otp-entry";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const VerifyPhoneOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { onboardingData } = useOnboarding();
    const {
        sendOTP,
        sendingOTP,
        sendOTPError,
        verifyOTP,
        verifyingOTP,
        verifyOTPError,
        isVerified,
    } = useVerification();

    const [otpCode, setOtpCode] = useState("");
    const [canResend, setCanResend] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    const shakeAnimation = useRef(new Animated.Value(0)).current;

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

        // Send OTP on mount
        if (onboardingData.phone) {
            sendOTP(onboardingData.phone);
        }
    }, []);

    // Resend timer
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => {
                setResendTimer(resendTimer - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [resendTimer]);

    // Navigate on successful verification
    useEffect(() => {
        if (isVerified) {
            // Small delay to show success state
            setTimeout(() => {
                router.push("/(onboarding)/name");
            }, 1000);
        }
    }, [isVerified]);

    // Shake animation on error
    useEffect(() => {
        if (verifyOTPError) {
            Animated.sequence([
                Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]).start();
        }
    }, [verifyOTPError]);

    const handleVerify = async () => {
        if (otpCode.length === 4 && onboardingData.phone) {
            try {
                await verifyOTP(onboardingData.phone, otpCode);
            } catch (error) {
                console.error("Verification failed:", error);
            }
        }
    };

    const handleResend = async () => {
        if (canResend && onboardingData.phone) {
            setCanResend(false);
            setResendTimer(30);
            setOtpCode("");
            try {
                await sendOTP(onboardingData.phone);
            } catch (error) {
                console.error("Resend failed:", error);
            }
        }
    };

    const handleBack = () => {
        router.back();
    };

    // Format phone number for display
    const formatPhoneForDisplay = (phone: string) => {
        if (!phone) return "";
        // Show last 4 digits
        return `••• ${phone.slice(-4)}`;
    };

    const isCodeComplete = otpCode.length === 4;

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
                            Enter verification code
                        </ThemedText>
                        <ThemedText style={styles.subtitleText}>
                            We sent a code to {formatPhoneForDisplay(onboardingData.phone)}
                        </ThemedText>
                    </Animated.View>

                    {/* OTP Input Section */}
                    <Animated.View 
                        style={[
                            styles.otpContainer,
                            {
                                opacity: fadeAnimation,
                                transform: [{ translateX: shakeAnimation }],
                            }
                        ]}
                    >
                        {sendingOTP ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={ThemedColor.tint} />
                                <ThemedText style={styles.loadingText}>Sending code...</ThemedText>
                            </View>
                        ) : (
                            <>
                                <OtpInput
                                    numberOfDigits={4}
                                    onTextChange={setOtpCode}
                                    onFilled={handleVerify}
                                    theme={{
                                        containerStyle: styles.otpInputContainer,
                                        pinCodeContainerStyle: {
                                            backgroundColor: ThemedColor.lightened,
                                            borderRadius: 16,
                                            width: screenWidth * 0.18,
                                            height: screenWidth * 0.20,
                                            borderWidth: 2,
                                            borderColor: verifyOTPError 
                                                ? '#ff3b30' 
                                                    : 'transparent',
                                        },
                                        pinCodeTextStyle: {
                                            color: ThemedColor.text,
                                            fontSize: 28,
                                            fontFamily: 'Outfit',
                                            fontWeight: '600',
                                        },
                                        focusedPinCodeContainerStyle: {
                                            borderColor: ThemedColor.tint,
                                        },
                                    }}
                                    disabled={verifyingOTP || isVerified}
                                />

                                {/* Error Message */}
                                {verifyOTPError && (
                                    <ThemedText style={styles.errorText}>
                                        {verifyOTPError}
                                    </ThemedText>
                                )}

                                {/* Success Message */}
                                {isVerified && (
                                    <View style={styles.successContainer}>
                                        <ThemedText style={styles.successText}>
                                            Verified successfully!
                                        </ThemedText>
                                    </View>
                                )}

                                {/* Send Error */}
                                {sendOTPError && (
                                    <ThemedText style={styles.errorText}>
                                        {sendOTPError}
                                    </ThemedText>
                                )}

                                {/* Resend Section */}
                                <View style={styles.resendContainer}>
                                    <ThemedText style={[styles.resendText, { color: ThemedColor.caption }]}>
                                        Didn't receive a code?{' '}
                                    </ThemedText>
                                    {canResend ? (
                                        <TouchableOpacity onPress={handleResend} disabled={sendingOTP}>
                                            <ThemedText style={[styles.resendButton, { color: ThemedColor.tint }]}>
                                                Resend
                                            </ThemedText>
                                        </TouchableOpacity>
                                    ) : (
                                        <ThemedText style={[styles.resendTimer, { color: ThemedColor.caption }]}>
                                            Resend in {resendTimer}s
                                        </ThemedText>
                                    )}
                                </View>
                            </>
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
                            title={verifyingOTP ? "Verifying..." : "Verify"}
                            onPress={handleVerify}
                            disabled={!isCodeComplete || verifyingOTP || isVerified}
                        />
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
    otpContainer: {
        flex: 1,
        marginTop: 40,
        alignItems: 'center',
    },
    otpInputContainer: {
        gap: 8,
    },
    loadingContainer: {
        alignItems: 'center',
        gap: 16,
        marginTop: 40,
    },
    loadingText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        opacity: 0.6,
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
    resendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
    },
    resendText: {
        fontSize: 14,
        fontFamily: 'Outfit',
    },
    resendButton: {
        fontSize: 14,
        fontFamily: 'Outfit',
        fontWeight: '600',
    },
    resendTimer: {
        fontSize: 14,
        fontFamily: 'Outfit',
    },
    buttonContainer: {
        width: '100%',
    },
});

export default VerifyPhoneOnboarding;
