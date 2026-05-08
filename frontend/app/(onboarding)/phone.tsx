import { Dimensions, StyleSheet, TextInput, TouchableOpacity, View, Animated, KeyboardAvoidingView, Platform, Linking, ActivityIndicator } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { CountryPicker } from "react-native-country-codes-picker";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import OnboardingProgressBar from "@/components/onboarding/OnboardingProgressBar";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useVerification } from "@/hooks/useVerification";
import { Ionicons } from "@expo/vector-icons";
import { OtpInput } from "react-native-otp-entry";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const TOTAL_STEPS = 5; // Will be overridden for social auth

const PhoneOnboarding = () => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { onboardingData, updateOnboardingData } = useOnboarding();
    const {
        sendOTP,
        sendingOTP,
        sendOTPError,
        verifyOTP,
        verifyingOTP,
        verifyOTPError,
        isVerified,
    } = useVerification();

    // Phone entry state
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [countryCode, setCountryCode] = useState("+1");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // Verification state
    const [codeSent, setCodeSent] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [canResend, setCanResend] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);

    // Animations
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    const transitionAnim = useRef(new Animated.Value(0)).current; // 0 = phone, 1 = verify
    const shakeAnimation = useRef(new Animated.Value(0)).current;

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

    // Resend timer
    useEffect(() => {
        if (!codeSent) return;
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [resendTimer, codeSent]);

    // Navigate on successful verification
    useEffect(() => {
        if (isVerified) {
            setTimeout(() => {
                router.push("/(onboarding)/name");
            }, 1000);
        }
    }, [isVerified]);

    // Shake on OTP error
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

    const fullPhoneNumber = `${countryCode}${phoneNumber}`;

    const handleSendCode = async () => {
        updateOnboardingData({ phone: fullPhoneNumber });
        try {
            await sendOTP(fullPhoneNumber);
            setCodeSent(true);
            Animated.timing(transitionAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } catch (error) {
            console.error("Failed to send OTP:", error);
        }
    };

    const handleChangeNumber = () => {
        setCodeSent(false);
        setOtpCode("");
        setResendTimer(30);
        setCanResend(false);
        Animated.timing(transitionAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const handleVerify = async () => {
        if (otpCode.length === 4 && fullPhoneNumber) {
            try {
                await verifyOTP(fullPhoneNumber, otpCode);
            } catch (error) {
                console.error("Verification failed:", error);
            }
        }
    };

    const handleResend = async () => {
        if (canResend && fullPhoneNumber) {
            setCanResend(false);
            setResendTimer(30);
            setOtpCode("");
            try {
                await sendOTP(fullPhoneNumber);
            } catch (error) {
                console.error("Resend failed:", error);
                setCanResend(true);
                setResendTimer(0);
            }
        }
    };

    const formatPhoneNumber = (text: string) => {
        setPhoneNumber(text.replace(/\D/g, ''));
    };

    const getDisplayPhoneNumber = () => {
        if (countryCode !== '+1' || phoneNumber.length === 0) return phoneNumber;
        const d = phoneNumber;
        if (d.length <= 3) return `(${d}`;
        if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
        return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
    };

    const getFormattedFullNumber = () => {
        if (countryCode === '+1' && phoneNumber.length >= 10) {
            const d = phoneNumber;
            return `${countryCode} (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
        }
        return `${countryCode} ${phoneNumber}`;
    };

    const isValidPhone = phoneNumber.length >= 10;
    const canContinue = isValidPhone && agreedToTerms;

    // Animation interpolations
    const phoneEntryOpacity = transitionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
    });
    const verifyOpacity = transitionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });
    const phoneSlideUp = transitionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -20],
    });
    const verifySlideUp = transitionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
    });

    const isSocialAuth = !!(onboardingData.appleId || onboardingData.googleId);
    const totalSteps = isSocialAuth ? 4 : TOTAL_STEPS;

    return (
        <ThemedView style={styles.mainContainer}>
            <OnboardingProgressBar currentStep={1} totalSteps={totalSteps} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <OnboardingBackground />
            </View>

            <CountryPicker
                lang="en"
                show={showCountryPicker}
                pickerButtonOnPress={(item) => {
                    setCountryCode(item.dial_code);
                    setShowCountryPicker(false);
                }}
                popularCountries={["US", "CA", "GB", "AU", "IN"]}
                style={{
                    modal: {
                        top: screenHeight * 0.25,
                        height: screenHeight,
                        paddingHorizontal: HORIZONTAL_PADDING,
                        backgroundColor: ThemedColor.background,
                    },
                    itemsList: { backgroundColor: ThemedColor.background },
                    countryButtonStyles: { backgroundColor: ThemedColor.lightened },
                    countryName: { color: ThemedColor.text, fontFamily: "Outfit" },
                    dialCode: { color: ThemedColor.text, fontFamily: "Outfit" },
                    countryMessageContainer: { backgroundColor: ThemedColor.lightened },
                    textInput: {
                        borderRadius: 16, padding: 16, backgroundColor: ThemedColor.lightened,
                        paddingVertical: 20, color: ThemedColor.text, fontFamily: "Outfit",
                    },
                    searchMessageText: { color: ThemedColor.text, fontFamily: "Outfit" },
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.contentContainer}>
                    {/* Header — crossfades between phone and verify titles */}
                    <Animated.View style={[styles.headerContainer, {
                        opacity: fadeAnimation,
                        transform: [{ translateY: slideAnimation }],
                    }]}>
                        {/* Phone entry title */}
                        <Animated.View style={{
                            opacity: phoneEntryOpacity,
                            transform: [{ translateY: phoneSlideUp }],
                            position: codeSent ? 'absolute' : 'relative',
                            width: '100%',
                        }}>
                            <ThemedText style={styles.titleText}>
                                What's your phone number?
                            </ThemedText>
                            <ThemedText style={styles.subtitleText}>
                                We'll send you a verification code
                            </ThemedText>
                        </Animated.View>

                        {/* Verify title */}
                        {codeSent && (
                            <Animated.View style={{
                                opacity: verifyOpacity,
                                transform: [{ translateY: verifySlideUp }],
                            }}>
                                <ThemedText style={styles.titleText}>
                                    Enter verification code
                                </ThemedText>
                                <View style={styles.changeNumberRow}>
                                    <ThemedText style={styles.subtitleText}>
                                        Sent to {getFormattedFullNumber()}
                                    </ThemedText>
                                    <TouchableOpacity onPress={handleChangeNumber}>
                                        <ThemedText style={[styles.changeLink, { color: ThemedColor.primary }]}>
                                            Change
                                        </ThemedText>
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        )}
                    </Animated.View>

                    {/* Phone entry form */}
                    {!codeSent && (
                        <Animated.View style={[styles.inputContainer, {
                            opacity: fadeAnimation,
                        }]}>
                            <View style={[styles.unifiedPhoneWrapper, { backgroundColor: ThemedColor.lightened }]}>
                                <TouchableOpacity
                                    style={styles.countryCodeButton}
                                    onPress={() => setShowCountryPicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <ThemedText style={styles.countryCodeText}>{countryCode}</ThemedText>
                                </TouchableOpacity>
                                <TextInput
                                    style={[styles.phoneInput, { color: ThemedColor.text }]}
                                    placeholder="(555) 123-4567"
                                    placeholderTextColor={ThemedColor.caption}
                                    value={getDisplayPhoneNumber()}
                                    onChangeText={formatPhoneNumber}
                                    keyboardType="phone-pad"
                                    autoFocus
                                    maxLength={14}
                                />
                            </View>
                            <ThemedText style={[styles.helperText, { color: ThemedColor.caption }]}>
                                Standard messaging rates may apply
                            </ThemedText>
                        </Animated.View>
                    )}

                    {/* OTP input */}
                    {codeSent && (
                        <Animated.View style={[styles.otpContainer, {
                            opacity: verifyOpacity,
                            transform: [{ translateX: shakeAnimation }],
                        }]}>
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
                                                borderColor: 'transparent',
                                            },
                                            pinCodeTextStyle: {
                                                color: ThemedColor.text,
                                                fontSize: 28,
                                                fontFamily: 'Outfit',
                                                fontWeight: '600',
                                            },
                                            focusedPinCodeContainerStyle: {
                                                borderColor: ThemedColor.tint,
                                                borderWidth: 2,
                                            },
                                            filledPinCodeContainerStyle: {
                                                borderColor: 'transparent',
                                            },
                                        }}
                                        disabled={verifyingOTP || isVerified}
                                    />

                                    {verifyOTPError && (
                                        <ThemedText style={styles.errorText}>{verifyOTPError}</ThemedText>
                                    )}
                                    {isVerified && (
                                        <ThemedText style={styles.successText}>Verified successfully!</ThemedText>
                                    )}
                                    {sendOTPError && (
                                        <ThemedText style={styles.errorText}>{sendOTPError}</ThemedText>
                                    )}

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
                    )}

                    {/* Terms checkbox — only in phone entry state */}
                    {!codeSent && (
                        <Animated.View style={[styles.termsContainer, { opacity: fadeAnimation }]}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setAgreedToTerms(!agreedToTerms)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, {
                                    backgroundColor: agreedToTerms ? ThemedColor.primary : 'transparent',
                                    borderColor: agreedToTerms ? ThemedColor.primary : ThemedColor.caption,
                                }]}>
                                    {agreedToTerms && <Ionicons name="checkmark" size={16} color="white" />}
                                </View>
                                <View style={styles.termsTextContainer}>
                                    <ThemedText style={[styles.termsText, { color: ThemedColor.text }]}>
                                        I agree to the{' '}
                                        <ThemedText
                                            style={[styles.termsLink, { color: ThemedColor.primary }]}
                                            onPress={() => Linking.openURL('https://beaker.notion.site/Kindred-Terms-of-Service-342a5d52691580aa94afc9f0b95d5100')}
                                        >
                                            Terms of Service
                                        </ThemedText>
                                        {' '}and{' '}
                                        <ThemedText
                                            style={[styles.termsLink, { color: ThemedColor.primary }]}
                                            onPress={() => Linking.openURL('https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a')}
                                        >
                                            Privacy Policy
                                        </ThemedText>
                                    </ThemedText>
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* Button */}
                    <Animated.View style={[styles.buttonContainer, { opacity: fadeAnimation }]}>
                        {!codeSent ? (
                            <PrimaryButton
                                title={sendingOTP ? "Sending..." : "Send Code"}
                                onPress={handleSendCode}
                                disabled={!canContinue || sendingOTP}
                            />
                        ) : (
                            <PrimaryButton
                                title={verifyingOTP ? "Verifying..." : "Verify"}
                                onPress={handleVerify}
                                disabled={otpCode.length !== 4 || verifyingOTP || isVerified}
                            />
                        )}
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
        paddingTop: screenHeight * 0.20,
        justifyContent: 'space-between',
        paddingBottom: 20,
        zIndex: 1,
    },
    headerContainer: {
        gap: 12,
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
    changeNumberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    changeLink: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '600',
    },
    inputContainer: {
        flex: 1,
        marginTop: 40,
    },
    unifiedPhoneWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingLeft: 20,
    },
    countryCodeButton: {
        paddingVertical: 20,
        paddingRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 60,
    },
    countryCodeText: {
        fontSize: 18,
        fontFamily: 'Outfit',
        fontWeight: '500',
    },
    phoneInput: {
        flex: 1,
        fontSize: 18,
        fontFamily: 'Outfit',
        fontWeight: '400',
        paddingVertical: 20,
        paddingRight: 24,
        backgroundColor: 'transparent',
    },
    helperText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        marginTop: 12,
        marginLeft: 4,
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
    successText: {
        color: '#34c759',
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 16,
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
    termsContainer: {
        marginBottom: 16,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    termsTextContainer: {
        flex: 1,
    },
    termsText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        lineHeight: 20,
    },
    termsLink: {
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    buttonContainer: {
        width: '100%',
    },
});

export default PhoneOnboarding;
