import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { openAccountOverlay } from "@/hooks/useAccountOverlay";

// Quiet way back to an existing account for someone trying the app as a guest.
// Mirrors the "Already have an account? Log in" link on the landing screen, and
// opens the account overlay over Home rather than leaving for /login.
export const GuestLoginLink = React.memo(function GuestLoginLink() {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            testID="guest-login-link"
            onPress={() => openAccountOverlay("login-link")}
            activeOpacity={0.6}
            hitSlop={8}
            style={styles.row}>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                Already have an account?{" "}
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 14 }}>
                    Log in
                </ThemedText>
            </ThemedText>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    row: {
        alignSelf: "flex-start",
        paddingTop: 4,
        paddingBottom: 8,
    },
});
