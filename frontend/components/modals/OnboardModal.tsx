import { StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
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
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import {
    AppleAuthenticationButton,
    AppleAuthenticationButtonStyle,
    AppleAuthenticationButtonType,
} from "expo-apple-authentication";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    mode: "register" | "login";
};

export const OnboardModal = (props: Props) => {
    const { register, login, registerWithGoogle, loginWithGoogle } = useAuth();
    const { mode, visible, setVisible } = props;
    const router = useRouter();
    const ThemedColor = useThemeColor();

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
                    console.error('Google authentication error:', error);
                    if (mode === "register") {
                        // Try login if registration fails (user might already exist)
                        try {
                            await loginWithGoogle(result.user.id);
                            router.push("/(logged-in)/(tabs)/(task)");
                            setVisible(false);
                        } catch (loginError) {
                            console.error('Google login fallback failed:', loginError);
                        }
                    }
                }
            }
        },
        onError: (error) => {
            console.error('Google auth error:', error);
            alert('Google authentication failed. Please try again.');
        }
    });

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Define snap points
    const snapPoints = useMemo(() => ["50%"], []);

    // Handle visibility changes
    useEffect(() => {
        console.log(visible);
        if (visible) {
            bottomSheetModalRef.current?.present();
        } else {
            bottomSheetModalRef.current?.dismiss();
        }
    }, [visible]);

    // Handle sheet changes
    const handleSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && visible) {
                setVisible(false);
            }
        },
        [visible, setVisible]
    );

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
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
            const email = credential.email;
            const firstName = credential.fullName?.givenName;
            const lastName = credential.fullName?.familyName;
            if (!email || !firstName || !lastName) {
                console.log("We think you already have an accout: trying to log in instead");
                await login(appleAccountID);
                router.push("/(logged-in)/(tabs)/(task)");
            } else {
                let data = await register(email, appleAccountID);
                console.log(data);

                router.replace({
                    pathname: "/(onboarding)/phone",
                    params: {
                        initialFirstName: "",
                        initialLastName: "",
                        initialPhoneNumber: "",
                    },
                });
            }
        } catch (e: any) {
            if (e.code === "ERR_REQUEST_CANCELED") {
                console.log("they cancelled");
            } else {
                console.log(e.code);
                console.log(e);
                alert("An unexpected error occurred");
            }
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
        } catch (e: any) {
            if (e.code === "ERR_REQUEST_CANCELED") {
                console.log("they cancelled");
            } else {
                console.log(e.code);
                alert("An unexpected error occurred");
            }
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
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
            }}
            handleIndicatorStyle={{
                backgroundColor: ThemedColor.text,
                width: 48,
                height: 3,
                borderRadius: 10,
                marginVertical: 12,
            }}
            backgroundStyle={{ backgroundColor: "rgba(0,0,0,0.2)" }}
            enablePanDownToClose={true}>
            <BottomSheetView
                style={[
                    {
                        overflow: "hidden",
                        backgroundColor: ThemedColor.background,
                        height: "100%",
                    },
                ]}>
                <BlurView style={styles.blurContainer} intensity={0}>
                    <View style={styles.headerSection}>
                        <ThemedText type="title" style={styles.welcomeTitle}>
                            {mode === "login" ? "Login to Kindred" : "Register for Kindred"}
                        </ThemedText>
                    </View>
                    
                    <View style={styles.buttonSection}>
                        <PrimaryButton
                            title="Continue with Phone Number"
                            onPress={() => {
                                setVisible(false);
                                if (mode === "login") {
                                    router.push("/login-phone");
                                } else {
                                    router.push("/(onboarding)/productivity");
                                }
                            }}
                        />
                        
                        <PrimaryButton
                            title={mode === "register" ? "Sign Up with Google" : "Sign In with Google"}
                            onPress={async () => {
                                try {
                                    await googleSignInAsync();
                                } catch (error) {
                                    console.error('Google sign in failed:', error);
                                }
                            }}
                            style={styles.googleButton}
                            textStyle={styles.googleButtonText}
                        />
                        
                        <AppleAuthenticationButton
                            buttonType={
                                mode === "register" 
                                    ? AppleAuthenticationButtonType.SIGN_UP
                                    : AppleAuthenticationButtonType.SIGN_IN
                            }
                            buttonStyle={AppleAuthenticationButtonStyle.BLACK}
                            cornerRadius={10}
                            style={styles.appleButton}
                            onPress={() => {
                                if (mode === "register") {
                                    apple_regiser();
                                } else {
                                    apple_login();
                                }
                                setVisible(false);
                            }}
                        />
                    </View>
                </BlurView>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        blurContainer: {
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 40,
            height: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            flex: 1,
        },
        headerSection: {
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 8,
            width: "100%",
        },
        welcomeTitle: {
            fontSize: 32,
            fontWeight: "400",
            textAlign: "left",
            color: ThemedColor.text,
            fontFamily: "Fraunces",
            lineHeight: 38,
        },
        buttonSection: {
            width: "100%",
            gap: 12,
            flex: 1,
            justifyContent: "center",
        },
        phoneButton: {
            width: "100%",
            backgroundColor: "white",
            borderRadius: 10,
            paddingVertical: 15,
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3,
        },
        phoneButtonText: {
            color: "rgba(0,0,0,0.54)",
            fontSize: 20,
            fontWeight: "500",
            fontFamily: "Outfit",
        },
        googleButton: {
            width: "100%",
            backgroundColor: "white",
            borderRadius: 10,
            paddingVertical: 15,
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3,
        },
        appleButton: {
            width: "100%",
            height: 54,
            borderRadius: 10,
        },
        googleButtonText: {
            color: "rgba(0,0,0,0.54)",
            fontSize: 20,
            fontWeight: "500",
            fontFamily: "Outfit",
        },
    });
