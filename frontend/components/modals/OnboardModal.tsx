import { StyleSheet, TouchableOpacity, View, Image, useColorScheme, Animated } from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
import PrimaryButton from "../inputs/PrimaryButton";
import AntDesign from "@expo/vector-icons/AntDesign";
import { BlurView } from "expo-blur";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import useGoogleAuth from "@/hooks/useGoogleAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import {
    AppleAuthenticationButton,
    AppleAuthenticationButtonStyle,
    AppleAuthenticationButtonType,
} from "expo-apple-authentication";
import Feather from "@expo/vector-icons/Feather";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    mode: "register" | "login";
};

export const OnboardModal = (props: Props) => {
    const { register, login, registerWithGoogle, loginWithGoogle } = useAuth();
    const { updateOnboardingData, updateAppleId, updateGoogleId } = useOnboarding();
    const { mode, visible, setVisible } = props;
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const colorScheme = useColorScheme();

    // Animation values for staggered button fade-in
    const phoneOpacity = useRef(new Animated.Value(0)).current;
    const appleOpacity = useRef(new Animated.Value(0)).current;
    const googleOpacity = useRef(new Animated.Value(0)).current;

    // Google authentication hook
    const { signInAsync: googleSignInAsync, loading: googleLoading } = useGoogleAuth({
        onSuccess: async (result) => {
            if (result.user && result.user.id && result.user.email) {
                try {
                    if (mode === "register") {
                        await registerWithGoogle(result.user.email, result.user.id);
                        router.replace({
                            pathname: "/(onboarding)/phone",
                            params: {
                                initialFirstName: result.user.given_name || "",
                                initialLastName: result.user.family_name || "",
                                initialPhoneNumber: "",
                            },
                        });
                    } else {
                        await loginWithGoogle(result.user.id);
                        router.push("/(logged-in)/(tabs)/(task)");
                    }
                    setVisible(false);
                } catch (error) {
                    console.error("Google authentication error:", error);
                    if (mode === "register") {
                        // Try login if registration fails (user might already exist)
                        try {
                            await loginWithGoogle(result.user.id);
                            router.push("/(logged-in)/(tabs)/(task)");
                            setVisible(false);
                        } catch (loginError) {
                            console.error("Google login fallback failed:", loginError);
                        }
                    }
                }
            }
        },
        onError: (error) => {
            console.error("Google auth error:", error);
            alert("Google authentication failed. Please try again.");
        },
    });

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Define snap points
    const snapPoints = useMemo(() => ["75%"], []);

    // Handle visibility changes
    useEffect(() => {
        console.log(visible);
        if (visible) {
            bottomSheetModalRef.current?.present();
            // Reset animations
            phoneOpacity.setValue(0);
            appleOpacity.setValue(0);
            googleOpacity.setValue(0);

            // Staggered fade-in animation with initial delay
            setTimeout(() => {
                Animated.sequence([
                    Animated.timing(phoneOpacity, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.parallel([
                        Animated.timing(appleOpacity, {
                            toValue: 1,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                        Animated.timing(googleOpacity, {
                            toValue: 1,
                            duration: 500,
                            delay: 200,
                            useNativeDriver: true,
                        }),
                    ]),
                ]).start();
            }, 300);
        } else {
            bottomSheetModalRef.current?.dismiss();
        }
    }, [visible]);

    // Handle sheet changes
    const handleSheetChanges = useCallback(
        (index: number) => {
            if (index === -1) {
                setVisible(false);
            }
        },
        [setVisible]
    );

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.85} />
        ),
        []
    );

    const apple_regiser = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });
            console.log(credential);
            const appleAccountID = credential.user;
            const email = credential.email || "user@gmail.com"; // Fallback email if Apple doesn't provide one
            const firstName = credential.fullName?.givenName;
            const lastName = credential.fullName?.familyName;

            console.log("DEBUG - Apple credential email:", credential.email);
            console.log("DEBUG - Email after fallback:", email);

            // If Apple doesn't provide name/email, user is signing in again (not first time)
            if (!email || email === "user@gmail.com" || !firstName || !lastName) {
                console.log("We think you already have an account: trying to log in instead");
                await login(appleAccountID);
                router.push("/(logged-in)/(tabs)/(task)");
                // Success - modal will be closed by caller
            } else {
                // Pre-fill onboarding data with Apple credentials
                // Don't create account yet - wait until user completes onboarding
                const displayName = `${firstName} ${lastName}`.trim();
                updateOnboardingData({
                    email: email,
                    displayName: displayName,
                    appleId: appleAccountID,
                });

                console.log("Pre-filled onboarding data with Apple credentials");

                // Navigate directly to name screen (skip phone/OTP for Apple users)
                router.replace("/(onboarding)/name");
                // Success - modal will be closed by caller
            }
        } catch (e: any) {
            if (e.code === "ERR_REQUEST_CANCELED") {
                console.log("User cancelled Apple sign in");
                // Don't show error for user cancellation
            } else {
                console.error("Apple registration error:", e.code, e);
                alert(`Apple sign up failed: ${e.message || "An unexpected error occurred"}`);
            }
            // Re-throw to let caller know it failed
            throw e;
        }
    };

    const apple_login = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            const appleAccountID = credential.user;

            await login(appleAccountID);

            router.push("/(logged-in)/(tabs)/(task)");
            // Success - modal will be closed by caller
        } catch (e: any) {
            if (e.code === "ERR_REQUEST_CANCELED") {
                console.log("User cancelled Apple sign in");
                // Don't show error for user cancellation
            } else {
                console.error("Apple login error:", e.code, e);
                alert(`Apple sign in failed: ${e.message || "An unexpected error occurred"}`);
            }
            // Re-throw to let caller know it failed
            throw e;
        }
    };
    const styles = useStyles(ThemedColor);
    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleStyle={{
                backgroundColor: ThemedColor.background,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
            }}
            handleIndicatorStyle={{
                backgroundColor: ThemedColor.tertiary,
                width: 40,
                height: 4,
                borderRadius: 2,
                marginVertical: 14,
            }}
            backgroundStyle={{ backgroundColor: "rgba(0,0,0,0.3)" }}
            enablePanDownToClose={true}>
            <BottomSheetView
                style={[
                    {
                        overflow: "hidden",
                        backgroundColor: ThemedColor.background,
                        height: "100%",
                    },
                ]}>
                <View style={styles.container}>
                    {/* Content Wrapper with proper flexbox */}
                    <View style={styles.contentWrapper}>
                        {/* Top Section - Header */}
                        <View style={styles.topSection}>
                            <Image
                                source={require("@/assets/images/229.Elegance.png")}
                                style={styles.headerGraphic}
                                tintColor={colorScheme === "dark" ? "#FFFFFF" : "#1F1F1F"}
                                resizeMode="contain"
                            />
                            <View style={styles.titleSection}>
                                <ThemedText type="title" style={styles.welcomeTitle}>
                                    {mode === "login" ? "Welcome back" : "Almost there!"}
                                </ThemedText>
                                <ThemedText type="default" style={[styles.subtitle, { color: ThemedColor.caption }]}>
                                    {mode === "login" ? "Choose your sign in method" : "Choose your sign in method"}
                                </ThemedText>
                            </View>
                        </View>

                        {/* Bottom Section - Buttons & Footer */}
                        <View style={styles.bottomSection}>
                            <View style={styles.buttonSection}>
                                <Animated.View style={{ opacity: phoneOpacity }}>
                                    <PrimaryButton
                                        title="Continue with Phone"
                                        onPress={() => {
                                            setVisible(false);
                                            if (mode === "login") {
                                                router.push("/login-phone");
                                            } else {
                                                router.push("/(onboarding)/phone");
                                            }
                                        }}
                                        style={styles.phoneButton}
                                        textStyle={styles.phoneButtonText}
                                    />
                                </Animated.View>

                                <Animated.View style={{ opacity: appleOpacity }}>
                                    <TouchableOpacity
                                        style={styles.appleButton}
                                        onPress={async () => {
                                            try {
                                                if (mode === "register") {
                                                    await apple_regiser();
                                                } else {
                                                    await apple_login();
                                                }
                                                setVisible(false);
                                            } catch (error) {
                                                console.error("Apple auth error in onPress:", error);
                                            }
                                        }}>
                                        <View style={styles.buttonContent}>
                                            <AntDesign name="apple" size={20} color={ThemedColor.primary} />
                                            <ThemedText style={styles.appleButtonText}>
                                                {mode === "register" ? "Continue with Apple" : "Sign in with Apple"}
                                            </ThemedText>
                                        </View>
                                    </TouchableOpacity>
                                </Animated.View>

                                <Animated.View style={{ opacity: googleOpacity }}>
                                    <TouchableOpacity
                                        style={styles.googleButton}
                                        onPress={async () => {
                                            try {
                                                await googleSignInAsync();
                                            } catch (error) {
                                                console.error("Google sign in failed:", error);
                                            }
                                        }}
                                        disabled={true} // Disable while in development
                                    >
                                        <View style={styles.buttonContent}>
                                            <AntDesign name="google" size={20} color={ThemedColor.primary} />
                                            <ThemedText style={styles.googleButtonText}>
                                                {mode === "register" ? "Continue with Google" : "Sign in with Google"}
                                            </ThemedText>
                                        </View>
                                        <View style={styles.developmentBadge}>
                                            <ThemedText style={styles.developmentBadgeText}>Coming Soon</ThemedText>
                                        </View>
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>

                            {/* Footer */}
                            <View style={styles.footerSection}>
                                <ThemedText type="caption" style={[styles.footerText, { color: ThemedColor.caption }]}>
                                    {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                                </ThemedText>
                                <TouchableOpacity
                                    onPress={() => {
                                        // Toggle between login and register would go here
                                        // For now, just close the modal
                                    }}>
                                    <ThemedText
                                        type="caption"
                                        style={[styles.footerLink, { color: ThemedColor.primary }]}>
                                        {mode === "login" ? "Sign up" : "Log in"}
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            paddingHorizontal: 20,
            paddingBottom: 24,
        },
        contentWrapper: {
            flex: 1,
            justifyContent: "space-between",
        },
        topSection: {
            alignItems: "center",
            flexShrink: 1,
        },
        headerGraphic: {
            width: "75%",
            aspectRatio: 1,
            maxHeight: Dimensions.get("screen").height / 4.5,
        },
        titleSection: {
            alignItems: "center",
            gap: 8,
            paddingTop: 16,
        },
        welcomeTitle: {
            fontSize: 36,
            fontWeight: "600",
            textAlign: "center",
            color: ThemedColor.text,
            fontFamily: "Fraunces",
            lineHeight: 42,
            letterSpacing: -2,
        },
        subtitle: {
            fontSize: 15,
            textAlign: "center",
            lineHeight: 22,
            fontFamily: "Outfit",
        },
        bottomSection: {
            flexShrink: 0,
        },
        buttonSection: {
            gap: 18,
        },
        appleButton: {
            backgroundColor: "#FFFFFF",
            borderRadius: 14,
            paddingVertical: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 4,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary + "30",
        },
        appleButtonText: {
            color: "#1F1F1F",
            fontSize: 16,
            fontWeight: "500",
            fontFamily: "Outfit",
        },
        googleButton: {
            backgroundColor: "#FFFFFF",
            borderRadius: 14,
            paddingVertical: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 5,
            elevation: 3,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary + "30",
            position: "relative",
            opacity: 0.7, // Slightly dimmed to indicate unavailable
        },
        googleButtonText: {
            color: "#1F1F1F",
            fontSize: 16,
            fontWeight: "500",
            fontFamily: "Outfit",
        },
        buttonContent: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
        },
        developmentBadge: {
            position: "absolute",
            top: -10,
            right: 0,
            backgroundColor: ThemedColor.primary,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
            shadowColor: ThemedColor.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 3,
        },
        developmentBadgeText: {
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: "600",
            fontFamily: "Outfit",
            letterSpacing: 0.3,
            textTransform: "uppercase",
        },
        phoneButton: {
            backgroundColor: ThemedColor.primary,
            borderRadius: 14,
            paddingVertical: 18,
            shadowColor: ThemedColor.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 6,
        },
        phoneButtonText: {
            color: "#FFFFFF",
            fontSize: 17,
            fontWeight: "700",
            fontFamily: "Outfit",
        },
        footerSection: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
            paddingTop: 20,
            paddingBottom: 32,
        },
        footerText: {
            fontSize: 14,
            fontFamily: "Outfit",
        },

        footerLink: {
            fontSize: 14,
            fontFamily: "Outfit",
            fontWeight: "600",
        },
        badge: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(100, 100, 255, 0.1)",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            gap: 8,
        },
        badgeText: {
            fontSize: 14,
            opacity: 0.8,
        },
    });
