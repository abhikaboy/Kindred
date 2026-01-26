import { ThemedView } from "@/components/ThemedView";
import * as AppleAuthentication from "expo-apple-authentication";
import { View, StyleSheet, Dimensions } from "react-native";
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";

export default function LogInButton() {
    const { login, register, user, logout } = useAuth();
    const router = useRouter();

    return (
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
                        console.log("User cancelled Apple sign in");
                        // Don't show error for user cancellation
                    } else if (e.message === "ACCOUNT_NOT_FOUND") {
                        // Account doesn't exist - show friendly message
                        console.log("Account not found, directing to sign up");
                        alert("No account found. Please sign up first!");
                    } else {
                        console.error('Apple login error:', e.code, e);
                        alert(`Apple sign in failed: ${e.message || 'An unexpected error occurred. Please try again.'}`);
                    }
                }
            }}
        />
    );
}

const styles = StyleSheet.create({
    button: {
        width: "100%",
        height: Dimensions.get("screen").height * 0.05,
    },
});
