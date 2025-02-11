import { ThemedView } from "@/components/ThemedView";
import * as AppleAuthentication from "expo-apple-authentication";
import { View, StyleSheet } from "react-native";
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";

export default function LogInButton() {
    const { login, register, user, logout } = useAuth();
    const router = useRouter();

    return (
        <View style={styles.container}>
            <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                cornerRadius={5}
                style={styles.button}
                onPress={async () => {
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
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    button: {
        width: "100%",
        height: 44,
    },
});
