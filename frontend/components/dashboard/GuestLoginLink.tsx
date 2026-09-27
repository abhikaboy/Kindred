import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

// Quiet way back to an existing account for someone trying the app as a guest.
// Mirrors the "Already have an account? Log in" link on the landing screen.
export const GuestLoginLink = React.memo(function GuestLoginLink() {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            testID="guest-login-link"
            onPress={() => router.push({ pathname: "/login", params: { mode: "login" } })}
            activeOpacity={0.6}
            hitSlop={8}
            style={styles.row}>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                Already have an account?{" "}
                <ThemedText type="caption" style={{ color: ThemedColor.primary, fontWeight: "800" }}>
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
