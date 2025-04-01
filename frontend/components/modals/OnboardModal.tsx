import { StyleSheet, Text, Touchable, TouchableOpacity, View } from "react-native";
import React from "react";
import Modal from "react-native-modal";
import { Dimensions } from "react-native";
import ThemedColor from "@/constants/Colors";
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
                alert("Either you already have a user or didn't give us permissions " + appleAccountID);
            }
            let data = await register(email, appleAccountID);
            console.log(data);

            router.replace({
                pathname: "/(onboarding)",
                params: {
                    initialFirstName: "",
                    initialLastName: "",
                    initialPhoneNumber: "",
                },
            });
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
            <BlurView style={styles.container} intensity={25} tint={ThemedColor.background}>
                <ThemedText
                    type="default"
                    style={{
                        fontFamily: "Fraunces",
                        fontSize: 24,
                    }}>
                    Kindred
                </ThemedText>
                <ThemedText type="default" style={{ color: "#B8b8b8" }}>
                    This is going to be some copy text related to actual product but for right now idk
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
                        marginTop: 24,
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
                            backgroundColor: ThemedColor.lightened,
                            paddingVertical: 16,
                            alignItems: "center",
                            borderRadius: 24,
                        }}>
                        <AntDesign name="apple-o" size={48} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => props.setVisible(false)}
                        style={{
                            backgroundColor: ThemedColor.lightened,
                            paddingVertical: 16,
                            alignItems: "center",
                            width: "46%",
                            borderRadius: 24,
                        }}>
                        <AntDesign name="google" size={48} color={ThemedColor.text} />
                    </TouchableOpacity>
                </View>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: Dimensions.get("screen").width,
        borderTopRightRadius: 24,
        borderTopLeftRadius: 24,
        bottom: -16,
        paddingBottom: Dimensions.get("screen").height * 0.1,
        paddingTop: 32,
        paddingLeft: 24,
        left: -24,
        gap: 24,
        position: "absolute",
    },
});
