import { StyleSheet, Text, Touchable, TouchableOpacity, View } from "react-native";
import React from "react";
import Modal from "react-native-modal";
import { Dimensions } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
import PrimaryButton from "../inputs/PrimaryButton";
import AntDesign from "@expo/vector-icons/AntDesign";
import { BlurView } from "expo-blur";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    mode: "register" | "login";
};

export const OnboardModal = (props: Props) => {
    const { register, login } = useAuth();
    const { mode } = props;
    const router = useRouter();
    let ThemedColor = useThemeColor();

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
                router.navigate("/home");
            } else {
                let data = await register(email, appleAccountID);
                console.log(data);

                router.navigate({
                    pathname: "/(onboarding)",
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

            router.replace("/home");
        } catch (e: any) {
            if (e.code === "ERR_REQUEST_CANCELED") {
                console.log("they cancelled");
            } else {
                console.log(e.code);
                alert("An unexpected error occurred");
            }
        }
    };
    return (
        <Modal
            onBackdropPress={() => props.setVisible(false)}
            onBackButtonPress={() => props.setVisible(false)}
            isVisible={props.visible}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            avoidKeyboard>
            <View
                style={[
                    {
                        borderRadius: 24,
                        overflow: "hidden",
                    },
                    styles.container,
                ]}>
                <BlurView style={styles.blurContainer} intensity={25} tint={ThemedColor.background}>
                    <ThemedText
                        type="default"
                        style={{
                            fontFamily: "Fraunces",
                            fontSize: 24,
                            color: ThemedColor.buttonText,
                        }}>
                        Kindred
                    </ThemedText>
                    <ThemedText type="default" style={{ color: "#B8b8b8" }}>
                        Connected Api: {process.env.EXPO_PUBLIC_API_URL}
                    </ThemedText>
                    <PrimaryButton title="Continue with Phone" onPress={() => props.setVisible(false)} />
                    <PrimaryButton
                        title="Continue with Email"
                        onPress={() => props.setVisible(false)}
                        style={{
                            backgroundColor: "#854DFF00",
                        }}
                    />
                    <View
                        style={{
                            flexDirection: "row",
                            display: "flex",
                            alignItems: "center",
                            alignSelf: "stretch",
                            width: Dimensions.get("screen").width - 24,
                            marginTop: -12,
                            paddingRight: 24,
                            justifyContent: "space-evenly",
                        }}>
                        <TouchableOpacity
                            onPress={() => {
                                if (mode === "register") {
                                    apple_regiser();
                                } else {
                                    apple_login();
                                }
                                props.setVisible(false);
                            }}
                            style={{
                                width: "46%",
                                backgroundColor: ThemedColor.lightened + "00",
                                paddingVertical: 16,
                                alignItems: "center",
                                borderRadius: 24,
                            }}>
                            <View style={{ borderRadius: 12, width: "100%", overflow: "hidden" }}>
                                <BlurView
                                    style={{ width: "100%", alignItems: "center", padding: 12 }}
                                    intensity={25}
                                    tint={ThemedColor.background}>
                                    <AntDesign name="apple-o" size={48} color={ThemedColor.buttonText} />
                                </BlurView>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => props.setVisible(false)}
                            style={{
                                backgroundColor: ThemedColor.lightened + "00",
                                paddingVertical: 16,
                                alignItems: "center",
                                width: "46%",
                                borderRadius: 24,
                            }}>
                            <View style={{ borderRadius: 12, width: "100%", overflow: "hidden" }}>
                                <BlurView
                                    style={{ width: "100%", alignItems: "center", padding: 12 }}
                                    intensity={25}
                                    tint={ThemedColor.background}>
                                    <AntDesign name="google" size={48} color={ThemedColor.buttonText} />
                                </BlurView>
                            </View>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    blurContainer: {
        paddingBottom: Dimensions.get("screen").height * 0.1,
        paddingTop: 32,
        paddingLeft: 24,
        gap: 12,
    },
    container: {
        flex: 1,
        width: Dimensions.get("screen").width,
        borderTopRightRadius: 24,
        borderTopLeftRadius: 24,
        bottom: -16,
        left: -24,
        position: "absolute",
    },
});
