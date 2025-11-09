import { ThemedView } from "@/components/ThemedView";
import * as AppleAuthentication from "expo-apple-authentication";
import { View, StyleSheet, Dimensions } from "react-native";
import React, { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";

export default function SignUpButton() {
    const { register, setUser } = useAuth();
    const router = useRouter();

    return (
        <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
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
                    console.log(credential);
                    const appleAccountID = credential.user;
                    const email = credential.email;
                    const firstName = credential.fullName?.givenName;
                    const lastName = credential.fullName?.familyName;
                    if (!email || !firstName || !lastName) {
                        alert("Either you already have an account or didn't give us the required permissions. Please try again or use login instead.");
                        return;
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
                        console.log("User cancelled Apple sign up");
                        // Don't show error for user cancellation
                    } else {
                        console.error('Apple registration error:', e.code, e);
                        alert(`Apple sign up failed: ${e.message || 'An unexpected error occurred. Please try again.'}`);
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
