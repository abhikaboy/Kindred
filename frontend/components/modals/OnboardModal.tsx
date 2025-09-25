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
    const { register, login } = useAuth();
    const { mode, visible, setVisible } = props;
    const router = useRouter();
    const ThemedColor = useThemeColor();

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Define snap points
    const snapPoints = useMemo(() => ["60%"], []);

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
                router.push("/(logged-in)/(tabs)");
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

            router.push("/(logged-in)/(tabs)");
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
                    <View>
                        <ThemedText
                            type="default"
                            style={{
                                fontFamily: "Outfit",
                                fontSize: 24,
                                textAlign: "center",
                                fontWeight: "600",
                                color: ThemedColor.text,
                            }}>
                            Welcome to Kindred 👋
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: "#B8b8b8" }}>
                            Connected Api: {process.env.EXPO_PUBLIC_URL}
                        </ThemedText>
                    </View>
                    <View style={{ width: "100%", gap: 20, alignItems: "center" }}>
                        <View
                            style={{
                                width: "90%",
                                gap: 12,
                            }}>
                            <PrimaryButton title="Continue with Phone" onPress={() => setVisible(false)} />
                            <PrimaryButton
                                title="Continue with Email"
                                onPress={() => setVisible(false)}
                                ghost
                                style={{
                                    backgroundColor: "#854DFF00",
                                }}
                            />
                        </View>
                        <View
                            style={{
                                flexDirection: "row",
                                maxWidth: "100%",
                                justifyContent: "space-evenly",
                                alignItems: "center",
                                gap: 12,
                            }}>
                            <View style={styles.divider} />
                            <ThemedText> or </ThemedText>
                            <View style={styles.divider} />
                        </View>
                        <AppleAuthenticationButton
                            onPress={() => {
                                if (mode === "register") {
                                    apple_regiser();
                                } else {
                                    apple_login();
                                }
                                setVisible(false);
                            }}
                            buttonType={AppleAuthenticationButtonType.SIGN_IN}
                            buttonStyle={AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                            cornerRadius={12}
                            style={{
                                width: "90%",
                                height: 48,
                                alignItems: "center",
                                padding: 4,
                            }}
                        />
                        <PrimaryButton
                            title="Continue with Google"
                            onPress={() => setVisible(false)}
                            ghost
                            style={{
                                backgroundColor: "#854DFF00",
                                borderRadius: 12,
                                borderColor: ThemedColor.text,
                                width: "90%",
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
            paddingBottom: Dimensions.get("screen").height * 0.1,
            height: "100%",
            gap: 32,
            alignItems: "center",
            flex: 1,
        },
        divider: {
            width: "38%",
            borderStyle: "solid",
            borderColor: ThemedColor.text,
            borderWidth: 0.5,
            height: 1,
        },
        outlineButton: {
            width: "50%",
            backgroundColor: ThemedColor.text + "20",
            borderColor: ThemedColor.text,
            borderWidth: 1,
            paddingVertical: 8,
            alignItems: "center",
            borderRadius: 24,
        },
    });
