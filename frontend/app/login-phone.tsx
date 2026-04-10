import { View, Dimensions, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import React, { useState, useEffect } from "react";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { BigInput } from "@/components/inputs/BigInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useVerification } from "@/hooks/useVerification";
import { OtpInput } from "react-native-otp-entry";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("screen");

const LoginPhone = () => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { loginWithOTP, loginWithPhone } = useAuth();
    const { sendOTP, sendingOTP, sendOTPError } = useVerification();

    const [phoneNumber, setPhoneNumber] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState<"phone" | "otp" | "password">("phone");
    const [loginMode, setLoginMode] = useState<"otp" | "password">("otp");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [canResend, setCanResend] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);

    // Resend timer
    useEffect(() => {
        if (step === "otp" && resendTimer > 0) {
            const timer = setTimeout(() => {
                setResendTimer(resendTimer - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (resendTimer === 0) {
            setCanResend(true);
        }
    }, [resendTimer, step]);

    const handleContinuePhone = async () => {
        if (!phoneNumber) {
            setError("Please enter your phone number");
            return;
        }

        if (loginMode === "password") {
            setError("");
            setStep("password");
            return;
        }

        setLoading(true);
        setError("");
        try {
            await sendOTP(phoneNumber);
            setStep("otp");
            setResendTimer(30);
            setCanResend(false);
        } catch (err) {
            console.error("Failed to send OTP:", err);
            setError("Failed to send verification code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleLoginWithOTP = async () => {
        if (!otpCode || otpCode.length !== 4) {
            setError("Please enter the 4-digit code");
            return;
        }

        setLoading(true);
        setError("");
        try {
            await loginWithOTP(phoneNumber, otpCode);
            router.push("/(logged-in)/(tabs)/(task)");
        } catch (err: any) {
            console.error("Login failed:", err);
            if (err?.message === "INVALID_OTP") {
                setError("Invalid or expired code. Please try again.");
            } else if (err?.message === "ACCOUNT_NOT_FOUND") {
                setError("No account found with this phone number. Please sign up first!");
            } else {
                setError("Login failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLoginWithPassword = async () => {
        if (!password) {
            setError("Please enter your password");
            return;
        }

        setLoading(true);
        setError("");
        try {
            await loginWithPhone(phoneNumber, password);
            router.push("/(logged-in)/(tabs)/(task)");
        } catch (err: any) {
            console.error("Login failed:", err);
            setError("Invalid phone number or password. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (canResend) {
            setCanResend(false);
            setResendTimer(30);
            setOtpCode("");
            setError("");
            try {
                await sendOTP(phoneNumber);
            } catch (err) {
                console.error("Resend failed:", err);
                setError("Failed to resend code. Please try again.");
                setCanResend(true);
                setResendTimer(0);
            }
        }
    };

    const handleBack = () => {
        if (step === "otp" || step === "password") {
            setStep("phone");
            setOtpCode("");
            setPassword("");
            setError("");
        } else {
            router.back();
        }
    };

    const toggleLoginMode = () => {
        setLoginMode(loginMode === "otp" ? "password" : "otp");
        setError("");
    };

    const getTitle = () => {
        if (step === "otp") return "Enter code";
        if (step === "password") return "Enter password";
        return "Login";
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: ThemedColor.background }}>
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                bounces={false}>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    <OnboardingBackground variant="default" />

                    <View style={styles.contentContainer}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={styles.backButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ThemedText style={styles.backButtonText}>← Back</ThemedText>
                        </TouchableOpacity>

                        <ThemedText type="titleFraunces" style={styles.title}>
                            {getTitle()}
                        </ThemedText>

                        {step === "phone" && (
                            <>
                                <View style={styles.inputContainer}>
                                    <PhoneInput
                                        value={phoneNumber}
                                        onChangeText={setPhoneNumber}
                                        placeholder="(555) 123-4567"
                                    />
                                    <ThemedText style={styles.helperText}>
                                        {loginMode === "otp"
                                            ? "We'll send you a verification code"
                                            : "Enter the phone number for your account"}
                                    </ThemedText>
                                </View>

                                <PrimaryButton
                                    title={loginMode === "otp"
                                        ? (sendingOTP ? "Sending..." : "Send Code")
                                        : "Continue"}
                                    onPress={handleContinuePhone}
                                    disabled={loading || sendingOTP || !phoneNumber}
                                    style={styles.continueButton}
                                />

                                <TouchableOpacity onPress={toggleLoginMode} style={styles.toggleModeButton}>
                                    <ThemedText style={[styles.toggleModeText, { color: ThemedColor.tint }]}>
                                        {loginMode === "otp"
                                            ? "Use a password instead"
                                            : "Use a verification code instead"}
                                    </ThemedText>
                                </TouchableOpacity>
                            </>
                        )}

                        {step === "otp" && (
                            <>
                                <View style={styles.otpContainer}>
                                    <ThemedText style={styles.subtitleText}>
                                        Enter the 4-digit code sent to your phone
                                    </ThemedText>

                                    <OtpInput
                                        numberOfDigits={4}
                                        onTextChange={(text) => {
                                            setOtpCode(text);
                                            if (error) setError("");
                                        }}
                                        onFilled={handleLoginWithOTP}
                                        theme={{
                                            containerStyle: styles.otpInputContainer,
                                            pinCodeContainerStyle: {
                                                backgroundColor: ThemedColor.lightened,
                                                borderRadius: 16,
                                                width: width * 0.18,
                                                height: width * 0.20,
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
                                        disabled={loading}
                                    />

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
                                </View>

                                <PrimaryButton
                                    title={loading ? "Logging in..." : "Login"}
                                    onPress={handleLoginWithOTP}
                                    disabled={loading || otpCode.length !== 4}
                                    style={styles.continueButton}
                                />
                            </>
                        )}

                        {step === "password" && (
                            <>
                                <View style={styles.inputContainer}>
                                    <BigInput
                                        label="Password"
                                        value={password}
                                        onChangeText={(text) => {
                                            setPassword(text);
                                            if (error) setError("");
                                        }}
                                        placeholder="Enter your password"
                                        showError={false}
                                        secureTextEntry={!showPassword}
                                        autoFocus
                                        suffix={
                                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                                <Ionicons
                                                    name={showPassword ? "eye-off" : "eye"}
                                                    size={22}
                                                    color={ThemedColor.caption}
                                                />
                                            </TouchableOpacity>
                                        }
                                    />
                                </View>

                                <PrimaryButton
                                    title={loading ? "Logging in..." : "Login"}
                                    onPress={handleLoginWithPassword}
                                    disabled={loading || !password}
                                    style={styles.continueButton}
                                />
                            </>
                        )}

                        {(error || sendOTPError) && (
                            <View style={styles.errorContainer}>
                                <ThemedText style={styles.errorText}>
                                    {error || sendOTPError}
                                </ThemedText>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: height,
        position: "relative",
    },
    contentContainer: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: height * 0.15,
        gap: 24,
        zIndex: 10,
    },
    backButton: {
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    backButtonText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '500',
        opacity: 0.7,
    },
    title: {
        fontSize: 32,
        fontWeight: "600",
        letterSpacing: -1,
        lineHeight: 38,
    },
    subtitleText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        opacity: 0.6,
        marginBottom: 24,
    },
    inputContainer: {
        gap: 12,
        width: "100%",
    },
    helperText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        opacity: 0.6,
        marginTop: 8,
    },
    otpContainer: {
        alignItems: 'center',
        gap: 16,
        width: '100%',
    },
    otpInputContainer: {
        gap: 8,
    },
    resendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
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
    continueButton: {
        width: "100%",
        borderRadius: 8,
        paddingVertical: 12,
        marginTop: 12,
    },
    toggleModeButton: {
        alignItems: 'center',
        marginTop: -8,
    },
    toggleModeText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        fontWeight: '500',
    },
    errorContainer: {
        width: "100%",
    },
    errorText: {
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "500",
        color: '#ff3b30',
        textAlign: 'center',
    },
});

export default LoginPhone;
