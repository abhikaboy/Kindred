import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { openAccountOverlay } from "@/hooks/useAccountOverlay";

// Quiet way back to an existing account for someone trying the app as a guest.
// Opens the account overlay over Home rather than leaving for /login.
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
                Create an account for the best experience.{" "}
                <ThemedText type="caption" style={{ color: ThemedColor.primary, fontWeight: "800" }}>
                    Log In
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
